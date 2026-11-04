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

export default async function AdminDashboard({
  searchParams,
}: {
  searchParams: Promise<{ range?: string; from?: string; to?: string }>;
}) {
  const sp = await searchParams;
  const range = resolveRange({ ...sp, range: sp.range ?? "7d" });
  const [result, liveRes] = await Promise.all([getOverview(range), getLive()]);
  const live = liveRes.ok ? { count: liveRes.count, sessions: liveRes.sessions } : null;

  const hour = Number(new Intl.DateTimeFormat("en-IN", { hour: "numeric", hourCycle: "h23", timeZone: "Asia/Kolkata" }).format(new Date()));
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[1.6rem] font-semibold tracking-[-0.04em]">{greeting}</h1>
          <p className="mt-1 text-[0.85rem] text-ink-50">Here&apos;s how Cheatcode did {rangeWords(range)}, against the period before.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <LiveCount initial={live} minutes={LIVE_MINUTES} />
        </div>
      </div>
      <RangePicker basePath="/admin" range={range} />

      {!result.ok ? (
        <p className="rounded-xl border border-ink-15 px-4 py-3 text-[0.82rem] text-ink-50">Couldn&apos;t read the numbers: {result.error}</p>
      ) : (
        <DashboardView data={result.data} />
      )}
    </div>
  );
}
