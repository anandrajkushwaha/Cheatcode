"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { EVENTS, track } from "@/lib/analytics/events";
import { buyUnlock } from "@/components/studio/buyUnlock";

/**
 * After the resume downloads: the jobs it genuinely fits, behind a small price.
 *
 * The moment somebody has a finished resume is the moment they are about to
 * leave — the resume was the whole errand. This makes it the start of the
 * next one: real postings, scored against what they just wrote
 * (lib/jobs/match.ts), with the company and apply link held back until they
 * unlock one job (₹49) or every match for 7 days (₹99). Pro sees all.
 *
 * The data is fetched while the PDF is being built (Builder), so the popup
 * opens the instant the file lands. Nothing is shown when nothing genuinely
 * fits — an empty promise is worse than no popup.
 */

export type MatchesData = {
  count: number;
  all: boolean;
  passUntil: string | null;
  prices: { job: number; pass: number; passDays: number };
  top: {
    id: string;
    title: string;
    score: number;
    matched: string[];
    locked: boolean;
    company: string | null;
    where: string | null;
    applyUrl: string | null;
  }[];
};

export function MatchesPopup({ initial, onClose }: { initial: MatchesData; onClose: () => void }) {
  const [data, setData] = useState<MatchesData>(initial);
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const best = Math.max(...data.top.map((j) => j.score));

  useEffect(() => {
    track(EVENTS.BUILDER_STEP, { label: "matches_shown", count: initial.count, best });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const key = (e: KeyboardEvent) => e.key === "Escape" && !busy && onClose();
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [onClose, busy]);

  const reload = useCallback(async () => {
    const j = (await fetch("/api/app/jobs/matches").then((r) => r.json()).catch(() => null)) as
      | (MatchesData & { ok?: boolean })
      | null;
    if (j?.ok) setData(j);
  }, []);

  async function buy(kind: "job" | "pass", jobId?: string) {
    setBusy(jobId ?? kind);
    setNote(null);
    const r = await buyUnlock(kind, jobId);
    if (r.ok) {
      await reload();
      setNote(kind === "pass" ? "Unlocked — every match is yours for 7 days." : "Unlocked — apply now while it’s fresh.");
    } else if (!r.cancelled) setNote(r.error ?? "That didn’t go through.");
    setBusy(null);
  }

  const n = data.count;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center" role="dialog" aria-modal="true">
      <button type="button" aria-label="Close" className="absolute inset-0 cursor-default" onClick={() => !busy && onClose()} />
      <div className="relative max-h-[94dvh] w-full overflow-y-auto rounded-t-[1.75rem] bg-paper p-6 shadow-2xl sm:max-w-[32rem] sm:rounded-[1.75rem] sm:p-8">
        <p className="text-[0.8rem] font-medium text-[#1a7f37]">✓ Resume downloaded</p>
        <h2 className="mt-2 text-[1.6rem] font-semibold leading-[1.15] tracking-[-0.03em]">
          You’re a <span className="text-[#c2410c]">{best}% match</span> for {n} {n === 1 ? "job" : "jobs"} hiring right now
        </h2>
        <p className="mt-2 text-[0.92rem] leading-relaxed text-ink-50">
          {n === 1 ? "This company is" : "These companies are"} asking for the skills on your resume. Apply while the
          posting is fresh — before the pile builds up.
        </p>

        <ul className="mt-5 space-y-2.5">
          {data.top.map((j) => (
            <li key={j.id} className="rounded-2xl border border-ink-08 p-3.5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-[0.92rem] font-semibold">{j.title}</p>
                  {j.locked ? (
                    <p className="mt-0.5 select-none text-[0.8rem] text-ink-50">
                      <span className="inline-block rounded bg-ink-08 px-1.5 blur-[3px]" aria-hidden>
                        Hidden Company Pvt
                      </span>{" "}
                      <span className="sr-only">Company hidden until unlocked.</span>· {j.matched.join(", ")}
                    </p>
                  ) : (
                    <p className="mt-0.5 truncate text-[0.8rem] text-ink-50">
                      {j.company} · {j.where}
                    </p>
                  )}
                </div>
                <span className="shrink-0 rounded-full bg-[#e7f6ec] px-2.5 py-1 text-[0.76rem] font-semibold tabular-nums text-[#1a7f37]">
                  {j.score}%
                </span>
              </div>
              {j.locked ? (
                <button
                  type="button"
                  disabled={Boolean(busy)}
                  onClick={() => void buy("job", j.id)}
                  className="mt-3 w-full rounded-full border border-ink-15 py-2 text-[0.82rem] font-medium transition-colors hover:border-ink disabled:opacity-50"
                >
                  {busy === j.id ? "Opening payment…" : `Unlock & apply · ₹${data.prices.job}`}
                </button>
              ) : (
                j.applyUrl && (
                  <a
                    href={j.applyUrl}
                    target="_blank"
                    rel="noopener noreferrer nofollow"
                    onClick={() => track(EVENTS.BUILDER_STEP, { label: "matches_apply_click", score: j.score })}
                    className="mt-3 flex w-full items-center justify-center rounded-full bg-ink py-2 text-[0.82rem] font-medium text-paper"
                  >
                    Apply now ↗
                  </a>
                )
              )}
            </li>
          ))}
        </ul>

        {note && <p className="mt-4 rounded-xl bg-ink-04 p-3 text-[0.84rem]">{note}</p>}

        {data.all ? (
          <Link
            href="/app/jobs?for=me"
            className="mt-6 flex w-full items-center justify-center rounded-full bg-ink px-5 py-3.5 text-[0.95rem] font-medium text-paper"
          >
            See all {n} matching jobs →
          </Link>
        ) : (
          <>
            <button
              type="button"
              disabled={Boolean(busy)}
              onClick={() => void buy("pass")}
              className="mt-6 w-full rounded-full bg-[#c2410c] px-5 py-4 text-[1rem] font-semibold text-white shadow-[0_10px_30px_-10px_rgba(194,65,12,0.7)] transition-transform hover:scale-[1.01] disabled:opacity-60"
            >
              {busy === "pass" ? "Opening payment…" : `Unlock all ${n} matches · ₹${data.prices.pass}`}
            </button>
            <p className="mt-2 text-center text-[0.76rem] text-ink-30">
              {data.prices.passDays} days · new matches included · one-time, no auto-renew
            </p>
            <Link href="/app/upgrade" className="mt-3 block text-center text-[0.8rem] text-ink-50 underline underline-offset-4 hover:text-ink">
              Or go Pro — every match, unlimited applications & AI coach
            </Link>
          </>
        )}

        <button type="button" disabled={Boolean(busy)} onClick={onClose} className="mt-3 w-full text-[0.8rem] text-ink-30 hover:text-ink">
          Maybe later
        </button>
      </div>
    </div>
  );
}
