"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createAppBrowserClient } from "@/lib/supabase/app-client";

type Mode = "choose" | "phone" | "otp" | "email" | "password" | "login" | "done";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/**
 * Three ways in, because the audience splits.
 *
 * Google is one tap and costs nothing, and almost every Indian student and
 * working professional already has a Gmail account. Email and a password is
 * the way in that works everywhere — above all inside Instagram and
 * Facebook, where Google refuses to sign anybody in, which is exactly where
 * people tapping a Meta ad land. Phone OTP stays for those who trust it.
 *
 * The email path is two short steps: the address, then a password. New
 * addresses get an account created on the spot (no confirmation email to
 * chase from inside a webview); an address that already has one is asked
 * for its password instead.
 */
export function SignInForm({ next, initialMode = "choose" }: { next: string; initialMode?: "choose" | "email" }) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>(initialMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [inApp, setInApp] = useState<null | { app: string; android: boolean }>(null);
  const [copied, setCopied] = useState(false);
  const [showLink, setShowLink] = useState(false);
  const [resendIn, setResendIn] = useState(0);

  /*
   * Instagram, Facebook and other apps open links in their own browser, and
   * Google refuses to sign anybody in there ("disallowed_useragent"). People
   * arriving from a Meta ad land exactly there, press "Continue with Google",
   * get an error page from Google, and leave — never becoming an account, so
   * they never showed up in the admin either. So in those browsers the phone
   * number is offered first, and there is a way out to the real browser.
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

  // Counts down after a code is sent, so "Resend" cannot be hammered.
  useEffect(() => {
    if (resendIn <= 0) return;
    const id = window.setTimeout(() => setResendIn((n) => n - 1), 1000);
    return () => window.clearTimeout(id);
  }, [resendIn]);

  function openInBrowser() {
    const url = window.location.href;
    if (inApp?.android) {
      // Chrome on Android honours an intent: link from inside the app.
      window.location.href = `intent://${url.replace(/^https?:\/\//, "")}#Intent;scheme=https;package=com.android.chrome;end`;
      return;
    }
    // iOS has no way to force it, and in a WKWebView navigator.clipboard is
    // often missing entirely — the old code called it optionally, so nothing
    // was copied and nothing said so. Show the link to copy by hand instead.
    const copy = navigator.clipboard?.writeText(url);
    if (!copy) {
      setShowLink(true);
      return;
    }
    void copy.then(() => setCopied(true)).catch(() => setShowLink(true));
  }

  // Supabase wants E.164. Indians type "98765 43210", so accept that and add +91.
  const e164 = (() => {
    const digits = phone.replace(/\D/g, "");
    if (digits.length === 10) return `+91${digits}`;
    if (digits.length === 12 && digits.startsWith("91")) return `+${digits}`;
    return null;
  })();

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

  async function sendCode() {
    if (!e164) {
      setError("That doesn't look like a 10-digit Indian mobile number.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const supabase = createAppBrowserClient();
      const { error } = await supabase.auth.signInWithOtp({ phone: e164 });
      if (error) throw error;
      setMode("otp");
    } catch (e) {
      setError(readable(e));
    } finally {
      setBusy(false);
    }
  }

  async function verifyCode() {
    if (!e164) return;
    setBusy(true);
    setError(null);
    try {
      const supabase = createAppBrowserClient();
      const { error } = await supabase.auth.verifyOtp({
        phone: e164,
        token: code.trim(),
        type: "sms",
      });
      if (error) throw error;
      router.push(next);
      router.refresh();
    } catch (e) {
      setError(readable(e));
      setBusy(false);
    }
  }

  function continueWithEmail() {
    const clean = email.trim().toLowerCase();
    if (!EMAIL_RE.test(clean)) {
      setError("That doesn't look like an email address.");
      return;
    }
    setEmail(clean);
    setError(null);
    setNotice(null);
    setPassword("");
    setMode("password");
  }

  async function signInWithPassword() {
    const supabase = createAppBrowserClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    setMode("done");
    router.push(next);
    router.refresh();
  }

  async function createAccount() {
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
        body: JSON.stringify({ email, password }),
      });
      if (res.status === 409) {
        // The address already has an account: ask for that password instead.
        setMode("login");
        setPassword("");
        setNotice("You already have a Cheatcode account with this email. Enter its password to sign in.");
        setBusy(false);
        return;
      }
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? "Couldn't create the account. Try again in a moment.");
      }
      await signInWithPassword();
    } catch (e) {
      setError(readable(e));
      setBusy(false);
    }
  }

  async function logIn() {
    setBusy(true);
    setError(null);
    try {
      await signInWithPassword();
    } catch (e) {
      setError(readable(e));
      setBusy(false);
    }
  }

  const field =
    "w-full rounded-xl border border-ink-15 px-4 py-3 text-[16px] outline-none focus:border-ink-30 sm:text-[0.95rem]";

  return (
    // Width is the card's job now — this sits inside one on the sign-in page.
    <div className="w-full">
      <h1 className="text-[1.7rem] font-semibold leading-tight tracking-[-0.03em]">
        {mode === "otp"
          ? "Enter the code"
          : mode === "email"
            ? "Sign up with email"
            : mode === "password"
              ? "Create your password"
              : mode === "login"
                ? "Enter your password"
                : mode === "done"
                  ? "You're in"
                  : "Sign in to Cheatcode"}
      </h1>
      <p className="mt-2.5 text-[0.92rem] leading-relaxed text-ink-50">
        {mode === "otp"
          ? `We sent a six-digit code to ${e164}.`
          : mode === "email"
            ? "Step 1 of 2 — your email. New or returning, start here."
            : mode === "password"
              ? `Step 2 of 2 — a password for ${email}. At least 8 characters.`
              : mode === "login"
                ? `Signing in as ${email}.`
                : mode === "done"
                  ? "Taking you to Cheatcode…"
                  : "New here or coming back, it is the same screen — Google, email or your number all create the account on first use."}
      </p>

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
            with your email instead — it takes two steps.
          </p>
          <button
            type="button"
            onClick={() => { setMode("email"); setError(null); }}
            disabled={busy}
            className="w-full rounded-full bg-ink px-5 py-3 text-[0.92rem] font-medium text-paper disabled:opacity-40"
          >
            Continue with email
          </button>
          <button
            type="button"
            onClick={() => { setMode("phone"); setError(null); }}
            disabled={busy}
            className="w-full rounded-full border border-ink-15 px-5 py-3 text-[0.92rem] text-ink-70 disabled:opacity-40"
          >
            Use my mobile number
          </button>
          <button
            type="button"
            onClick={openInBrowser}
            className="w-full rounded-full border border-ink-15 px-5 py-3 text-[0.92rem] text-ink-70"
          >
            {inApp.android ? "Open in Chrome" : copied ? "Link copied — paste it in Safari" : "Copy link to open in Safari"}
          </button>
          {showLink && (
            <input
              readOnly
              value={typeof window === "undefined" ? "" : window.location.href}
              onFocus={(e) => e.currentTarget.select()}
              className="w-full rounded-xl border border-ink-15 px-3 py-2.5 text-[16px] text-ink-50"
            />
          )}
          {!inApp.android && (
            <p className="text-center text-[0.76rem] text-ink-30">
              Or tap ••• at the top and choose &ldquo;Open in browser&rdquo;.
            </p>
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
            onClick={() => { setMode("email"); setError(null); }}
            disabled={busy}
            className="w-full rounded-full border border-ink-15 px-5 py-3 text-[0.92rem] text-ink-70 transition-colors hover:border-ink-30 disabled:opacity-40"
          >
            Continue with email
          </button>

          <button
            type="button"
            onClick={() => { setMode("phone"); setError(null); }}
            disabled={busy}
            className="w-full rounded-full border border-ink-15 px-5 py-3 text-[0.92rem] text-ink-70 transition-colors hover:border-ink-30 disabled:opacity-40"
          >
            Use my mobile number
          </button>
        </div>
      )}

      {mode === "phone" && (
        <div className="mt-7 space-y-3">
          <div className="flex items-center gap-2">
            <span className="rounded-xl border border-ink-15 px-3.5 py-3 text-[0.95rem] text-ink-50">
              +91
            </span>
            <input
              autoFocus
              inputMode="numeric"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && void sendCode()}
              placeholder="98765 43210"
              className={field}
            />
          </div>
          <button
            type="button"
            onClick={() => void sendCode()}
            disabled={busy || !e164}
            className="w-full rounded-full bg-ink px-5 py-3 text-[0.92rem] font-medium text-paper disabled:opacity-40"
          >
            {busy ? "Sending…" : "Send code"}
          </button>
          <button
            type="button"
            onClick={() => { setMode("choose"); setError(null); }}
            className="w-full text-[0.85rem] text-ink-30 underline underline-offset-4 hover:text-ink"
          >
            Back
          </button>
        </div>
      )}

      {mode === "email" && (
        <form
          className="mt-7 space-y-3"
          onSubmit={(e) => { e.preventDefault(); continueWithEmail(); }}
        >
          <input
            autoFocus
            type="email"
            name="email"
            autoComplete="email"
            inputMode="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className={field}
          />
          <button
            type="submit"
            disabled={!email.trim()}
            className="w-full rounded-full bg-ink px-5 py-3 text-[0.92rem] font-medium text-paper disabled:opacity-40"
          >
            Continue
          </button>
          <button
            type="button"
            onClick={() => { setMode("choose"); setError(null); }}
            className="w-full text-[0.85rem] text-ink-30 underline underline-offset-4 hover:text-ink"
          >
            Other ways to sign in
          </button>
        </form>
      )}

      {(mode === "password" || mode === "login") && (
        <form
          className="mt-7 space-y-3"
          onSubmit={(e) => { e.preventDefault(); void (mode === "password" ? createAccount() : logIn()); }}
        >
          {/* The address as a hidden field, so password managers save the pair. */}
          <input type="email" name="email" autoComplete="username" value={email} readOnly hidden />
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
              ? mode === "password" ? "Creating your account…" : "Signing in…"
              : mode === "password" ? "Create account" : "Sign in"}
          </button>
          <button
            type="button"
            onClick={() => { setMode("email"); setPassword(""); setError(null); setNotice(null); }}
            className="w-full text-[0.85rem] text-ink-30 underline underline-offset-4 hover:text-ink"
          >
            Use a different email
          </button>
        </form>
      )}

      {mode === "otp" && (
        <div className="mt-7 space-y-3">
          {/* type=tel + one-time-code is what makes iOS offer the SMS code
              above the keyboard; without it everybody types six digits. */}
          <input
            autoFocus
            type="tel"
            name="otp"
            autoComplete="one-time-code"
            inputMode="numeric"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
            onKeyDown={(e) => e.key === "Enter" && void verifyCode()}
            placeholder="123456"
            className={`${field} text-center text-[1.3rem] tracking-[0.4em]`}
          />
          <button
            type="button"
            onClick={() => void verifyCode()}
            disabled={busy || code.length < 6}
            className="w-full rounded-full bg-ink px-5 py-3 text-[0.92rem] font-medium text-paper disabled:opacity-40"
          >
            {busy ? "Checking…" : "Sign in"}
          </button>
          <div className="flex items-center justify-between gap-4 pt-1">
            <button
              type="button"
              onClick={() => { setMode("phone"); setCode(""); setError(null); }}
              className="text-[0.85rem] text-ink-30 underline underline-offset-4 hover:text-ink"
            >
              Change number
            </button>
            {/* An SMS that never arrives used to mean starting over. */}
            <button
              type="button"
              disabled={busy || resendIn > 0}
              onClick={() => void sendCode()}
              className="text-[0.85rem] text-ink-30 underline underline-offset-4 hover:text-ink disabled:no-underline disabled:opacity-60"
            >
              {resendIn > 0 ? `Resend in ${resendIn}s` : "Resend code"}
            </button>
          </div>
        </div>
      )}

      {/*
        There is no separate sign-up page and there should not be one. Google
        and phone OTP both create the account on first use, so a "Sign up"
        screen would be this screen with a different heading — and two doors
        into one room is how people end up certain they already have an
        account when they do not, or the reverse. Every "Sign up" button on
        the site points here; this line is what makes that make sense.
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
    return "That password doesn't match this email. If you first signed up with Google, use \"Continue with Google\" in Chrome or Safari instead.";
  }
  if (/email logins are disabled|email provider/i.test(raw)) {
    return "Email sign-in isn't switched on yet. Enable it in Supabase under Authentication → Providers → Email.";
  }
  if (/provider is not enabled|Unsupported provider/i.test(raw)) {
    return "That sign-in method isn't switched on yet in Supabase. Enable it under Authentication → Providers.";
  }
  if (/sms|twilio|messagebird|phone provider/i.test(raw)) {
    return "SMS isn't configured yet, so codes can't be sent. Use Google for now.";
  }
  if (/invalid|expired|token/i.test(raw)) {
    return "That code didn't work. Check the digits, or ask for a new one.";
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
