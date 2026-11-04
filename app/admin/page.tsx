import { RangePicker } from "@/components/admin/RangePicker";
import { LiveCount } from "@/components/admin/LiveCount";
import { DashboardView } from "./DashboardView";
import { getOverview } from "@/lib/admin/overview";
import { LIVE_MINUTES, getLive } from "@/lib/admin/live";
import { rangeWords, resolveRange } from "@/lib/admin/range";

export const dynamic = "force-dynamic";

/**
 * The Dashboard: the whole business for one period, next to the period before
 * it — visitors, sign-ups, ATS checks, résumé downloads and revenue, the
 * funnel between them, where people came from, what they read, what just
 * happened and what needs a reply. Each card links to the screen with the
 * detail. What the AI costs moved to /admin/ai.
 */

const DAY_FMT = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "short",
  timeZone: "Asia/Kolkata",
});
const TIME_FMT = new Intl.DateTimeFormat("en-IN", {
  hour: "numeric",
  minute: "2-digit",
  timeZone: "Asia/Kolkata",
});

/** "4 Nov, 12:00 am – 4:45 pm" within one day; "29 Oct – 4 Nov" across days (India time). */
function span(fromIso: string, toIso: string) {
  const from = new Date(fromIso);
  // The end is exclusive: the last moment shown is just before it.
  const to = new Date(new Date(toIso).getTime() - 1);
  const d1 = DAY_FMT.format(from);
  const d2 = DAY_FMT.format(to);
  if (d1 === d2)
    return `${d1}, ${TIME_FMT.format(from)} – ${TIME_FMT.format(new Date(toIso))}`;
  return `${d1} – ${d2}`;
}

function beforeWord(id: string) {
  if (id === "today") return "yesterday by now";
  if (id === "24h") return "in the 24 hours before";
  if (id === "7d") return "in the 7 days before";
  if (id === "28d") return "in the 28 days before";
  if (id === "90d") return "in the 90 days before";
  return "in the period before";
}

export default async function AdminDashboard({
  searchParams,
}: {
  searchParams: Promise<{ range?: string; from?: string; to?: string }>;
}) {
  const sp = await searchParams;
  const range = resolveRange({ ...sp, range: sp.range ?? "today" });
  const [result, liveRes] = await Promise.all([getOverview(range), getLive()]);
  const live = liveRes.ok
    ? { count: liveRes.count, sessions: liveRes.sessions }
    : null;

  const hour = Number(
    new Intl.DateTimeFormat("en-IN", {
      hour: "numeric",
      hourCycle: "h23",
      timeZone: "Asia/Kolkata",
    }).format(new Date()),
  );
  const greeting =
    hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[1.6rem] font-semibold tracking-[-0.04em]">
            {greeting}
          </h1>
          <p className="mt-1 text-[0.85rem] text-ink-50">
            Here&apos;s how Cheatcode did {rangeWords(range)}.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <LiveCount initial={live} minutes={LIVE_MINUTES} />
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <RangePicker basePath="/admin" range={range} />
        {result.ok && (
          <p className="rounded-full bg-paper px-3.5 py-1.5 text-[0.76rem] text-ink-50 ring-1 ring-ink-08">
            <span className="font-medium text-ink">
              {span(result.data.period.from, result.data.period.to)}
            </span>
            <span className="mx-1.5 text-ink-30">vs</span>
            {span(result.data.period.prevFrom, result.data.period.prevTo)}
          </p>
        )}
      </div>

      {!result.ok ? (
        <p className="rounded-xl border border-ink-15 px-4 py-3 text-[0.82rem] text-ink-50">
          Couldn&apos;t read the numbers: {result.error}
        </p>
      ) : (
        <DashboardView data={result.data} beforeWord={beforeWord(range.id)} />
      )}
    </div>
  );
}
