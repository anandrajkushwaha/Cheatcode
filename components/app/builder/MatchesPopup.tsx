"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { EVENTS, track, visitorId } from "@/lib/analytics/events";
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
 *
 * The same popup follows the free ATS check (`ats`), where the jobs were
 * matched in the browser and the person may not be signed in. Then an unlock
 * signs them in first and continues on `continueHref` (the same jobs on
 * /app/jobs), and the events are recorded under the browser's visitor id with
 * the contact block the checker read — all in /admin/match-popup.
 */

export type AtsMode = {
  continueHref: string;
  contact: { name: string | null; email: string | null; phone: string | null } | null;
};

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

/** Recorded for /admin/match-popup. Fire and forget. */
function send(ats: AtsMode | undefined, event: string, extra: { jobId?: string; props?: Record<string, unknown> } = {}) {
  void fetch("/api/app/funnel/popup", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ event, ...extra, ...(ats ? { source: "ats", visitor: visitorId(), contact: ats.contact } : {}) }),
    keepalive: true,
  }).catch(() => {});
}

export function MatchesPopup({
  initial,
  onClose: close,
  ats,
}: {
  initial: MatchesData;
  onClose: () => void;
  ats?: AtsMode;
}) {
  const log = useCallback((event: string, extra?: { jobId?: string; props?: Record<string, unknown> }) => send(ats, event, extra), [ats]);
  // ATS: null until we know whether they are signed in.
  const [signedIn, setSignedIn] = useState<boolean | null>(ats ? null : true);
  const [openedAt] = useState(() => Date.now());
  const onClose = useCallback(() => {
    log("closed", { props: { ms: Date.now() - openedAt } });
    close();
  }, [close, openedAt, log]);
  const [data, setData] = useState<MatchesData>(initial);
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const best = Math.max(...data.top.map((j) => j.score));

  useEffect(() => {
    track(EVENTS.BUILDER_STEP, { label: "matches_shown", count: initial.count, best });
    log("shown", { props: { count: initial.count, best, jobs: initial.top.map((j) => j.id) } });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const key = (e: KeyboardEvent) => e.key === "Escape" && !busy && onClose();
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [onClose, busy]);

  const reload = useCallback(async () => {
    if (ats) {
      // Matched in the browser: ask which of these jobs they have opened.
      const ids = initial.top.map((j) => j.id).join(",");
      const r = await fetch(`/api/app/unlock/jobs?ids=${ids}`).catch(() => null);
      if (!r || r.status === 401) return setSignedIn(false);
      const j = (await r.json().catch(() => null)) as
        | { ok?: boolean; all?: boolean; passUntil?: string | null; jobs?: { id: string; locked: boolean; company: string | null; applyUrl: string | null }[] }
        | null;
      setSignedIn(true);
      if (!j?.ok) return;
      const byId = new Map((j.jobs ?? []).map((x) => [x.id, x]));
      setData((d) => ({
        ...d,
        all: Boolean(j.all),
        passUntil: j.passUntil ?? null,
        top: d.top.map((t) => {
          const x = byId.get(t.id);
          return x ? { ...t, locked: x.locked, company: x.company, applyUrl: x.applyUrl } : t;
        }),
      }));
      return;
    }
    const j = (await fetch("/api/app/jobs/matches").then((r) => r.json()).catch(() => null)) as
      | (MatchesData & { ok?: boolean })
      | null;
    if (j?.ok) setData(j);
  }, [ats, initial.top]);

  // ATS: find out up front whether they are signed in (and what is already open).
  useEffect(() => {
    if (ats) void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function buy(kind: "job" | "pass", jobId?: string) {
    log(kind === "pass" ? "pass_click" : "unlock_click", { jobId, props: { count: data.count } });
    if (ats && !signedIn) {
      // A payment needs an account: sign in, then the same jobs, to unlock there.
      window.location.assign(`/signin?next=${encodeURIComponent(ats.continueHref)}`);
      return;
    }
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
  const perDay = Math.round(data.prices.pass / data.prices.passDays);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/55 sm:items-center" role="dialog" aria-modal="true">
      <button type="button" aria-label="Close" className="absolute inset-0 cursor-default" onClick={() => !busy && onClose()} />
      <div className="relative max-h-[94dvh] w-full overflow-y-auto rounded-t-[1.75rem] bg-paper p-6 shadow-2xl sm:max-w-[30rem] sm:rounded-[1.75rem] sm:p-7">
        <p className="text-[0.82rem] font-semibold text-[#1a7f37]">{ats ? "✓ ATS check done" : "✓ Your resume is ready"}</p>
        <h2 className="mt-2 text-[1.75rem] font-bold leading-[1.12] tracking-[-0.03em]">
          {n === 1 ? "1 company wants" : `${n} companies want`} someone with{" "}
          <span className="text-[#c2410c]">your skills</span>
        </h2>
        <p className="mt-3 inline-flex items-center gap-2 rounded-full bg-[#e7f6ec] px-3 py-1 text-[0.82rem] font-semibold text-[#14532d]">
          Your resume matches {best}% of what they want
        </p>
        <p className="mt-3 text-[0.95rem] leading-relaxed text-ink-70">
          Don’t miss it. Apply early, before others do — it takes 1 minute.
        </p>

        <ul className="mt-5 space-y-3">
          {data.top.map((j) => (
            <li key={j.id} className="rounded-2xl border-2 border-ink-08 p-4">
              <div className="flex items-center justify-between gap-2">
                <span className="rounded-full bg-[#e7f6ec] px-2.5 py-1 text-[0.76rem] font-bold tabular-nums text-[#1a7f37]">
                  {j.score}% match
                </span>
                {j.where && <span className="truncate text-[0.78rem] text-ink-50">📍 {j.where}</span>}
              </div>
              <p className="mt-2.5 text-[1rem] font-semibold leading-snug">{j.title}</p>
              {j.locked ? (
                <p className="mt-1 flex items-center gap-1.5 text-[0.82rem] text-ink-50">
                  <span aria-hidden>🔒</span>
                  <span className="inline-block select-none rounded bg-ink-08 px-1.5 blur-[3px]" aria-hidden>
                    Hidden Company Pvt
                  </span>
                  <span className="sr-only">Company name hidden until unlocked.</span>
                </p>
              ) : (
                <p className="mt-1 text-[0.85rem] font-medium text-ink-70">{j.company}</p>
              )}
              {j.matched.length > 0 && (
                <p className="mt-2 text-[0.78rem] text-ink-50">
                  They want: {j.matched.map((m) => `✓ ${m}`).join("  ")}
                </p>
              )}
              {j.locked ? (
                <button
                  type="button"
                  disabled={Boolean(busy)}
                  onClick={() => void buy("job", j.id)}
                  className="mt-3.5 w-full rounded-full bg-ink py-3 text-[0.92rem] font-semibold text-paper transition-opacity hover:opacity-90 disabled:opacity-50"
                >
                  {busy === j.id ? "Opening payment…" : `See company & apply · ₹${data.prices.job}`}
                </button>
              ) : (
                j.applyUrl && (
                  <a
                    href={j.applyUrl}
                    target="_blank"
                    rel="noopener noreferrer nofollow"
                    onClick={() => {
                      track(EVENTS.BUILDER_STEP, { label: "matches_apply_click", score: j.score });
                      log("apply_click", { jobId: j.id, props: { score: j.score } });
                    }}
                    className="mt-3.5 flex w-full items-center justify-center rounded-full bg-[#1a7f37] py-3 text-[0.92rem] font-semibold text-white"
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
            href={ats ? ats.continueHref : "/app/jobs?for=me"}
            onClick={() => log("see_all_click")}
            className="mt-6 flex w-full items-center justify-center rounded-full bg-ink px-5 py-3.5 text-[0.95rem] font-medium text-paper"
          >
            See all {n} matching jobs →
          </Link>
        ) : (
          <div className="mt-6 rounded-2xl bg-[#fff4ec] p-4">
            <button
              type="button"
              disabled={Boolean(busy)}
              onClick={() => void buy("pass")}
              className="w-full rounded-full bg-[#c2410c] px-5 py-4 text-[1.02rem] font-bold text-white shadow-[0_10px_30px_-10px_rgba(194,65,12,0.7)] transition-transform hover:scale-[1.01] disabled:opacity-60"
            >
              {busy === "pass"
                ? "Opening payment…"
                : n > 1
                  ? `Unlock all ${n} jobs · ₹${data.prices.pass}`
                  : `This job + every new match · ₹${data.prices.pass}`}
            </button>
            <p className="mt-2 text-center text-[0.8rem] font-medium text-[#7a3412]">
              Just ₹{perDay} a day · {data.prices.passDays} days · new matches included
            </p>
            <p className="mt-0.5 text-center text-[0.72rem] text-ink-30">
              {ats && signedIn === false ? "Free account needed · " : ""}One-time payment. No auto-renew.
            </p>
          </div>
        )}

        {!data.all && (
          <Link href="/app/upgrade" onClick={() => log("pro_click")} className="mt-3 block text-center text-[0.8rem] text-ink-50 underline underline-offset-4 hover:text-ink">
            Or go Pro — every match, unlimited applications & AI coach
          </Link>
        )}
        <button type="button" disabled={Boolean(busy)} onClick={onClose} className="mt-3 w-full text-[0.8rem] text-ink-30 hover:text-ink">
          Maybe later
        </button>
      </div>
    </div>
  );
}
