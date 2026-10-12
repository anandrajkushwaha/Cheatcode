"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { TemplateGallery } from "@/components/app/TemplateGallery";
import { createAppBrowserClient } from "@/lib/supabase/app-client";
import { parseIdentifier } from "@/lib/auth/identifier";
import { templateById } from "@/lib/app/resume-templates";
import { EVENTS, track } from "@/lib/analytics/events";
import { metaTrack } from "@/lib/analytics/meta";

/**
 * The ad's way in: templates first, then the details that go at the top of
 * the resume — which is also the account.
 *
 * Sending ad traffic to a sign-in screen lost nearly everyone at the first
 * screen. Here the first thing is the product (sixty designs), and the form
 * that follows a tap is the resume's own first step: name, number, email,
 * city. The password is said for what it is — the account that keeps the
 * resume — rather than hidden; people should know an account exists.
 *
 * After it: the account is created (same route as /signup), the browser
 * signs in, a draft is made in the chosen template from those details, and
 * the editor opens. Every step is a builder_step event for admin Journeys.
 */

type Mode = "details" | "login";

export function BuildResume() {
  const router = useRouter();
  const [picked, setPicked] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>("details");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [city, setCity] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function pick(template: string) {
    track(EVENTS.BUILDER_STEP, { label: "template_click", template });
    setPicked(template);
    setError(null);
  }

  function fail(message: string, reason = message) {
    track(EVENTS.BUILDER_STEP, { label: "error", reason: reason.slice(0, 100) });
    setError(message);
    setBusy(false);
  }

  async function openDraft(template: string) {
    const res = await fetch("/api/app/resume/draft", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      // Their name and contact details on top of the template's sample.
      body: JSON.stringify({ template, keepContact: true }),
    });
    const json = (await res.json().catch(() => ({}))) as { ok?: boolean };
    // The account exists and is signed in either way; if the draft did not
    // take, the resume page lets them pick again rather than stranding them.
    if (json.ok) track(EVENTS.BUILDER_STEP, { label: "draft_created", template });
    router.push(json.ok ? "/app/resume/builder" : "/app/resume");
    router.refresh();
  }

  async function signIn(loginEmail: string) {
    const supabase = createAppBrowserClient();
    const { error } = await supabase.auth.signInWithPassword({ email: loginEmail, password });
    if (error) throw error;
  }

  async function submit() {
    if (!picked) return;
    const number = parseIdentifier(phone);
    if (!number || number.kind !== "phone") return fail("Enter a 10-digit mobile number.", "bad number");

    if (mode === "login") {
      if (!password) return fail("Enter your password.");
      setBusy(true);
      setError(null);
      try {
        await signIn(number.email);
        track(EVENTS.BUILDER_STEP, { label: "login" });
        await openDraft(picked);
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

    track(EVENTS.BUILDER_STEP, { label: "details_submit" });
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/email-signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier: number.phone, password, name, city, contactEmail: mail.email }),
      });
      if (res.status === 409) {
        track(EVENTS.BUILDER_STEP, { label: "existing_account" });
        setMode("login");
        setPassword("");
        setBusy(false);
        return;
      }
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        return fail(body.error ?? "Couldn't save that. Try again in a moment.");
      }
      track(EVENTS.BUILDER_STEP, { label: "account_created" });
      metaTrack("CompleteRegistration", { content_name: "build-resume" });
      await signIn(number.email);
      await openDraft(picked);
    } catch (e) {
      fail(readable(e), String(e));
    }
  }

  const field =
    "w-full rounded-xl border border-ink-15 px-4 py-3 text-[16px] outline-none transition-colors focus:border-ink-30 sm:text-[0.95rem]";

  return (
    <div className="min-h-dvh bg-paper">
      <header className="container-page flex items-center justify-between py-5">
        <Link href="/" className="text-[0.95rem] font-semibold tracking-[-0.04em]">
          Cheatcode
        </Link>
        <Link href="/signin?next=/app/resume" className="text-[0.82rem] text-ink-50 hover:text-ink">
          <span className="hidden sm:inline">Already have an account? </span>Sign in
        </Link>
      </header>

      <main className="container-page pb-20">
        <div className="max-w-[44rem] pt-4 sm:pt-8">
          <h1 className="text-[1.9rem] font-semibold leading-[1.1] tracking-[-0.04em] sm:text-[2.5rem]">
            Pick a template.
            <span className="text-ink-30"> Your resume is ready in 10 minutes.</span>
          </h1>
          <p className="mt-4 text-[0.98rem] leading-relaxed text-ink-50">
            Free, ATS-friendly designs. Tap one to start — you can switch any time.
          </p>
          <ol className="mt-5 flex flex-wrap gap-x-5 gap-y-1.5 text-[0.8rem] text-ink-50">
            <li>
              <span className="font-semibold text-ink">1</span> Choose a template
            </li>
            <li>
              <span className="font-semibold text-ink">2</span> Your details
            </li>
            <li>
              <span className="font-semibold text-ink">3</span> Edit &amp; download
            </li>
          </ol>
        </div>

        <section className="mt-8">
          <TemplateGallery current={null} onPick={pick} />
        </section>
      </main>

      {picked && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center" role="dialog" aria-modal="true">
          <button
            type="button"
            aria-label="Close"
            className="absolute inset-0 cursor-default"
            onClick={() => !busy && setPicked(null)}
          />
          <div className="relative max-h-[92dvh] w-full overflow-y-auto rounded-t-[1.75rem] bg-paper p-6 shadow-2xl sm:max-w-[30rem] sm:rounded-[1.75rem] sm:p-8">
            <p className="text-[0.75rem] font-medium uppercase tracking-[0.14em] text-ink-30">Step 2 of 3</p>
            <h2 className="mt-2 text-[1.45rem] font-semibold leading-tight tracking-[-0.03em]">
              {mode === "login" ? "Welcome back" : "Let’s start with your details"}
            </h2>
            <p className="mt-2 text-[0.9rem] leading-relaxed text-ink-50">
              {mode === "login"
                ? "You already have a Cheatcode account with this number. Enter its password and we’ll open your new resume."
                : "These go at the top of your resume, where recruiters look first."}
            </p>

            <div className="mt-4 flex items-center justify-between gap-3 rounded-xl bg-ink-04 px-3.5 py-2.5 text-[0.82rem]">
              <span className="min-w-0 truncate">
                Template: <span className="font-medium">{templateById(picked).name}</span>
              </span>
              <button
                type="button"
                disabled={busy}
                onClick={() => setPicked(null)}
                className="shrink-0 text-ink-50 underline underline-offset-2 hover:text-ink"
              >
                Change
              </button>
            </div>

            {error && (
              <p className="mt-4 rounded-xl border border-ink-30 p-3 text-[0.85rem] leading-relaxed">{error}</p>
            )}

            <form
              className="mt-5 space-y-3"
              onSubmit={(e) => {
                e.preventDefault();
                void submit();
              }}
            >
              {mode === "details" && (
                <>
                  <label className="block">
                    <span className="mb-1.5 block text-[0.8rem] text-ink-50">Full name</span>
                    <input
                      autoFocus
                      name="name"
                      autoComplete="name"
                      autoCapitalize="words"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Riya Sharma"
                      maxLength={80}
                      className={field}
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1.5 block text-[0.8rem] text-ink-50">Mobile number</span>
                    <input
                      name="username"
                      type="tel"
                      inputMode="tel"
                      autoComplete="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="98765 43210"
                      className={field}
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1.5 block text-[0.8rem] text-ink-50">Email</span>
                    <input
                      name="email"
                      type="email"
                      inputMode="email"
                      autoComplete="email"
                      autoCapitalize="none"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="riya@gmail.com"
                      className={field}
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1.5 block text-[0.8rem] text-ink-50">City</span>
                    <input
                      name="city"
                      autoComplete="address-level2"
                      autoCapitalize="words"
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      placeholder="Lucknow"
                      maxLength={60}
                      className={field}
                    />
                  </label>
                </>
              )}

              {mode === "login" && (
                <input name="username" type="tel" autoComplete="username" value={phone} readOnly className={`${field} text-ink-50`} />
              )}

              <label className="block">
                <span className="mb-1.5 block text-[0.8rem] text-ink-50">
                  {mode === "login" ? "Password" : "Create a password"}
                </span>
                <span className="relative block">
                  <input
                    autoFocus={mode === "login"}
                    name="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete={mode === "login" ? "current-password" : "new-password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={mode === "login" ? "Your password" : "8+ characters"}
                    className={`${field} pr-16`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[0.8rem] text-ink-30 hover:text-ink"
                  >
                    {showPassword ? "Hide" : "Show"}
                  </button>
                </span>
                {mode === "details" && (
                  <span className="mt-1.5 block text-[0.75rem] leading-relaxed text-ink-30">
                    This creates your free Cheatcode account so your resume is saved. Use your number and
                    this password to come back to it.
                  </span>
                )}
              </label>

              <button
                type="submit"
                disabled={busy}
                className="!mt-5 w-full rounded-full bg-ink px-5 py-3.5 text-[0.95rem] font-medium text-paper transition-opacity disabled:opacity-50"
              >
                {busy ? "Setting up your resume…" : "Continue to my resume →"}
              </button>

              {mode === "login" && (
                <button
                  type="button"
                  onClick={() => {
                    setMode("details");
                    setError(null);
                  }}
                  className="w-full text-[0.82rem] text-ink-30 underline underline-offset-4 hover:text-ink"
                >
                  Use a different number
                </button>
              )}

              <p className="pt-1 text-center text-[0.72rem] leading-relaxed text-ink-30">
                By continuing you agree to our{" "}
                <Link href="/terms" className="underline underline-offset-2">
                  Terms
                </Link>{" "}
                and{" "}
                <Link href="/privacy" className="underline underline-offset-2">
                  Privacy Policy
                </Link>
                .
              </p>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function readable(e: unknown): string {
  const raw = e instanceof Error ? e.message : String(e);
  if (/invalid login credentials/i.test(raw)) return "That password doesn't match this number. Try again.";
  if (/email logins are disabled|email provider/i.test(raw)) return "Sign-up isn't switched on yet. Please try again later.";
  if (/fetch|network/i.test(raw)) return "No connection. Check your internet and try again.";
  return raw || "Something went wrong. Try again.";
}
