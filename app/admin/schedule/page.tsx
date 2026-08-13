import Link from "next/link";
import { getScheduledPosts, getRecentlyPublished } from "@/lib/queries/admin";

const IST = "Asia/Kolkata";

function istDay(iso: string) {
  return new Intl.DateTimeFormat("en-IN", {
    weekday: "long", day: "numeric", month: "long", timeZone: IST,
  }).format(new Date(iso));
}

function istTime(iso: string) {
  return new Intl.DateTimeFormat("en-IN", {
    hour: "numeric", minute: "2-digit", hour12: true, timeZone: IST,
  }).format(new Date(iso));
}

function relative(iso: string) {
  const ms = new Date(iso).getTime() - Date.now();
  const mins = Math.round(ms / 60000);
  if (Math.abs(mins) < 60) return `${mins > 0 ? "in " : ""}${Math.abs(mins)} min${mins > 0 ? "" : " ago"}`;
  const hours = Math.round(mins / 60);
  if (Math.abs(hours) < 48) return `${hours > 0 ? "in " : ""}${Math.abs(hours)} hr${hours > 0 ? "" : " ago"}`;
  const days = Math.round(hours / 24);
  return `${days > 0 ? "in " : ""}${Math.abs(days)} day${Math.abs(days) === 1 ? "" : "s"}${days > 0 ? "" : " ago"}`;
}

export default async function AdminSchedule() {
  const [scheduled, recent] = await Promise.all([
    getScheduledPosts(300),
    getRecentlyPublished(8),
  ]);

  // group by IST day, preserving order
  const byDay = new Map<string, typeof scheduled>();
  for (const p of scheduled) {
    const key = istDay(p.published_at as string);
    if (!byDay.has(key)) byDay.set(key, []);
    byDay.get(key)!.push(p);
  }

  const next = scheduled[0];

  return (
    <>
      <h1 className="text-2xl font-semibold tracking-[-0.03em]">Schedule</h1>
      <p className="mt-3 max-w-[68ch] text-[0.9rem] leading-relaxed text-ink-50">
        Articles already written and sitting in the database with a future publish time.
        Each one goes live on its own — no cron job, no button. Until its time arrives it is
        invisible everywhere: not on the blog, not in the sitemap, not to Google.
      </p>

      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-ink-08 p-6">
          <p className="text-[0.72rem] uppercase tracking-[0.14em] text-ink-30">Waiting to publish</p>
          <p className="mt-3 text-[2rem] font-semibold leading-none tracking-[-0.04em]">
            {scheduled.length}
          </p>
        </div>
        <div className="rounded-2xl border border-ink-08 p-6 sm:col-span-2">
          <p className="text-[0.72rem] uppercase tracking-[0.14em] text-ink-30">Next one out</p>
          {next ? (
            <>
              <p className="mt-3 text-[1.05rem] font-medium leading-snug">{next.title as string}</p>
              <p className="mt-1.5 text-[0.85rem] text-ink-50">
                {istDay(next.published_at as string)} at {istTime(next.published_at as string)} IST
                {" · "}
                <span className="text-ink-30">{relative(next.published_at as string)}</span>
              </p>
            </>
          ) : (
            <p className="mt-3 text-[0.9rem] text-ink-50">
              Nothing scheduled. Every written article is already live.
            </p>
          )}
        </div>
      </div>

      {scheduled.length === 0 ? null : (
        <div className="mt-12 space-y-10">
          {[...byDay.entries()].map(([day, posts]) => (
            <section key={day}>
              <div className="flex items-baseline justify-between gap-4 border-b border-ink-15 pb-3">
                <h2 className="text-[0.95rem] font-medium">{day}</h2>
                <span className="text-[0.78rem] text-ink-30">
                  {posts.length} {posts.length === 1 ? "article" : "articles"}
                </span>
              </div>
              <ul className="divide-y divide-ink-08">
                {posts.map((p) => {
                  const cat = p.category as unknown as { name: string } | null;
                  return (
                    <li key={p.id as string} className="flex flex-wrap items-baseline gap-x-4 gap-y-1 py-3.5">
                      <span className="w-20 shrink-0 text-[0.85rem] tabular-nums text-ink">
                        {istTime(p.published_at as string)}
                      </span>
                      <span className="min-w-0 flex-1 text-[0.9rem]">{p.title as string}</span>
                      <span className="text-[0.78rem] text-ink-30">{cat?.name ?? "—"}</span>
                      <span className="w-20 shrink-0 text-right text-[0.78rem] text-ink-30">
                        {(p.word_count as number)?.toLocaleString("en-IN")} w
                      </span>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      )}

      <section className="mt-16">
        <h2 className="text-[0.72rem] font-medium uppercase tracking-[0.16em] text-ink-30">
          Recently published
        </h2>
        <ul className="mt-4 divide-y divide-ink-08 border-t border-ink-08">
          {recent.map((p) => (
            <li key={p.id as string} className="flex flex-wrap items-baseline gap-x-4 py-3 text-[0.88rem]">
              <span className="min-w-0 flex-1">
                <Link href={`/blog/${p.slug}`} className="underline-offset-4 hover:underline">
                  {p.title as string}
                </Link>
              </span>
              <span className="text-[0.78rem] text-ink-30">
                {relative(p.published_at as string)}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
