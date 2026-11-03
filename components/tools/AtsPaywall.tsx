"use client";

import { RazorpayStrip } from "@/components/studio/RazorpayStrip";

/**
 * The second check of the day: the resume has been read and scored on the
 * server, but the result stays there until the ₹49 unlock. Behind the card
 * is a placeholder report — invented bars and blank lines, never the real
 * score, which has not been sent to this page at all.
 */

export function AtsPaywall({
  busy,
  note,
  onUnlock,
  onAnother,
}: {
  busy: boolean;
  note: string | null;
  onUnlock: () => void;
  onAnother: () => void;
}) {
  return (
    <div className="relative">
      {/* placeholder report, blurred: shape only, no real data */}
      <div aria-hidden="true" className="pointer-events-none select-none blur-[6px]">
        <div className="rounded-3xl border border-ink-08 p-8 sm:p-12">
          <p className="text-[0.72rem] uppercase tracking-[0.16em] text-ink-30">ATS score</p>
          <p className="mt-2 text-[4.5rem] font-semibold leading-none tracking-[-0.05em] text-ink-15">
            ••<span className="text-[1.6rem]">/100</span>
          </p>
          <div className="mt-10 grid gap-x-10 gap-y-5 sm:grid-cols-2">
            {[62, 40, 85, 30, 55].map((w, i) => (
              <div key={i}>
                <div className="h-3 w-32 rounded bg-ink-08" />
                <div className="mt-2 h-1 rounded-full bg-ink-08">
                  <div className="h-full rounded-full bg-ink-15" style={{ width: `${w}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="mt-10 space-y-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="rounded-2xl border border-ink-08 p-6">
              <div className="h-4 w-2/3 rounded bg-ink-08" />
              <div className="mt-3 h-3 w-full rounded bg-ink-04" />
              <div className="mt-2 h-3 w-5/6 rounded bg-ink-04" />
            </div>
          ))}
        </div>
      </div>

      {/* the card */}
      <div className="absolute inset-x-0 top-6 flex justify-center px-2 sm:top-16">
        <div
          role="dialog"
          aria-labelledby="ats-paywall-title"
          className="w-full max-w-[24rem] rounded-3xl border border-ink-08 bg-paper p-6 text-center shadow-[0_30px_80px_-30px_rgba(0,0,0,0.35)] sm:p-7"
        >
          <p className="text-[0.78rem] font-semibold text-[#1a7f37]">✓ Your report is ready</p>
          <h2 id="ats-paywall-title" className="mt-2 text-[1.45rem] font-semibold leading-tight tracking-[-0.03em]">
            Is your resume getting rejected before anyone reads it?
          </h2>
          <p className="mt-2 text-[0.9rem] leading-relaxed text-ink-50">
            Your score and the exact fixes are one tap away.
          </p>

          <ul className="mx-auto mt-5 max-w-[17rem] space-y-2 text-left text-[0.88rem]">
            <li className="flex gap-2.5">
              <span className="text-[#1a7f37]">✓</span> Your ATS score out of 100
            </li>
            <li className="flex gap-2.5">
              <span className="text-[#1a7f37]">✓</span> What gets your resume filtered out
            </li>
            <li className="flex gap-2.5">
              <span className="text-[#1a7f37]">✓</span> Exactly how to fix each one
            </li>
            <li className="flex gap-2.5">
              <span className="text-[#1a7f37]">✓</span> Unlimited checks after this
            </li>
          </ul>

          <button
            type="button"
            onClick={onUnlock}
            disabled={busy}
            data-ev="cta_click"
            data-ev-location="ats-paywall"
            data-ev-label="See my score ₹49"
            className="mt-6 w-full rounded-full bg-ink py-3.5 text-[0.98rem] font-semibold text-paper transition-transform duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] hover:scale-[1.02] active:scale-[0.98] disabled:opacity-60"
          >
            {busy ? "Opening…" : "See my score · ₹49"}
          </button>
          <p className="mt-2 text-[0.74rem] text-ink-30">One-time payment · No subscription</p>
          {note && <p className="mt-3 text-[0.8rem] text-ink-70">{note}</p>}

          <RazorpayStrip className="mt-4" />

          <button type="button" onClick={onAnother} className="mt-4 text-[0.78rem] text-ink-30 underline underline-offset-4 hover:text-ink">
            Not now — your free check renews tomorrow
          </button>
        </div>
      </div>
    </div>
  );
}
