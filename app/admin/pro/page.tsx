import { Panel, Stat } from "@/components/admin/ui";
import { DataTable } from "@/components/admin/DataTable";
import { RangePicker } from "@/components/admin/RangePicker";
import { resolveRange } from "@/lib/admin/range";
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

export default async function AdminPro({
  searchParams,
}: {
  searchParams: Promise<{ range?: string; from?: string; to?: string }>;
}) {
  const sp = await searchParams;
  const range = resolveRange({ ...sp, range: sp.range ?? "all" });
  const result = await getProIntent();

  if (!result.ok) {
    return (
      <p className="rounded-xl border border-ink-15 px-4 py-3 text-[0.82rem] text-ink-50">
        Not recording yet — run <code>supabase/schemas/{result.missing}</code>.
      </p>
    );
  }

  const d = result.data;
  // People whose latest reach for Pro falls in the period.
  const lo = range.id === "all" ? 0 : range.from ? new Date(range.from).getTime() : Date.now() - range.days * 86_400_000;
  const hi = range.to ? new Date(range.to).getTime() : Infinity;
  const rows = d.rows.filter((p) => {
    const t = new Date(p.lastAt).getTime();
    return t >= lo && t < hi;
  });

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-[1.3rem] font-semibold tracking-[-0.03em]">Pro interest</h1>
        <p className="mt-2 max-w-[70ch] text-[0.85rem] leading-relaxed text-ink-50">
          Every time a signed-in person reaches the upgrade screen. Repeat
          visits inside thirty minutes count once, so this is people reaching
          for the plan rather than page refreshes.
        </p>
        <div className="mt-4">
          <RangePicker basePath="/admin/pro" range={range} allTime />
        </div>
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
        <DataTable
          name="pro-interest"
          empty="Nobody has reached the upgrade screen since recording started."
          initialSort={{ key: "last", dir: "desc" }}
          rows={rows.map((p) => ({
            id: p.userId,
            person: p.name ?? "No name",
            email: p.email ?? "no email on file",
            href: `/admin/users/${p.userId}`,
            plan: p.plan,
            clicks: p.clicks,
            from: p.sources.map((x) => SOURCE_LABEL[x] ?? x).join(", "),
            first: p.firstAt,
            last: p.lastAt,
          }))}
          columns={[
            { key: "person", label: "Person", sub: "email", href: "href", max: "max-w-[16rem]", filter: false },
            { key: "plan", label: "Plan", kind: "badge", tones: { pro: "green", free: "grey" } },
            { key: "clicks", label: "Times", kind: "number" },
            { key: "from", label: "From", max: "max-w-[14rem]" },
            { key: "first", label: "First", kind: "date" },
            { key: "last", label: "Last", kind: "date" },
          ]}
        />
      </Panel>
    </div>
  );
}
