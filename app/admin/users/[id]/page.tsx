import Link from "next/link";
import { RangePicker } from "@/components/admin/RangePicker";
import { Panel, Stat, Empty, num } from "@/components/admin/ui";
import { SessionTable } from "@/components/admin/SessionTable";
import { resolveRange, rangeWords } from "@/lib/admin/range";
import { byUser, sessionsForUser, usageSince } from "@/lib/admin/usage";

export const dynamic = "force-dynamic";

/**
 * One person, in full.
 *
 * The list answers "who costs money"; this answers "and what did they get for
 * it". Same window, same single read of `ai_usage` as the dashboard, so the
 * numbers here and the row you clicked cannot disagree.
 *
 * Deliberately not a new query per figure. Everything on this page is grouped
 * in memory from the rows in the window, which is a few milliseconds at these
 * volumes and means there is exactly one definition of every number.
 */

const USD = (n: number) => (n === 0 ? "$0" : n < 0.01 ? `$${n.toFixed(4)}` : `$${n.toFixed(2)}`);
const INR_PER_USD = 88;

export default async function AdminUser({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ range?: string; from?: string; to?: string }>;
}) {
  const { id } = await params;
  const range = resolveRange(await searchParams);
  const usage = await usageSince(range.days);

  if (!usage.ok) {
    return (
      <p className="rounded-xl border border-ink-15 px-4 py-3 text-[0.82rem] text-ink-50">
        Usage cannot be read yet — run <code>supabase/schemas/{usage.missing}</code>.
      </p>
    );
  }

  const { rows } = usage.data;
  const users = await byUser(rows);
  const person = users.find((u) => u.userId === id);
  const list = await sessionsForUser(range.days, rows, id);

  return (
    <>
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-3">
        <div className="min-w-0">
          <Link
            href="/admin"
            className="text-[0.76rem] text-ink-30 underline-offset-2 hover:underline"
          >
            ← All people
          </Link>
          <h1 className="mt-1 truncate text-xl font-semibold tracking-[-0.03em] sm:text-2xl">
            {person?.name || person?.email || "This person"}
          </h1>
          <p className="mt-1 text-[0.78rem] text-ink-30">
            {person?.email && person?.name ? `${person.email} · ` : ""}
            <code className="text-[0.72rem]">{id}</code>
          </p>
          <p className="mt-1 text-[0.82rem] text-ink-30">{rangeWords(range)}</p>
        </div>
        <RangePicker basePath={`/admin/users/${id}`} range={range} />
      </div>

      {!person ? (
        <p className="mt-6 rounded-xl border border-ink-15 px-4 py-3 text-[0.82rem] text-ink-50">
          Nothing recorded for this person in this window. Widen the range, or they have not used
          the agent yet.
        </p>
      ) : (
        <>
          <div className="mt-6 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3 xl:grid-cols-6">
            <Stat
              label="Cost"
              value={person.metered ? `₹${num(Math.round(person.costUsd * INR_PER_USD))}` : "—"}
              hint={person.metered ? USD(person.costUsd) : "nothing metered"}
            />
            <Stat label="Model calls" value={person.calls} hint={`${num(person.sessions)} conversations`} />
            <Stat
              label="Voice"
              value={person.voiceSeconds > 0 ? `${Math.round(person.voiceSeconds / 60)}m` : "—"}
              hint="spoken minutes"
            />
            <Stat
              label="Input tokens"
              value={person.metered ? num(person.inputTokens) : "—"}
              hint="sent to the model"
            />
            <Stat
              label="Output tokens"
              value={person.metered ? num(person.outputTokens) : "—"}
              hint="written back"
            />
            <Stat
              label="Résumés"
              value={person.resumes}
              hint={`${num(person.downloads)} downloads · ${num(person.shared)} shared`}
            />
          </div>

          {person.unpriced > 0 && (
            <p className="mt-3 text-[0.78rem] leading-relaxed text-ink-30">
              {num(person.unpriced)} of {num(person.calls)} calls ran on a model with no rate, so
              the cost above is a floor rather than a total. Set that model&apos;s price on{" "}
              <Link href="/admin/settings" className="underline underline-offset-2">
                Settings
              </Link>{" "}
              and future calls will be costed.
            </p>
          )}

          <div className="mt-6">
            <Panel title="What they used it for">
              {person.features.length === 0 ? (
                <Empty>Nothing recorded.</Empty>
              ) : (
                <ul className="divide-y divide-ink-08 text-[0.82rem]">
                  {person.features.map((f) => (
                    <li key={f.feature} className="flex items-baseline justify-between py-2">
                      <span>{f.label}</span>
                      <span className="tabular-nums text-ink-50">
                        {num(f.calls)} {f.calls === 1 ? "call" : "calls"}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          </div>

          <div className="mt-6">
            <Panel
              title="Their conversations"
              note={
                list.length
                  ? `${num(list.filter((s) => s.resume).length)} of ${num(list.length)} produced a résumé.`
                  : undefined
              }
            >
              <SessionTable rows={list} />
            </Panel>
          </div>
        </>
      )}
    </>
  );
}
