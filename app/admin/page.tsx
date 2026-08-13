import Link from "next/link";
import { getAdminStats, getPublishLog, getAnalytics, getScheduledPosts } from "@/lib/queries/admin";
import { SeedButton } from "@/components/admin/SeedButton";

function Stat({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div className="rounded-2xl border border-ink-08 p-6">
      <p className="text-[0.72rem] uppercase tracking-[0.14em] text-ink-30">{label}</p>
      <p className="mt-3 text-[2rem] font-semibold leading-none tracking-[-0.04em]">{value}</p>
      {hint && <p className="mt-2 text-[0.78rem] text-ink-30">{hint}</p>}
    </div>
  );
}


function MiniBars({
  title, rows, empty, href,
}: {
  title: string;
  rows: { label: string; value: number }[];
  empty: string;
  href: string;
}) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <div>
      <div className="flex items-baseline justify-between gap-4">
        <h2 className="text-[0.72rem] font-medium uppercase tracking-[0.16em] text-ink-30">
          {title}
        </h2>
        <Link href={href} className="text-[0.75rem] text-ink-30 underline-offset-4 hover:text-ink hover:underline">
          all
        </Link>
      </div>
      {rows.length === 0 ? (
        <p className="mt-4 text-[0.85rem] text-ink-30">{empty}</p>
      ) : (
        <ul className="mt-5 space-y-2.5">
          {rows.map((r) => (
            <li key={r.label} className="flex items-center gap-3">
              <span className="w-[52%] shrink-0 truncate text-[0.85rem]">{r.label}</span>
              <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-ink-08">
                <span className="block h-full rounded-full bg-ink"
                  style={{ width: `${(r.value / max) * 100}%` }} />
              </span>
              <span className="w-8 shrink-0 text-right text-[0.8rem] tabular-nums text-ink-50">
                {r.value}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default async function AdminOverview() {
  const [s, log, traffic, scheduled] = await Promise.all([
    getAdminStats(),
    getPublishLog(8),
    getAnalytics(7),
    getScheduledPosts(3),
  ]);

  if (!s.configured) {
    return (
      <div className="rounded-2xl border border-ink-08 p-8">
        <h1 className="text-xl font-semibold">Supabase isn&apos;t connected</h1>
        <p className="mt-3 max-w-[60ch] text-[0.95rem] leading-relaxed text-ink-50">
          Add <code>NEXT_PUBLIC_SUPABASE_URL</code> and <code>SUPABASE_SECRET_KEY</code> in
          Vercel → Settings → Environment Variables, then redeploy.
        </p>
      </div>
    );
  }

  const daysLeft = Math.floor(s.queuePending / 6);

  return (
    <>
      <h1 className="text-2xl font-semibold tracking-[-0.03em]">Overview</h1>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label="Articles live"
          value={s.postsLive}
          hint={`${s.postsLast7} published in the last 7 days`}
        />
        <Stat
          label="Scheduled ahead"
          value={s.postsScheduled}
          hint={
            scheduled[0]
              ? `next: ${new Intl.DateTimeFormat("en-IN", {
                  day: "numeric", month: "short", hour: "numeric", minute: "2-digit",
                  hour12: true, timeZone: "Asia/Kolkata",
                }).format(new Date(scheduled[0].published_at as string))} IST`
              : "nothing waiting"
          }
        />
        <Stat
          label="Visitors (7d)"
          value={traffic.error ? "—" : traffic.visitors}
          hint={traffic.error ? "tracking not set up" : `${traffic.views.toLocaleString("en-IN")} page views`}
        />
        <Stat
          label="Queue remaining"
          value={s.queuePending}
          hint={`≈ ${daysLeft} days at 6/day`}
        />
        <Stat label="Waitlist signups" value={s.waitlist} />
        <Stat
          label="Articles written"
          value={s.posts}
          hint={`${s.postsLive} live · ${s.postsScheduled} waiting`}
        />
        <Stat
          label="Avg article"
          value={`${s.avgWords.toLocaleString("en-IN")} w`}
          hint={`quality score ${s.avgQuality}/100`}
        />
      </div>

      <div className="mt-6">
        <SeedButton hasPosts={s.posts > 0} />
      </div>

      {s.queueFailed > 0 && (
        <div className="mt-6 rounded-2xl border border-ink-30 p-5">
          <p className="text-[0.9rem] font-medium">
            {s.queueFailed} queue {s.queueFailed === 1 ? "row is" : "rows are"} stuck or failed
          </p>
          <p className="mt-1.5 text-[0.85rem] text-ink-50">
            A claimed row that never published usually means the scheduled session errored
            mid-run.{" "}
            <Link href="/admin/queue?status=failed" className="underline underline-offset-4">
              Review them
            </Link>
            .
          </p>
        </div>
      )}

      {!traffic.error && (
        <section className="mt-14 grid gap-10 lg:grid-cols-2">
          <MiniBars
            title="Most visited pages (7d)"
            href="/admin/analytics"
            rows={traffic.top_pages.slice(0, 6).map((p) => ({ label: p.path, value: p.views }))}
            empty="No page views recorded yet."
          />
          <MiniBars
            title="Where visitors came from (7d)"
            href="/admin/analytics"
            rows={traffic.top_sources.slice(0, 6).map((x) => ({ label: x.source, value: x.views }))}
            empty="No traffic recorded yet."
          />
        </section>
      )}

      <section className="mt-14 grid gap-10 lg:grid-cols-2">
        <div>
          <h2 className="text-[0.72rem] font-medium uppercase tracking-[0.16em] text-ink-30">
            Articles by topic
          </h2>
          <ul className="mt-5 space-y-3">
            {s.byCategory.map((c) => (
              <li key={c.slug} className="flex items-center gap-4">
                <span className="w-48 shrink-0 truncate text-[0.9rem]">{c.name}</span>
                <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-ink-08">
                  <span
                    className="block h-full rounded-full bg-ink"
                    style={{
                      width: `${Math.min(100, (c.count / Math.max(1, s.posts / 4)) * 100)}%`,
                    }}
                  />
                </span>
                <span className="w-8 text-right text-[0.82rem] text-ink-30">{c.count}</span>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h2 className="text-[0.72rem] font-medium uppercase tracking-[0.16em] text-ink-30">
            Recent auto-publishes
          </h2>
          {log.length === 0 ? (
            <p className="mt-5 text-[0.9rem] text-ink-50">
              Nothing yet. The scheduler writes here every 4 hours once it&apos;s switched on.
            </p>
          ) : (
            <ul className="mt-5 divide-y divide-ink-08 border-t border-ink-08">
              {log.map((l) => (
                <li key={l.id as number} className="flex items-baseline gap-3 py-3 text-[0.85rem]">
                  <span className={l.ok ? "text-ink" : "text-ink-30"}>
                    {l.ok ? "●" : "○"}
                  </span>
                  <span className="flex-1 truncate text-ink-50">
                    {l.reason ?? (l.ok ? "published" : "failed")}
                  </span>
                  <span className="shrink-0 text-[0.75rem] text-ink-30">
                    slot {l.slot ?? "—"}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </>
  );
}
