import { RangePicker } from "@/components/admin/RangePicker";
import { Panel, Stat, BarList, Empty, num } from "@/components/admin/ui";
import { resolveRange, rangeWords } from "@/lib/admin/range";
import { byFeature, byUser, resumeTotals, sessions, totals, unattributed, usageSince } from "@/lib/admin/usage";
import { UserTable } from "@/components/admin/UserTable";

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

/**
 * A number we recorded, or an em dash for one we did not.
 *
 * The distinction this draws is the whole point: `0` is a measurement and `—`
 * is its absence, and printing the first when you mean the second is how a
 * voice conversation came to read `0 in · 0 out · $0` on this page. Nobody
 * opens a ticket about a zero.
 */
const known = (value: number, metered: number): string => (metered > 0 ? num(value) : "—");

/** The same rule for money: unmetered calls have no cost, not a free one. */
const knownUSD = (value: number, calls: number, metered: number): string =>
  calls === 0 ? "—" : metered === 0 ? "—" : USD(value);

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
  const [list, resumes, users] = await Promise.all([
    sessions(range.days, rows),
    resumeTotals(),
    byUser(rows),
  ]);
  const orphan = unattributed(rows);

  const features = byFeature(rows);
  const t = totals(rows);

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
        <Stat
          label="Input tokens"
          value={known(t.inputTokens, t.metered)}
          hint={
            t.metered < t.calls
              ? `${num(t.calls - t.metered)} of ${num(t.calls)} calls not metered`
              : "sent to the model"
          }
        />
        <Stat
          label="Output tokens"
          value={known(t.outputTokens, t.metered)}
          hint="written back"
        />
        <Stat
          label="Cost"
          value={knownUSD(t.costUsd, t.calls, t.metered)}
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
          {num(t.unpriced)} of {num(t.calls)} calls ran on a model with no rate, so the cost above
          is a floor rather than a total. Set that model&apos;s price under <b>Model prices</b> on
          the Settings screen and every future call is costed; rows already written keep the number
          they were written with, so history stays reconcilable.
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
                          {known(f.inputTokens, f.metered)} in ·{" "}
                          {known(f.outputTokens, f.metered)} out
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
          title="People"
          note={
            users.length
              ? `${num(users.length)} in this window, dearest first. Open one to see their conversations.`
              : undefined
          }
        >
          <UserTable users={users} />
        </Panel>
      </div>

      {orphan.calls > 0 && (
        <p className="mt-3 text-[0.78rem] leading-relaxed text-ink-30">
          {num(orphan.calls)} of {num(t.calls)} calls in this window belong to no conversation
          {orphan.costUsd > 0 && <> — about {USD(orphan.costUsd)} of it</>}. Some of that is
          normal: parsing an uploaded résumé happens outside any chat. If it climbs towards a
          third of everything, something has stopped passing its conversation id.
        </p>
      )}
    </>
  );
}

/* ------------------------------------------------------------------ pieces */

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
