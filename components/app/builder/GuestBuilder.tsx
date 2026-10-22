"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Builder, SECTION_KEY, type GuestHooks, type GuestState } from "@/components/app/builder/Builder";
import { SignInForm } from "@/app/(app)/signin/SignInForm";
import { cleanResume, type Resume } from "@/lib/app/resume-schema";
import { DEFAULT_TEMPLATE, isTemplateId } from "@/lib/app/resume-templates";
import { sampleFor } from "@/lib/app/design-sample";
import { filledCount, GATE_AT, guestStart } from "@/lib/app/guest-resume";
import { EVENTS, track } from "@/lib/analytics/events";

/**
 * The builder before an account — what a template on the home page opens.
 *
 * Everything is kept in this browser (localStorage) until they sign up, so a
 * closed tab or a trip to Google loses nothing. After a few fields the
 * ordinary sign-in card opens over the builder (Google, or number / email,
 * with the number, name and city from the resume already filled in). Then a
 * draft is created from exactly what is on screen and the real builder opens
 * on the section they were in.
 *
 * Google sign-in leaves the page and comes back here signed in; the same
 * hand-over runs on arrival.
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

/**
 * The same sign-in card as /signin — Google, or number / email — in a sheet
 * over the builder. A number/email sign-in saves the resume and opens the
 * editor from here; Google goes away and comes back to /resume-builder, where
 * GuestBuilder finds the browser's copy and does the same on arrival.
 */
function SaveSheet({ state, onClose }: { state: GuestState; onClose: () => void }) {
  const r = state.resume;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center" role="dialog" aria-modal="true">
      <button type="button" aria-label="Close" className="absolute inset-0 cursor-default" onClick={onClose} />
      <div className="relative max-h-[92dvh] w-full overflow-y-auto rounded-t-[1.75rem] bg-paper p-7 shadow-2xl sm:max-w-[34rem] sm:rounded-[1.75rem] sm:p-10">
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute right-4 top-4 rounded-lg p-2 text-ink-30 transition-colors hover:bg-ink-04 hover:text-ink"
        >
          <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
            <path d="M4 4l8 8M12 4l-8 8" />
          </svg>
        </button>
        <SignInForm
          next="/resume-builder"
          initialIdentifier={r.phone || r.email || ""}
          initialName={r.full_name ?? ""}
          initialCity={r.location ?? ""}
          onSignedIn={() => handOver(state)}
        />
      </div>
    </div>
  );
}
