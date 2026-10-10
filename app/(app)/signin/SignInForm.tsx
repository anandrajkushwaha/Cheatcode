"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createAppBrowserClient } from "@/lib/supabase/app-client";
import { parseIdentifier, type Identifier } from "@/lib/auth/identifier";

type Mode = "choose" | "identify" | "password" | "login" | "done";

/**
 * Two ways in.
 *
 * Google is one tap and almost every Indian student and working
 * professional already has a Gmail account. An email or mobile number with a
 * password is the way in that works everywhere — above all inside Instagram
 * and Facebook, where Google refuses to sign anybody in, which is exactly
 * where people tapping a Meta ad land.
 *
 * The second path is two short steps: the email or number, then a password.
 * A new one gets an account on the spot (no code or confirmation email to
 * chase from inside a webview); one that already has an account is asked for
 * its password instead. A number signs in with a password, not an SMS code:
 * see lib/auth/identifier.ts.
 */
export function SignInForm({
  next,
  initialMode = "choose",
}: {
  next: string;
  initialMode?: "choose" | "email";
}) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>(initialMode === "email" ? "identify" : "choose");
  const [raw, setRaw] = useState("");
  const [id, setId] = useState<Identifier | null>(null);
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [inApp, setInApp] = useState<null | { app: string; android: boolean }>(null);
  const [copied, setCopied] = useState(false);
  const [showLink, setShowLink] = useState(false);

  /*
   * Instagram, Facebook and other apps open links in their own browser, and
   * Google refuses to sign anybody in there ("disallowed_useragent"). In
   * those browsers email/phone is offered first, with a way out to the real
   * browser for anyone who wants Google.
   */
  useEffect(() => {
    const ua = navigator.userAgent || "";
    const app = /Instagram/i.test(ua)
      ? "Instagram"
      : /FBAN|FBAV|FB_IAB|FBIOS/i.test(ua)
        ? "Facebook"
        : /LinkedInApp/i.test(ua)
          ? "LinkedIn"
          : /Snapchat/i.test(ua)
            ? "Snapchat"
            : /\bLine\//i.test(ua)
              ? "LINE"
              : null;
    if (app) setInApp({ app, android: /Android/i.test(ua) });
  }, []);

  function openInBrowser() {
    const url = window.location.href;
    if (inApp?.android) {
      // Chrome on Android honours an intent: link from inside the app.
      window.location.href = `intent://${url.replace(/^https?:\/\//, "")}#Intent;scheme=https;package=com.android.chrome;end`;
      return;
    }
    // iOS has no way to force it, and in a WKWebView navigator.clipboard is
    // often missing entirely. Show the link to copy by hand instead.
    const copy = navigator.clipboard?.writeText(url);
    if (!copy) {
      setShowLink(true);
      return;
    }
    void copy.then(() => setCopied(true)).catch(() => setShowLink(true));
  }

  async function withGoogle() {
    setBusy(true);
    setError(null);
    try {
      const supabase = createAppBrowserClient();
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
        },
      });
      if (error) throw error;
      // The browser is now navigating to Google; leave the button disabled.
    } catch (e) {
      setError(readable(e));
      setBusy(false);
    }
  }

  function goIdentify() {
    setMode("identify");
    setError(null);
    setNotice(null);
  }

  function continueWithIdentifier() {
    const parsed = parseIdentifier(raw);
    if (!parsed) {
      setError("Enter an email address or a 10-digit Indian mobile number.");
      return;
    }
    setId(parsed);
    setError(null);
    setNotice(null);
    setPassword("");
    setMode("password");
  }

  async function signInWithPassword(who: Identifier) {
    const supabase = createAppBrowserClient();
    const { error } = await supabase.auth.signInWithPassword({ email: who.email, password });
    if (error) throw error;
    setMode("done");
    router.push(next);
    router.refresh();
  }

  async function createAccount() {
    if (!id) return;
    if (password.length < 8) {
      setError("Use a password of at least 8 characters.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/email-signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier: raw, password }),
      });
      if (res.status === 409) {
        // Already has an account: ask for that password instead.
        setMode("login");
        setPassword("");
        setNotice(
          `You already have a Cheatcode account with this ${id.kind === "phone" ? "number" : "email"}. Enter its password to sign in.`,
        );
        setBusy(false);
        return;
      }
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? "Couldn't create the account. Try again in a moment.");
      }
      await signInWithPassword(id);
    } catch (e) {
      setError(readable(e));
      setBusy(false);
    }
  }

  async function logIn() {
    if (!id) return;
    setBusy(true);
    setError(null);
    try {
      await signInWithPassword(id);
    } catch (e) {
      setError(readable(e));
      setBusy(false);
    }
  }

  const field =
    "w-full rounded-xl border border-ink-15 px-4 py-3 text-[16px] outline-none focus:border-ink-30 sm:text-[0.95rem]";

  const heading =
    mode === "identify"
      ? "Sign up with email or phone"
      : mode === "password"
        ? "Create your password"
        : mode === "login"
          ? "Enter your password"
          : mode === "done"
            ? "You're in"
            : "Sign in to Cheatcode";

  const sub =
    mode === "identify"
      ? "Step 1 of 2 — your email or mobile number. New or returning, start here."
      : mode === "password"
        ? `Step 2 of 2 — a password for ${id?.display}. At least 8 characters.`
        : mode === "login"
          ? `Signing in as ${id?.display}.`
          : mode === "done"
            ? "Taking you to Cheatcode…"
            : "New here or coming back, it is the same screen — either way in creates the account on first use.";

  return (
    // Width is the card's job — this sits inside one on the sign-in page.
    <div className="w-full">
      <h1 className="text-[1.7rem] font-semibold leading-tight tracking-[-0.03em]">{heading}</h1>
      <p className="mt-2.5 text-[0.92rem] leading-relaxed text-ink-50">{sub}</p>

      {notice && !error && (
        <p className="mt-5 rounded-xl bg-ink-04 p-3.5 text-[0.85rem] leading-relaxed text-ink-70">
          {notice}
        </p>
      )}

      {error && (
        <p className="mt-5 rounded-xl border border-ink-30 p-3.5 text-[0.85rem] leading-relaxed">
          {error}
        </p>
      )}

      {mode === "choose" && inApp && (
        <div className="mt-7 space-y-3">
          <p className="rounded-xl bg-ink-04 p-3.5 text-[0.84rem] leading-relaxed text-ink-70">
            You&apos;re in {inApp.app}&apos;s browser, where Google sign-in doesn&apos;t work. Sign up
            with your email or phone number instead — it takes two steps.
          </p>
          <button
            type="button"
            onClick={goIdentify}
            disabled={busy}
            className="w-full rounded-full bg-ink px-5 py-3 text-[0.92rem] font-medium text-paper disabled:opacity-40"
          >
            Continue with email / phone number
          </button>
          <button
            type="button"
            onClick={openInBrowser}
            className="w-full rounded-full border border-ink-15 px-5 py-3 text-[0.92rem] text-ink-70"
          >
            {inApp.android
              ? "Open in Chrome to use Google"
              : copied
                ? "Link copied — paste it in Safari"
                : "Copy link to use Google in Safari"}
          </button>
          {showLink && (
            <input
              readOnly
              value={typeof window === "undefined" ? "" : window.location.href}
              onFocus={(e) => e.currentTarget.select()}
              className="w-full rounded-xl border border-ink-15 px-3 py-2.5 text-[16px] text-ink-50"
            />
          )}
        </div>
      )}

      {mode === "choose" && !inApp && (
        <div className="mt-7 space-y-3">
          <button
            type="button"
            onClick={() => void withGoogle()}
            disabled={busy}
            className="flex w-full items-center justify-center gap-3 rounded-full bg-ink px-5 py-3 text-[0.92rem] font-medium text-paper transition-transform hover:scale-[1.01] active:scale-[0.99] disabled:opacity-40"
          >
            <GoogleMark />
            Continue with Google
          </button>
          <button
            type="button"
            onClick={goIdentify}
            disabled={busy}
            className="w-full rounded-full border border-ink-15 px-5 py-3 text-[0.92rem] text-ink-70 transition-colors hover:border-ink-30 disabled:opacity-40"
          >
            Continue with email / phone number
          </button>
        </div>
      )}

      {mode === "identify" && (
        <form
          className="mt-7 space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            continueWithIdentifier();
          }}
        >
          <input
            autoFocus
            type="text"
            name="username"
            autoComplete="username"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            value={raw}
            onChange={(e) => setRaw(e.target.value)}
            placeholder="you@example.com or 98765 43210"
            className={field}
          />
          <button
            type="submit"
            disabled={!raw.trim()}
            className="w-full rounded-full bg-ink px-5 py-3 text-[0.92rem] font-medium text-paper disabled:opacity-40"
          >
            Continue
          </button>
          <button
            type="button"
            onClick={() => {
              setMode("choose");
              setError(null);
            }}
            className="w-full text-[0.85rem] text-ink-30 underline underline-offset-4 hover:text-ink"
          >
            Sign in with Google instead
          </button>
        </form>
      )}

      {(mode === "password" || mode === "login") && (
        <form
          className="mt-7 space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            void (mode === "password" ? createAccount() : logIn());
          }}
        >
          {/* The email or number as a hidden field, so password managers save the pair. */}
          <input type="text" name="username" autoComplete="username" value={raw} readOnly hidden />
          <div className="relative">
            <input
              autoFocus
              type={showPassword ? "text" : "password"}
              name="password"
              autoComplete={mode === "password" ? "new-password" : "current-password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={mode === "password" ? "At least 8 characters" : "Your password"}
              className={`${field} pr-16`}
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[0.8rem] text-ink-30 hover:text-ink"
            >
              {showPassword ? "Hide" : "Show"}
            </button>
          </div>
          <button
            type="submit"
            disabled={busy || password.length < (mode === "password" ? 8 : 1)}
            className="w-full rounded-full bg-ink px-5 py-3 text-[0.92rem] font-medium text-paper disabled:opacity-40"
          >
            {busy
              ? mode === "password"
                ? "Creating your account…"
                : "Signing in…"
              : mode === "password"
                ? "Create account"
                : "Sign in"}
          </button>
          <button
            type="button"
            onClick={() => {
              setMode("identify");
              setPassword("");
              setError(null);
              setNotice(null);
            }}
            className="w-full text-[0.85rem] text-ink-30 underline underline-offset-4 hover:text-ink"
          >
            Use a different email or number
          </button>
        </form>
      )}

      {/*
        There is no separate sign-up page with different rules. Every way in
        creates the account on first use, so "Sign up" and "Sign in" are the
        same screen; /signup only opens it at the email/phone step.
      */}
      <p className="mt-8 text-[0.78rem] leading-relaxed text-ink-30">
        We store your resume so you can come back to it — you can delete it at any time, and it
        is never shown to anyone else.
      </p>
    </div>
  );
}

/** Supabase's errors are written for developers. These are for people. */
function readable(e: unknown): string {
  const raw = e instanceof Error ? e.message : String(e);
  if (/invalid login credentials/i.test(raw)) {
    return "That password doesn't match. If you first signed up with Google, use \"Continue with Google\" in Chrome or Safari instead.";
  }
  if (/email logins are disabled|email provider/i.test(raw)) {
    return "Password sign-in isn't switched on yet. Enable it in Supabase under Authentication → Providers → Email.";
  }
  if (/provider is not enabled|Unsupported provider/i.test(raw)) {
    return "That sign-in method isn't switched on yet in Supabase. Enable it under Authentication → Providers.";
  }
  if (/rate|too many/i.test(raw)) {
    return "Too many attempts. Wait a minute and try again.";
  }
  return raw;
}

function GoogleMark() {
  return (
    <svg width="17" height="17" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.1H42V20H24v8h11.3C33.7 32.7 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.05 6.05 29.3 4 24 4 12.95 4 4 12.95 4 24s8.95 20 20 20 20-8.95 20-20c0-1.3-.14-2.65-.4-3.9z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.65 15.1 18.95 12 24 12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.05 6.05 29.3 4 24 4 16.3 4 9.65 8.35 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.85-1.95 13.4-5.2l-6.2-5.2C29.15 35.1 26.7 36 24 36c-5.25 0-9.65-3.3-11.3-7.9l-6.5 5C9.5 39.55 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.1H42V20H24v8h11.3c-.8 2.2-2.2 4.15-4.1 5.6l6.2 5.2C37 40.2 44 35 44 24c0-1.3-.14-2.65-.4-3.9z" />
    </svg>
  );
}
