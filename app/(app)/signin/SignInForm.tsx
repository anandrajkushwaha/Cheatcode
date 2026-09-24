"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createAppBrowserClient } from "@/lib/supabase/app-client";

/**
 * Two ways in, because the audience splits.
 *
 * Google is one tap and costs nothing, and almost every Indian student and
 * working professional already has a Gmail account. Phone OTP is the pattern
 * Naukri trained this market on, and some people simply trust it more — but
 * every message costs money and delivery is not guaranteed, so Google leads.
 */
export function SignInForm({ next }: { next: string }) {
  const router = useRouter();
  const [mode, setMode] = useState<"choose" | "phone" | "otp">("choose");
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

  const field =
    "w-full rounded-xl border border-ink-15 px-4 py-3 text-[16px] outline-none focus:border-ink-30 sm:text-[0.95rem]";

  return (
    <div className="w-full max-w-sm">
      <h1 className="text-[1.7rem] font-semibold leading-tight tracking-[-0.03em]">
        {mode === "otp" ? "Enter the code" : "Sign in to Cheatcode"}
      </h1>
      <p className="mt-2.5 text-[0.92rem] leading-relaxed text-ink-50">
        {mode === "otp"
          ? `We sent a six-digit code to ${e164}.`
          : "New here or coming back, it is the same button — signing in with Google or your number is what creates the account."}
      </p>

      {error && (
        <p className="mt-5 rounded-xl border border-ink-30 p-3.5 text-[0.85rem] leading-relaxed">
          {error}
        </p>
      )}

      {mode === "choose" && inApp && (
        <div className="mt-7 space-y-3">
          <p className="rounded-xl bg-ink-04 p-3.5 text-[0.84rem] leading-relaxed text-ink-70">
            You&apos;re in {inApp.app}&apos;s browser, where Google sign-in doesn&apos;t work. Use your
            mobile number, or open this page in {inApp.android ? "Chrome" : "Safari or Chrome"}.
          </p>
          <button
            type="button"
            onClick={() => { setMode("phone"); setError(null); }}
            disabled={busy}
            className="w-full rounded-full bg-ink px-5 py-3 text-[0.92rem] font-medium text-paper disabled:opacity-40"
          >
            Continue with mobile number
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
