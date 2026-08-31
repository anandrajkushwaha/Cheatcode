"use client";

import { useState } from "react";
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
    "w-full rounded-xl border border-ink-15 px-4 py-3 text-[0.95rem] outline-none focus:border-ink-30";

  return (
    <div className="w-full max-w-sm">
      <h1 className="text-[1.7rem] font-semibold leading-tight tracking-[-0.03em]">
        {mode === "otp" ? "Enter the code" : "Sign in to Cheatcode"}
      </h1>
      <p className="mt-2.5 text-[0.92rem] leading-relaxed text-ink-50">
        {mode === "otp"
          ? `We sent a six-digit code to ${e164}.`
          : "Your resume, your matches, and your sessions — all in one place."}
      </p>

      {error && (
        <p className="mt-5 rounded-xl border border-ink-30 p-3.5 text-[0.85rem] leading-relaxed">
          {error}
        </p>
      )}

      {mode === "choose" && (
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
          <input
            autoFocus
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
            disabled={busy || code.length < 4}
            className="w-full rounded-full bg-ink px-5 py-3 text-[0.92rem] font-medium text-paper disabled:opacity-40"
          >
            {busy ? "Checking…" : "Sign in"}
          </button>
          <button
            type="button"
            onClick={() => { setMode("phone"); setCode(""); setError(null); }}
            className="w-full text-[0.85rem] text-ink-30 underline underline-offset-4 hover:text-ink"
          >
            Change number
          </button>
        </div>
      )}

      <p className="mt-8 text-[0.78rem] leading-relaxed text-ink-30">
        Signing in creates an account. We store your resume so you can come back to it — you can
        delete it at any time, and it is never shown to anyone else.
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
