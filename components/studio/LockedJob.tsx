"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { buyUnlock } from "@/components/studio/buyUnlock";

/**
 * A job that genuinely fits their resume, held back until they unlock it —
 * the company, place and link are not on the page at all (the server left
 * them out), only the role, the fit and the skills it matched on.
 */
export function LockedJobCard({
  jobId,
  title,
  score,
  matched,
  price,
}: {
  jobId: string;
  title: string;
  score: number;
  matched: string[];
  price: number;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  return (
    <div className="rounded-2xl border border-[#f1d3bf] bg-[#fffaf6] p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h3 className="text-[1rem] font-semibold leading-snug tracking-[-0.02em]">{title}</h3>
          <p className="mt-1 select-none text-[0.85rem] text-ink-50">
            <span className="inline-block rounded bg-ink-08 px-1.5 blur-[3px]" aria-hidden>
              Hidden Company Pvt Ltd
            </span>
            <span className="sr-only">Company hidden until unlocked.</span>
          </p>
        </div>
        <span className="shrink-0 rounded-full bg-[#e7f6ec] px-2.5 py-1 text-[0.78rem] font-semibold tabular-nums text-[#1a7f37]">
          {score}% match
        </span>
      </div>
      {matched.length > 0 && (
        <p className="mt-3 text-[0.8rem] text-ink-50">Matches your: {matched.slice(0, 4).join(", ")}</p>
      )}
      <button
        type="button"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setErr(null);
          const r = await buyUnlock("job", jobId);
          if (r.ok) router.refresh();
          else if (!r.cancelled) setErr(r.error ?? "That didn’t go through.");
          setBusy(false);
        }}
        className="mt-4 rounded-full bg-ink px-4 py-2 text-[0.82rem] font-medium text-paper disabled:opacity-50"
      >
        {busy ? "Opening payment…" : `Unlock & apply · ₹${price}`}
      </button>
      {err && <p className="mt-2 text-[0.78rem] text-[#c0392b]">{err}</p>}
    </div>
  );
}

/** Every match for 7 days, in one tap. */
export function PassBanner({ count, best, price, days }: { count: number; best: number; price: number; days: number }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  return (
    <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-ink p-5 text-paper">
      <div>
        <p className="text-[1.05rem] font-semibold">
          You’re a {best}% match for {count} {count === 1 ? "job" : "jobs"} hiring now
        </p>
        <p className="mt-1 text-[0.82rem] text-[#c9c7c0]">
          Unlock every match for {days} days — new ones included. One-time, no auto-renew.
        </p>
        {err && <p className="mt-1 text-[0.78rem] text-[#ffb4a8]">{err}</p>}
      </div>
      <button
        type="button"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setErr(null);
          const r = await buyUnlock("pass");
          if (r.ok) router.refresh();
          else if (!r.cancelled) setErr(r.error ?? "That didn’t go through.");
          setBusy(false);
        }}
        className="rounded-full bg-[#ff9a4d] px-5 py-3 text-[0.9rem] font-semibold text-[#15161a] disabled:opacity-60"
      >
        {busy ? "Opening payment…" : `Unlock all ${count} · ₹${price}`}
      </button>
    </div>
  );
}
