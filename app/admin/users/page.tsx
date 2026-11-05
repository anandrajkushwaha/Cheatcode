import { Stat, num } from "@/components/admin/ui";
import { DataTable } from "@/components/admin/DataTable";
import { RangePicker } from "@/components/admin/RangePicker";
import { resolveRange } from "@/lib/admin/range";
import { getPeople } from "@/lib/admin/people";

export const dynamic = "force-dynamic";

/**
 * Everybody who has signed in. Basic on purpose.
 *
 * The dashboard already has a people table and it is about money — cost,
 * tokens, sessions. This is the plain register that was missing: a row per
 * account, newest first, so "how many people do we have and who are they" is
 * one click rather than a query.
 *
 * A row in `profiles` is created on first sign-in, so the list *is* the
 * sign-in list and `created_at` is the moment it happened. There is no
 * last-seen column here because nothing in the product writes one — see the
 * note in lib/admin/people.ts. Résumés built and downloads taken stand in for
 * it, and they have the advantage of being true.
 */

export default async function AdminPeople({
  searchParams,
}: {
  searchParams: Promise<{ range?: string; from?: string; to?: string }>;
}) {
  const sp = await searchParams;
  const range = resolveRange({ ...sp, range: sp.range ?? "all" });
  const people = await getPeople();

  if (!people.ok) {
    return (
      <p className="rounded-xl border border-ink-15 px-4 py-3 text-[0.82rem] text-ink-50">
        Accounts cannot be read yet — run <code>supabase/schemas/{people.missing}</code>.
      </p>
    );
  }

  const { total, last7, paid, truncated, repaired } = people.data;
  // The period's accounts, by when they joined (all of them for "All time").
  const lo = range.id === "all" ? 0 : range.from ? new Date(range.from).getTime() : Date.now() - range.days * 86_400_000;
  const hi = range.to ? new Date(range.to).getTime() : Infinity;
  const rows = people.data.rows.filter((p) => {
    const t = new Date(p.joinedAt).getTime();
    return t >= lo && t < hi;
  });

  // Where accounts came from, over everybody listed.
  const bySource = new Map<string, number>();
  for (const r of rows) {
    const k = r.source ?? "not recorded";
    bySource.set(k, (bySource.get(k) ?? 0) + 1);
  }
  const sources = [...bySource.entries()].sort((a, b) => b[1] - a[1]);

  return (
    <>
      <header className="mb-8">
        <h1 className="text-[1.3rem] font-semibold tracking-[-0.03em]">People</h1>
        <p className="mt-1.5 text-[0.85rem] leading-relaxed text-ink-50">
          Everybody with an account, newest first. A row appears the first time
          somebody signs in.
        </p>
        <div className="mt-4">
          <RangePicker basePath="/admin/users" range={range} allTime />
        </div>
      </header>

      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Accounts" value={total} />
        <Stat label="New · 7 days" value={last7} />
        <Stat label="On a paid plan" value={paid} hint={total ? `${((paid / total) * 100).toFixed(1)}% of accounts` : undefined} />
      </div>

      {repaired > 0 && (
        <p className="mt-4 rounded-xl border border-ink-15 px-4 py-3 text-[0.82rem] text-ink-50">
          {repaired} {repaired === 1 ? "person had" : "people had"} signed in without an account row
          and were missing from this list. They have been added.
        </p>
      )}

      {sources.length > 0 && (
        <div className="mt-6 rounded-[1.25rem] bg-paper p-6">
          <p className="text-[0.7rem] uppercase tracking-[0.12em] text-ink-30">Where accounts came from</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {sources.map(([s, n]) => (
              <span key={s} className="rounded-full border border-ink-15 px-3 py-1 text-[0.8rem]">
                {s} <span className="tabular-nums text-ink-50">· {n}</span>
              </span>
            ))}
          </div>
          <p className="mt-3 text-[0.74rem] text-ink-30">
            Recorded from the first visit, when somebody first opens the app after signing in.
            &ldquo;not recorded&rdquo; is everyone from before this was switched on.
          </p>
        </div>
      )}

      <div className="mt-6 rounded-[1.25rem] bg-paper p-6">
        <DataTable
          name="people"
          empty="Nobody has signed in yet."
          initialSort={{ key: "joined", dir: "desc" }}
          rows={rows.map((p) => ({
            id: p.id,
            person: p.name ?? p.handle,
            href: `/admin/users/${p.id}`,
            contact: p.email ?? p.phone ?? null,
            city: p.city,
            joined: p.joinedAt,
            source: p.source,
            campaign: p.campaign,
            drafts: p.drafts,
            downloads: p.downloads,
            plan: p.plan === "free" ? "free" : `${p.plan} · ${p.planStatus}`,
          }))}
          columns={[
            { key: "person", label: "Person", href: "href", max: "max-w-[16rem]", filter: false },
            { key: "contact", label: "Contact", sub: "city", max: "max-w-[15rem]", filter: false },
            { key: "joined", label: "Joined", kind: "date" },
            { key: "source", label: "Came from", sub: "campaign", max: "max-w-[12rem]" },
            { key: "drafts", label: "Résumés", kind: "number" },
            { key: "downloads", label: "Downloads", kind: "number" },
            { key: "plan", label: "Plan", kind: "badge", tones: { free: "grey" } },
          ]}
        />
        {truncated && (
          <p className="mt-4 text-[0.78rem] text-ink-30">
            Showing the most recent {num(people.data.rows.length)}. There are more.
          </p>
        )}
      </div>
    </>
  );
}
