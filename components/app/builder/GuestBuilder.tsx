"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Builder, SECTION_KEY, type GuestHooks, type GuestState } from "@/components/app/builder/Builder";
import { createAppBrowserClient } from "@/lib/supabase/app-client";
import { parseIdentifier } from "@/lib/auth/identifier";
import { cleanResume, type Resume } from "@/lib/app/resume-schema";
import { DEFAULT_TEMPLATE, isTemplateId } from "@/lib/app/resume-templates";
import { sampleFor } from "@/lib/app/design-sample";
import { filledCount, GATE_AT, guestStart } from "@/lib/app/guest-resume";
import { EVENTS, track } from "@/lib/analytics/events";
import { metaTrack } from "@/lib/analytics/meta";

/**
 * The builder before an account — what a template on the home page opens.
 *
 * Everything is kept in this browser (localStorage) until they sign up, so a
 * closed tab or a trip to /signin loses nothing. After a few fields a sheet
 * asks them to save it: the name, number and email they already typed into
 * the resume are filled in for them, so it is a password and a city. Then a
 * draft is created from exactly what is on screen and the real builder opens
 * on the section they were in.
 *
 * Somebody who signs in another way (the /signin link) comes back here
 * signed in, and the same hand-over runs on arrival.
 */

const STORE = "cc_guest_resume";

type Saved = { state: GuestState; start: Resume };

function readSaved(): Saved | null {
  try {
    const raw = localStorage.getItem(STORE);
    if (!raw) return null;
    const v = JSON.parse(raw) as Saved;
    if (!v?.state?.resume || !isTemplateId(v.state.template)) return null;
    return { state: { ...v.state, resume: cleanResume(v.state.resume) }, start: cleanResume(v.start) };
  } catch {
    return null;
  }
}

function freshStart(template: string): Saved {
  const start = guestStart(sampleFor(template));
  return { start, state: { resume: start, template, doc: {}, photo: null, section: "personal" } };
}

/** Make the draft from what is on screen, and open the real builder there. */
async function handOver(state: GuestState) {
  const res = await fetch("/api/app/resume/draft", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ template: state.template }),
  });
  const json = (await res.json().catch(() => ({}))) as { ok?: boolean; draft?: { id?: string } };
  if (!json.ok || !json.draft?.id) throw new Error("Couldn't save your resume. Try again.");
  const put = await fetch("/api/app/resume/draft", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      id: json.draft.id,
      content: state.resume,
      template: state.template,
      styles: { fields: {}, hidden: [], doc: state.doc },
      photo: state.photo,
    }),
  });
  if (!put.ok) throw new Error("Couldn't save your resume. Try again.");
  track(EVENTS.BUILDER_STEP, { label: "draft_created", template: state.template, where: "guest" });
  try {
    sessionStorage.setItem(SECTION_KEY, state.section);
    localStorage.removeItem(STORE);
  } catch {
    /* fine */
  }
  // A full load, so the server sees the new session cookies.
  window.location.assign("/app/resume/builder");
}

export function GuestBuilder({ template: asked, signedIn }: { template: string | null; signedIn: boolean }) {
  const [saved, setSaved] = useState<Saved | null>(null);
  const [handing, setHanding] = useState(false);
  const [trouble, setTrouble] = useState<string | null>(null);

  // Read the browser's copy after mount; the server has none to render.
  useEffect(() => {
    const prev = readSaved();
    let next: Saved;
    if (prev) {
      // A template tapped on the home page is a request to see it — keep
      // what they wrote, wear the new design.
      next = asked && isTemplateId(asked) ? { ...prev, state: { ...prev.state, template: asked } } : prev;
    } else {
      next = freshStart(asked && isTemplateId(asked) ? asked : DEFAULT_TEMPLATE);
    }
    setSaved(next);

    if (signedIn) {
      setHanding(true);
      // Nothing written here: they are signed in, so the ordinary way in —
      // a new resume in the template, with their own details on it.
      if (!prev) {
        if (!asked || !isTemplateId(asked)) return window.location.assign("/app/resume");
        void fetch("/api/app/resume/draft", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ template: asked, keepContact: true }),
        }).finally(() => window.location.assign("/app/resume/builder"));
        return;
      }
      handOver(next.state).catch((e) => {
        setTrouble(e instanceof Error ? e.message : String(e));
        setHanding(false);
      });
      return;
    }
    track(EVENTS.BUILDER_STEP, { label: "guest_open", template: next.state.template, restored: Boolean(prev) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!saved || handing) {
    return (
      <div className="grid min-h-dvh place-items-center bg-paper px-6 text-center">
        <p className="text-[0.9rem] text-ink-50">{trouble ?? (handing ? "Saving your resume…" : "Opening the builder…")}</p>
      </div>
    );
  }
  return <GuestSession saved={saved} />;
}

function GuestSession({ saved }: { saved: Saved }) {
  const [state, setState] = useState<GuestState>(saved.state);
  const [sheet, setSheet] = useState<null | "auto" | "download" | "next">(null);
  const dismissedAt = useRef<number | null>(null);
  const shownOnce = useRef(false);

  const filled = useMemo(() => filledCount(saved.start, state.resume), [saved.start, state.resume]);
  const filledRef = useRef(filled);
  filledRef.current = filled;

  // Kept on every change, so nothing is lost before they sign up.
  useEffect(() => {
    try {
      localStorage.setItem(STORE, JSON.stringify({ state, start: saved.start }));
    } catch {
      /* storage full or blocked — the session still works */
    }
  }, [state, saved.start]);

  const open = useCallback((why: "auto" | "download" | "next") => {
    setSheet((cur) => {
      if (cur) return cur;
      track(EVENTS.BUILDER_STEP, { label: "gate_shown", reason: why, fields: filledRef.current });
      return why;
    });
  }, []);

  // On its own once, a moment after the third field — never mid-word.
  useEffect(() => {
    if (shownOnce.current || filled < GATE_AT) return;
    const t = setTimeout(() => {
      shownOnce.current = true;
      open("auto");
    }, 1200);
    return () => clearTimeout(t);
  }, [filled, open]);

  const hooks: GuestHooks = useMemo(
    () => ({
      onState: setState,
      backHref: "/resume-templates",
      needAccount: (reason) => {
        if (reason === "download") return open("download");
        // Moving on after closing the sheet: ask again, but only once they
        // have written a few more fields since.
        if (filledRef.current >= GATE_AT && filledRef.current >= (dismissedAt.current ?? 0) + GATE_AT) {
          shownOnce.current = true;
          open("next");
        }
      },
    }),
    [open],
  );

  return (
    <>
      <Builder
        draftId=""
        initial={saved.state.resume}
        templateId={saved.state.template}
        initialStyles={{ fields: {}, hidden: [], doc: saved.state.doc }}
        initialPhoto={saved.state.photo}
        title="My resume · not saved yet"
        guest={hooks}
        initialSection={saved.state.section}
      />
      {sheet && (
        <SaveSheet
          state={state}
          reason={sheet}
          onClose={() => {
            dismissedAt.current = filledRef.current;
            track(EVENTS.BUILDER_STEP, { label: "gate_dismissed", reason: sheet });
            setSheet(null);
          }}
        />
      )}
    </>
  );
}

function SaveSheet({
  state,
  reason,
  onClose,
}: {
  state: GuestState;
  reason: "auto" | "download" | "next";
  onClose: () => void;
}) {
  const r = state.resume;
  const [mode, setMode] = useState<"details" | "login">("details");
  const [name, setName] = useState(r.full_name ?? "");
  const [phone, setPhone] = useState(r.phone ?? "");
  const [email, setEmail] = useState(r.email ?? "");
  const [city, setCity] = useState(r.location ?? "");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function fail(message: string, why = message) {
    track(EVENTS.BUILDER_STEP, { label: "error", reason: why.slice(0, 100), where: "guest" });
    setError(message);
    setBusy(false);
  }

  async function signIn(loginEmail: string) {
    const { error } = await createAppBrowserClient().auth.signInWithPassword({ email: loginEmail, password });
    if (error) throw error;
  }

  async function submit() {
    const number = parseIdentifier(phone);
    if (!number || number.kind !== "phone") return fail("Enter a 10-digit mobile number.", "bad number");
    // What they type here is what their resume says too.
    const withDetails: GuestState = {
      ...state,
      resume: {
        ...r,
        full_name: name.trim() || r.full_name,
        phone: phone.trim() || r.phone,
        email: email.trim() || r.email,
        location: city.trim() || r.location,
      },
    };

    if (mode === "login") {
      if (!password) return fail("Enter your password.");
      setBusy(true);
      setError(null);
      try {
        await signIn(number.email);
        track(EVENTS.BUILDER_STEP, { label: "login", where: "guest" });
        await handOver(withDetails);
      } catch (e) {
        fail(readable(e), String(e));
      }
      return;
    }

    if (name.trim().length < 2) return fail("Enter your full name.", "no name");
    const mail = parseIdentifier(email);
    if (!mail || mail.kind !== "email") return fail("Enter your email address.", "bad email");
    if (city.trim().length < 2) return fail("Enter your city.", "no city");
    if (password.length < 8) return fail("Use a password of at least 8 characters.", "short password");

    track(EVENTS.BUILDER_STEP, { label: "details_submit", where: "guest" });
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/email-signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier: number.phone, password, name, city, contactEmail: mail.email }),
      });
      if (res.status === 409) {
        track(EVENTS.BUILDER_STEP, { label: "existing_account", where: "guest" });
        setMode("login");
        setPassword("");
        setBusy(false);
        return;
      }
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        return fail(body.error ?? "Couldn't save that. Try again in a moment.");
      }
      track(EVENTS.BUILDER_STEP, { label: "account_created", where: "guest" });
      metaTrack("CompleteRegistration", { content_name: "guest-builder" });
      await signIn(number.email);
      await handOver(withDetails);
    } catch (e) {
      fail(readable(e), String(e));
    }
  }

  const field =
    "w-full rounded-xl border border-ink-15 px-4 py-3 text-[16px] outline-none transition-colors focus:border-ink-30 sm:text-[0.95rem]";
  const heading =
    mode === "login"
      ? "Welcome back"
      : reason === "download"
        ? "Save your resume to download it"
        : "Nice start — save your resume";

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center" role="dialog" aria-modal="true">
      <button type="button" aria-label="Close" className="absolute inset-0 cursor-default" onClick={() => !busy && onClose()} />
      <div className="relative max-h-[92dvh] w-full overflow-y-auto rounded-t-[1.75rem] bg-paper p-6 shadow-2xl sm:max-w-[28rem] sm:rounded-[1.75rem] sm:p-8">
        <h2 className="text-[1.4rem] font-semibold leading-tight tracking-[-0.03em]">{heading}</h2>
        <p className="mt-2 text-[0.9rem] leading-relaxed text-ink-50">
          {mode === "login"
            ? "This number already has a Cheatcode account. Enter its password and your resume moves into it."
            : "Free. Takes 20 seconds, and you carry on exactly where you are."}
        </p>

        {error && <p className="mt-4 rounded-xl border border-ink-30 p-3 text-[0.85rem] leading-relaxed">{error}</p>}

        <form
          className="mt-5 space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          {mode === "details" && (
            <>
              <input name="name" autoComplete="name" autoCapitalize="words" value={name} maxLength={80}
                onChange={(e) => setName(e.target.value)} placeholder="Full name" aria-label="Full name" className={field} />
              <input name="username" type="tel" inputMode="tel" autoComplete="tel" value={phone}
                onChange={(e) => setPhone(e.target.value)} placeholder="Mobile number" aria-label="Mobile number" className={field} />
              <input name="email" type="email" inputMode="email" autoComplete="email" autoCapitalize="none" value={email}
                onChange={(e) => setEmail(e.target.value)} placeholder="Email" aria-label="Email" className={field} />
              <input name="city" autoComplete="address-level2" autoCapitalize="words" value={city} maxLength={60}
                onChange={(e) => setCity(e.target.value)} placeholder="City" aria-label="City" className={field} />
            </>
          )}
          {mode === "login" && (
            <input name="username" type="tel" autoComplete="username" value={phone} readOnly className={`${field} text-ink-50`} />
          )}

          <span className="relative block">
            <input
              autoFocus
              name="password"
              type={show ? "text" : "password"}
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={mode === "login" ? "Your password" : "Create a password (8+ characters)"}
              aria-label="Password"
              className={`${field} pr-16`}
            />
            <button type="button" onClick={() => setShow((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[0.8rem] text-ink-30 hover:text-ink">
              {show ? "Hide" : "Show"}
            </button>
          </span>

          <button type="submit" disabled={busy}
            className="!mt-5 w-full rounded-full bg-ink px-5 py-3.5 text-[0.95rem] font-medium text-paper transition-opacity disabled:opacity-50">
            {busy ? "Saving your resume…" : mode === "login" ? "Sign in & continue →" : "Save & continue →"}
          </button>

          <div className="flex items-center justify-between gap-3 pt-1 text-[0.8rem] text-ink-30">
            {mode === "login" ? (
              <button type="button" onClick={() => { setMode("details"); setError(null); }}
                className="underline underline-offset-4 hover:text-ink">
                Use a different number
              </button>
            ) : (
              <Link href="/signin?next=%2Fresume-builder" rel="nofollow" className="underline underline-offset-4 hover:text-ink">
                I have an account
              </Link>
            )}
            {reason !== "download" && (
              <button type="button" disabled={busy} onClick={onClose} className="hover:text-ink">
                Not now
              </button>
            )}
          </div>

          <p className="pt-1 text-center text-[0.72rem] leading-relaxed text-ink-30">
            By continuing you agree to our{" "}
            <Link href="/terms" className="underline underline-offset-2">Terms</Link> and{" "}
            <Link href="/privacy" className="underline underline-offset-2">Privacy Policy</Link>.
          </p>
        </form>
      </div>
    </div>
  );
}

function readable(e: unknown): string {
  const raw = e instanceof Error ? e.message : String(e);
  if (/invalid login credentials/i.test(raw)) return "That password doesn't match this number. Try again.";
  if (/fetch|network/i.test(raw)) return "No connection. Check your internet and try again.";
  return raw || "Something went wrong. Try again.";
}
