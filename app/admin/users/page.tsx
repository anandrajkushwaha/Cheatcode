import Link from "next/link";
import { Stat, Empty, num } from "@/components/admin/ui";
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

function day(iso: string) {
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Kolkata",
  });
}

export default async function AdminPeople() {
  const people = await getPeople();

  if (!people.ok) {
    return (
      <p className="rounded-xl border border-ink-15 px-4 py-3 text-[0.82rem] text-ink-50">
        Accounts cannot be read yet — run <code>supabase/schemas/{people.missing}</code>.
      </p>
    );
  }

  const { rows, total, last7, paid, truncated, repaired } = people.data;

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
        <div className="mt-6 rounded-2xl border border-ink-08 p-6">
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

      <div className="mt-6 rounded-2xl border border-ink-08 p-6">
        {!rows.length ? (
          <Empty>Nobody has signed in yet.</Empty>
        ) : (
          <div className="-mx-2 overflow-x-auto">
            <table className="w-full min-w-[40rem] text-left text-[0.84rem]">
              <thead className="text-[0.7rem] uppercase tracking-[0.12em] text-ink-30">
                <tr>
                  <th className="px-2 pb-2 font-medium">Person</th>
                  <th className="px-2 pb-2 font-medium">Contact</th>
                  <th className="px-2 pb-2 font-medium">Joined</th>
                  <th className="px-2 pb-2 font-medium">Came from</th>
                  <th className="px-2 pb-2 text-right font-medium">Résumés</th>
                  <th className="px-2 pb-2 text-right font-medium">Downloads</th>
                  <th className="px-2 pb-2 font-medium">Plan</th>
                </tr>
              </thead>
              <tbody className="tabular-nums">
                {rows.map((p) => (
                  <tr key={p.id} className="border-t border-ink-08">
                    <td className="max-w-[16rem] px-2 py-2.5">
                      <Link
                        href={`/admin/users/${p.id}`}
                        className="block truncate underline-offset-4 hover:underline"
                      >
                        {/* A person with no name is not anonymous — they are
                            identified by whatever they signed in with. Showing
                            the handle here rather than a dash means the row is
                            still a person you can recognise and contact. */}
                        {p.name ?? p.handle}
                      </Link>
                    </td>
                    <td className="max-w-[14rem] px-2 py-2.5 text-ink-50">
                      <span className="block truncate">{p.email ?? p.phone ?? "—"}</span>
                    </td>
                    <td className="whitespace-nowrap px-2 py-2.5 text-ink-50">{day(p.joinedAt)}</td>
                    <td className="max-w-[12rem] px-2 py-2.5 text-ink-50">
                      <span className="block truncate" title={p.campaign ?? undefined}>
                        {p.source ?? "—"}
                        {p.campaign ? ` · ${p.campaign}` : ""}
                      </span>
                    </td>
                    <td className="px-2 py-2.5 text-right text-ink-50">{num(p.drafts)}</td>
                    <td className="px-2 py-2.5 text-right font-medium">{num(p.downloads)}</td>
                    <td className="px-2 py-2.5">
                      {p.plan === "free" ? (
                        <span className="text-ink-30">free</span>
                      ) : (
                        <span className="rounded-full border border-ink-15 px-2 py-0.5 text-[0.72rem]">
                          {p.plan} · {p.planStatus}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {truncated && (
          <p className="mt-4 text-[0.78rem] text-ink-30">
            Showing the most recent {num(rows.length)}. There are more.
          </p>
        )}
      </div>
    </>
  );
}
