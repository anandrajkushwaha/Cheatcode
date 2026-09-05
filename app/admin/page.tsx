import { RangePicker } from "@/components/admin/RangePicker";
import { Panel, Stat, BarList, Empty, num } from "@/components/admin/ui";
import { resolveRange, rangeWords, IST } from "@/lib/admin/range";
import { byFeature, resumeTotals, sessions, totals, usageSince } from "@/lib/admin/usage";
import type { SessionRow } from "@/lib/admin/usage";

export const dynamic = "force-dynamic";

/**
 * What people use, what it costs, and whether it worked.
 *
 * Three questions, in that order, because that is the order they get asked and
 * because the third is the one nothing was answering. Spend on its own says the
 * agent is running; a résumé that was shared and downloaded says it was worth
 * running. A dashboard that stops at the invoice is a dashboard about us.
 *
 * Everything here is derived from one read of `ai_usage` for the window, so
 * every number on the page is the same window and the totals really are the
 * sum of the rows. Four aggregate queries would be faster to write and would
 * eventually disagree with each other.
 */

const USD = (n: number) =>
  n === 0 ? "$0" : n < 0.01 ? `$${n.toFixed(4)}` : `$${n.toFixed(2)}`;

/** Roughly, and labelled as roughly. The stored figure is dollars. */
const INR_PER_USD = 88;

function ist(iso: string) {
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: IST,
  }).format(new Date(iso));
}

export default async function AdminDashboard({
  searchParams,
}: {
  searchParams: Promise<{ range?: string; from?: string; to?: string }>;
}) {
  const range = resolveRange(await searchParams);
  const usage = await usageSince(range.days);

  if (!usage.ok) {
    return (
      <Setup
        missing={usage.missing}
        title={
          usage.missing === "SUPABASE_SECRET_KEY"
            ? "Supabase isn't connected"
            : "One database change hasn't been run"
        }
      />
    );
  }

  const { rows, capped } = usage.data;
  const [list, resumes] = await Promise.all([sessions(range.days, rows), resumeTotals()]);

  const features = byFeature(rows);
  const t = totals(rows);
  const downloadedInWindow = list.filter((s) => (s.resume?.downloads ?? 0) > 0).length;
  const producedResume = list.filter((s) => s.resume).length;

  return (
    <>
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-3">
        <div>
          <h1 className="text-xl font-semibold tracking-[-0.03em] sm:text-2xl">Dashboard</h1>
          <p className="mt-1 text-[0.82rem] text-ink-30">{rangeWords(range)}</p>
        </div>
        <RangePicker basePath="/admin" range={range} />
      </div>

      {capped && (
        <p className="mt-4 rounded-xl border border-ink-15 px-4 py-3 text-[0.82rem] text-ink-50">
          This window has more than 20,000 model calls. Everything below is the most recent
          20,000 — a sample, not a total. Narrow the range for figures you can quote.
        </p>
      )}

      {resumes.missing && (
        <p className="mt-4 rounded-xl border border-ink-15 px-4 py-3 text-[0.82rem] text-ink-50">
          Downloads and résumé links are blank until{" "}
          <code className="rounded bg-ink-04 px-1.5 py-0.5">
            supabase/schemas/{resumes.missing}
          </code>{" "}
          has been run.
        </p>
      )}

      {/* ------------------------------------------------------------ the row */}
      <div className="mt-6 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3 xl:grid-cols-6">
        <Stat label="Agent sessions" value={list.length} hint="conversations started" />
        <Stat label="Model calls" value={t.calls} hint={`${num(t.people)} people`} />
        <Stat label="Input tokens" value={t.inputTokens} hint="sent to the model" />
        <Stat label="Output tokens" value={t.outputTokens} hint="written back" />
        <Stat
          label="Cost"
          value={USD(t.costUsd)}
          hint={
            t.unpriced
              ? `≈ ₹${Math.round(t.costUsd * INR_PER_USD)} · ${num(t.unpriced)} unpriced`
              : `≈ ₹${Math.round(t.costUsd * INR_PER_USD)}`
          }
        />
        <Stat
          label="Downloads"
          value={resumes.downloads}
          hint={`${num(resumes.shared)} résumés shared`}
        />
      </div>

      {t.unpriced > 0 && (
        <p className="mt-3 text-[0.78rem] leading-relaxed text-ink-30">
          {num(t.unpriced)} of {num(t.calls)} calls ran on a model with no rate in{" "}
          <code>lib/app/ai-cost.ts</code>, so the cost above is an understatement rather than a
          total. Adding the rate there fixes every future row; rows already written keep the
          number they were written with.
        </p>
      )}

      {/* --------------------------------------------------------- what's used */}
      <div className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <Panel
          title="What gets used"
          note="Every model call in the window, by feature. This is the ranking you asked for."
        >
          <BarList
            rows={features.map((f) => ({
              label: f.label,
              value: f.calls,
              sub: `${USD(f.costUsd)}${f.unpriced ? " +" : ""} · ${num(f.users)} ${
                f.users === 1 ? "person" : "people"
              }`,
            }))}
            empty="No model calls in this window."
            unit="calls"
          />
        </Panel>

        <Panel
          title="Tokens by feature"
          note="Input and output separately — they are priced differently, and a feature that reads a lot is a different problem from one that writes a lot."
        >
          {features.length === 0 ? (
            <Empty>Nothing yet.</Empty>
          ) : (
            (() => {
              /**
               * One scale across every row.
               *
               * The first version of this panel normalised each bar to its own
               * total, so all five ran the full width and the panel said
               * nothing — every feature is roughly 97% input, so every bar
               * looked identical. Bars that do not share a scale cannot be
               * compared, which is the whole job of a bar.
               */
              const biggest = Math.max(
                1,
                ...features.map((f) => f.inputTokens + f.outputTokens),
              );

              return (
                <ul className="space-y-3">
                  {features.map((f) => {
                    const total = f.inputTokens + f.outputTokens;
                    const width = (total / biggest) * 100;
                    const inShare = total ? (f.inputTokens / total) * 100 : 0;
                    return (
                      <li key={String(f.feature)}>
                        <div className="flex items-baseline justify-between gap-3 text-[0.8rem]">
                          <span className="min-w-0 truncate">{f.label}</span>
                          <span className="shrink-0 tabular-nums text-ink-50">{num(total)}</span>
                        </div>
                        {/* One hue, two shades: input is the darker because it
                            is the bigger half and the one people are surprised
                            by. A second colour would imply the two halves are
                            different kinds of thing. */}
                        <div className="mt-1.5 h-2 rounded-full bg-ink-04">
                          <div className="flex h-full overflow-hidden rounded-full" style={{ width: `${width}%` }}>
                            <span className="bg-ink-30" style={{ width: `${inShare}%` }} aria-hidden />
                            <span
                              className="ml-[2px] flex-1 bg-ink-08"
                              aria-hidden
                            />
                          </div>
                        </div>
                        <p className="mt-1 text-[0.72rem] text-ink-30">
                          {num(f.inputTokens)} in · {num(f.outputTokens)} out
                        </p>
                      </li>
                    );
                  })}
                </ul>
              );
            })()
          )}
        </Panel>
      </div>

      {/* ------------------------------------------------------------ sessions */}
      <div className="mt-6">
        <Panel
          title="Agent sessions"
          note={
            list.length
              ? `${num(producedResume)} of ${num(list.length)} produced a résumé; ${num(
                  downloadedInWindow,
                )} of those were downloaded.`
              : undefined
          }
        >
          {list.length === 0 ? (
            <Empty>No conversations in this window.</Empty>
          ) : (
            <>
              {/* Desktop: one row per session. */}
              <div className="-mx-2 hidden overflow-x-auto md:block">
                <table className="w-full min-w-[900px] text-left text-[0.8rem]">
                  <thead>
                    <tr className="text-[0.7rem] uppercase tracking-[0.1em] text-ink-30">
                      <Th>Started</Th>
                      <Th>User</Th>
                      <Th right>Calls</Th>
                      <Th right>In</Th>
                      <Th right>Out</Th>
                      <Th right>Cost</Th>
                      <Th>Model</Th>
                      <Th>Résumé</Th>
                      <Th>Downloaded</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {list.map((s) => (
                      <tr key={s.sessionId} className="border-t border-ink-08 align-top">
                        <Td>
                          <span className="whitespace-nowrap">{ist(s.startedAt)}</span>
                          {s.channel && (
                            <span className="ml-2 text-[0.7rem] text-ink-30">{s.channel}</span>
                          )}
                        </Td>
                        <Td>
                          <User row={s} />
                        </Td>
                        <Td right>{num(s.calls)}</Td>
                        <Td right>{num(s.inputTokens)}</Td>
                        <Td right>{num(s.outputTokens)}</Td>
                        <Td right>
                          {s.calls === 0 ? "—" : USD(s.costUsd)}
                          {s.unpriced > 0 && <span className="text-ink-30"> +</span>}
                        </Td>
                        <Td>
                          <span className="text-[0.74rem] text-ink-50">
                            {s.models.length ? s.models.join(", ") : "—"}
                          </span>
                        </Td>
                        <Td>
                          <ResumeCell row={s} />
                        </Td>
                        <Td>
                          <Downloaded row={s} />
                        </Td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Phone: the same rows as cards. Not a squeezed table — nine
                  columns at 380px is unreadable however hard it is styled. */}
              <ul className="space-y-3 md:hidden">
                {list.map((s) => (
                  <li key={s.sessionId} className="rounded-xl border border-ink-08 p-4">
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="text-[0.78rem] text-ink-50">{ist(s.startedAt)}</span>
                      <span className="text-[0.78rem] tabular-nums">
                        {s.calls === 0 ? "—" : USD(s.costUsd)}
                      </span>
                    </div>
                    <div className="mt-2">
                      <User row={s} />
                    </div>
                    <dl className="mt-3 grid grid-cols-3 gap-2 text-[0.74rem]">
                      <Cell k="Calls" v={num(s.calls)} />
                      <Cell k="In" v={num(s.inputTokens)} />
                      <Cell k="Out" v={num(s.outputTokens)} />
                    </dl>
                    <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[0.76rem]">
                      <ResumeCell row={s} />
                      <Downloaded row={s} />
                    </div>
                  </li>
                ))}
              </ul>
            </>
          )}
        </Panel>
      </div>
    </>
  );
}

/* ------------------------------------------------------------------ pieces */

function Th({ children, right }: { children: React.ReactNode; right?: boolean }) {
  return (
    <th className={`px-2 pb-2 font-medium ${right ? "text-right" : ""}`}>{children}</th>
  );
}

function Td({ children, right }: { children: React.ReactNode; right?: boolean }) {
  return (
    <td className={`px-2 py-2.5 ${right ? "text-right tabular-nums" : ""}`}>{children}</td>
  );
}

function Cell({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <dt className="text-ink-30">{k}</dt>
      <dd className="tabular-nums">{v}</dd>
    </div>
  );
}

/**
 * Who it was.
 *
 * The email when there is one, and the id underneath either way — the id is
 * what you paste into a query when you need to go and look, and an email alone
 * is not enough to find a row.
 */
function User({ row }: { row: SessionRow }) {
  return (
    <span className="block min-w-0">
      <span className="block truncate text-[0.8rem]">{row.email ?? "—"}</span>
      <code className="block truncate text-[0.68rem] text-ink-30">{row.userId ?? ""}</code>
    </span>
  );
}

/**
 * The résumé, and whether the link is live.
 *
 * A share id that exists but is switched off is not a link — opening it 404s
 * on purpose. Showing it as one would send somebody to a dead page and make
 * them think the product is broken, so the two states are named differently.
 */
function ResumeCell({ row }: { row: SessionRow }) {
  if (!row.resume) return <span className="text-ink-30">—</span>;

  if (row.resume.isPublic && row.resume.shareId) {
    return (
      <a
        href={`/r/${row.resume.shareId}`}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex min-w-0 items-center gap-1 underline-offset-4 hover:underline"
      >
        <span className="truncate">{row.resume.title}</span>
        <svg viewBox="0 0 20 20" className="h-3 w-3 shrink-0 text-ink-30" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          <path d="M11 4h5v5M16 4 9 11M15 12v4H4V5h4" />
        </svg>
      </a>
    );
  }

  return (
    <span className="text-ink-50">
      <span className="truncate">{row.resume.title}</span>
      <span className="ml-1.5 text-[0.7rem] text-ink-30">not shared</span>
    </span>
  );
}

function Downloaded({ row }: { row: SessionRow }) {
  if (!row.resume) return <span className="text-ink-30">—</span>;
  if (row.resume.downloads > 0) {
    return (
      <span className="whitespace-nowrap">
        Yes
        <span className="ml-1.5 text-[0.72rem] text-ink-30">
          ×{row.resume.downloads}
          {row.resume.lastDownloadedAt ? ` · ${ist(row.resume.lastDownloadedAt)}` : ""}
        </span>
      </span>
    );
  }
  return <span className="text-ink-30">No</span>;
}

/** The one screen that has to work when the database is not ready. */
function Setup({ missing, title }: { missing: string; title: string }) {
  return (
    <div className="rounded-2xl border border-ink-08 p-6 sm:p-8">
      <h1 className="text-lg font-semibold sm:text-xl">{title}</h1>
      {missing === "SUPABASE_SECRET_KEY" ? (
        <p className="mt-3 max-w-[62ch] text-[0.9rem] leading-relaxed text-ink-50">
          Add <code>NEXT_PUBLIC_SUPABASE_URL</code> and <code>SUPABASE_SECRET_KEY</code> in Vercel →
          Settings → Environment Variables, then redeploy. Every figure on this page is read with
          the service key, so there is nothing to show without it.
        </p>
      ) : (
        <p className="mt-3 max-w-[62ch] text-[0.9rem] leading-relaxed text-ink-50">
          Run <code className="rounded bg-ink-04 px-1.5 py-0.5">supabase/schemas/{missing}</code> in
          the Supabase SQL editor. Nothing else on the site depends on it — this page is the only
          thing that reads that table.
        </p>
      )}
    </div>
  );
}
