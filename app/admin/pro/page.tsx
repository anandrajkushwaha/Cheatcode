import { Panel, Stat, Empty } from "@/components/admin/ui";
import { getProIntent } from "@/lib/admin/pro-intent";

export const dynamic = "force-dynamic";

/**
 * Who reached for the paid plan.
 *
 * The question this answers is the one nothing in the product could answer:
 * with a plan that cannot yet be bought, is anybody trying? A count of people
 * who pressed the button is the closest thing to demand available before
 * payments are connected, and it is worth knowing before building a checkout.
 *
 * The screen deliberately shows two numbers that do not agree, and explains
 * why. The named count starts the day the table was created. The anonymous
 * one comes from analytics that never carried a user id, goes back further,
 * and can never be attributed to a person — because the same design decision
 * that makes those tables safe to keep forever is the one that makes this
 * impossible.
 */

const WHEN = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "short",
  hour: "numeric",
  minute: "2-digit",
  timeZone: "Asia/Kolkata",
});

function when(iso: string) {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : WHEN.format(d);
}

const SOURCE_LABEL: Record<string, string> = {
  header: "Header link",
  home: "Home card",
  "paid-gate": "Locked feature",
  "agent-overlay": "Agent overlay",
  "studio-home": "Studio promo",
  studio: "Studio",
  direct: "Direct",
};

export default async function AdminPro() {
  const result = await getProIntent();

  if (!result.ok) {
    return (
      <p className="rounded-xl border border-ink-15 px-4 py-3 text-[0.82rem] text-ink-50">
        Not recording yet — run <code>supabase/schemas/{result.missing}</code>.
      </p>
    );
  }

  const d = result.data;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-[1.3rem] font-semibold tracking-[-0.03em]">Pro interest</h1>
        <p className="mt-2 max-w-[70ch] text-[0.85rem] leading-relaxed text-ink-50">
          Every time a signed-in person reaches the upgrade screen. Repeat
          visits inside thirty minutes count once, so this is people reaching
          for the plan rather than page refreshes.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-4">
        <Stat label="People" value={d.people} hint="distinct accounts" />
        <Stat label="Clicks" value={d.clicks} hint="all recorded" />
        <Stat label="People, 7d" value={d.people7} hint="last week" />
        <Stat label="Clicks, 7d" value={d.clicks7} hint="last week" />
      </div>

      <Panel title="Before this was recorded">
        <p className="max-w-[70ch] text-[0.83rem] leading-relaxed text-ink-50">
          Analytics has always counted the upgrade screen, but those rows carry
          a random visitor id and no account — which is what lets the privacy
          policy say we do not tie browsing to a person. So these are real
          counts and they go back further, but nobody can be named from them.
        </p>
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <Stat
            label="Upgrade screen views"
            value={d.historical.views ?? "—"}
            hint={d.historical.views === null ? "analytics not reachable" : "all time, bots excluded"}
          />
          <Stat
            label="Link clicks to it"
            value={d.historical.linkClicks ?? "—"}
            hint={
              d.historical.linkClicks === null
                ? "analytics not reachable"
                : "all time, bots excluded"
            }
          />
        </div>
      </Panel>

      <Panel
        title="People"
        note={d.since ? `Recording since ${when(d.since)}.` : undefined}
      >
        {d.rows.length === 0 ? (
          <Empty>
            Nobody has reached the upgrade screen since recording started.
          </Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-[0.85rem]">
              <thead>
                <tr className="border-b border-ink-08 text-[0.7rem] uppercase tracking-[0.12em] text-ink-30">
                  <th className="py-2 pr-4 font-medium">Person</th>
                  <th className="py-2 pr-4 font-medium">Plan</th>
                  <th className="py-2 pr-4 font-medium tabular-nums">Times</th>
                  <th className="py-2 pr-4 font-medium">From</th>
                  <th className="py-2 pr-4 font-medium">First</th>
                  <th className="py-2 font-medium">Last</th>
                </tr>
              </thead>
              <tbody>
                {d.rows.map((p) => (
                  <tr key={p.userId} className="border-b border-ink-08 last:border-0">
                    <td className="py-2.5 pr-4">
                      <span className="block font-medium">{p.name ?? "No name"}</span>
                      <span className="block text-[0.78rem] text-ink-30">
                        {p.email ?? "no email on file"}
                      </span>
                    </td>
                    <td className="py-2.5 pr-4">
                      <span
                        className={
                          p.plan === "pro" ? "font-medium text-ink" : "text-ink-30"
                        }
                      >
                        {p.plan}
                      </span>
                    </td>
                    <td className="py-2.5 pr-4 tabular-nums">{p.clicks}</td>
                    <td className="py-2.5 pr-4 text-ink-50">
                      {p.sources.map((s) => SOURCE_LABEL[s] ?? s).join(", ")}
                    </td>
                    <td className="py-2.5 pr-4 text-ink-50">{when(p.firstAt)}</td>
                    <td className="py-2.5 text-ink-50">{when(p.lastAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}
