import Link from "next/link";
import { Panel, Stat, Empty, BarList } from "@/components/admin/ui";
import { getPopupReport } from "@/lib/admin/match-popup";

export const dynamic = "force-dynamic";

/**
 * The post-download match popup, person by person: who saw it, what field
 * they're in, how long they looked, what they clicked, what they paid.
 * See lib/admin/match-popup.ts for where each number comes from.
 */

const WHEN = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" });
const when = (iso: string | null) => (iso ? WHEN.format(new Date(iso)) : "—");
const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)}%` : "—");

const RANGES = [
  { id: "7", label: "7 days" },
  { id: "30", label: "30 days" },
  { id: "all", label: "All time" },
];

const TONE: Record<string, string> = {
  "Paid ₹99": "bg-[#e7f6ec] text-[#14532d]",
  "Paid ₹49": "bg-[#e7f6ec] text-[#14532d]",
  Applied: "bg-[#e7f6ec] text-[#14532d]",
  "Started payment": "bg-[#fff4e0] text-[#7a4b00]",
  "Looked at Pro": "bg-[#fff4e0] text-[#7a4b00]",
  "Opened matches": "bg-[#eef2ff] text-[#3730a3]",
  Closed: "bg-ink-04 text-ink-50",
  "No action": "bg-ink-04 text-ink-50",
};

export default async function AdminMatchPopup({ searchParams }: { searchParams: Promise<{ days?: string }> }) {
  const { days: raw } = await searchParams;
  const range = RANGES.some((r) => r.id === raw) ? raw! : "30";
  const report = await getPopupReport(range === "all" ? null : Number(range));

  if (!report.ok) {
    return (
      <p className="rounded-xl border border-ink-15 px-4 py-3 text-[0.82rem] text-ink-50">
        Not recording yet — run <code>supabase/schemas/{report.missing}</code>.
      </p>
    );
  }
  const t = report.totals;
  const steps = [
    { label: "Downloaded a resume", value: t.downloaders },
    { label: "Saw the match popup", value: t.shownUsers },
    { label: "Clicked something", value: t.clickedUsers },
    { label: "Started a payment (₹49 / ₹99)", value: t.startedPayUsers },
    { label: "Paid", value: t.paidUsers },
  ];
  const top = Math.max(1, steps[0].value, steps[1].value);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[1.3rem] font-semibold tracking-[-0.03em]">Match popup</h1>
          <p className="mt-2 max-w-[72ch] text-[0.85rem] leading-relaxed text-ink-50">
            The popup that appears right after a resume download — “N companies want someone with your skills”. Who saw it,
            what field they are in, what they clicked and what they paid. One row per person, latest first.
          </p>
        </div>
        <div className="flex gap-1.5">
          {RANGES.map((r) => (
            <Link
              key={r.id}
              href={`/admin/match-popup?days=${r.id}`}
              className={`rounded-full px-3.5 py-1.5 text-[0.8rem] ${range === r.id ? "bg-ink text-paper" : "border border-ink-15 text-ink-50 hover:text-ink"}`}
            >
              {r.label}
            </Link>
          ))}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Stat label="Saw popup" value={t.shownUsers} hint={`${t.shows} times · ${pct(t.shownUsers, t.downloaders)} of downloaders`} />
        <Stat label="Clicked" value={t.clickedUsers} hint={`${pct(t.clickedUsers, t.shownUsers)} of those who saw it`} />
        <Stat label="Started payment" value={t.startedPayUsers} hint={pct(t.startedPayUsers, t.shownUsers)} />
        <Stat label="Paid" value={t.paidUsers} hint={pct(t.paidUsers, t.shownUsers)} />
        <Stat label="Revenue" value={`₹${t.revenue.toLocaleString("en-IN")}`} hint="₹49 + ₹99 unlocks" />
        <Stat label="Time on popup" value={t.avgSeconds !== null ? `${t.avgSeconds}s` : "—"} hint={`${t.closedOnly} closed it with no click`} />
      </div>

      <Panel title="Funnel">
        <ol className="space-y-2.5">
          {steps.map((s, i) => (
            <li key={s.label} className="grid grid-cols-[minmax(0,15rem)_minmax(0,1fr)_5rem] items-center gap-3 text-[0.84rem]">
              <span className="truncate">{s.label}</span>
              <span className="h-3 overflow-hidden rounded-full bg-ink-04">
                <span className="block h-full rounded-full bg-ink" style={{ width: `${(s.value / top) * 100}%` }} />
              </span>
              <span className="text-right tabular-nums">
                {s.value}
                {i > 0 && <span className="ml-1.5 text-ink-30">{pct(s.value, steps[i - 1].value)}</span>}
              </span>
            </li>
          ))}
        </ol>
        <p className="mt-4 text-[0.76rem] text-ink-30">
          A download without a popup means the resume had no genuine match (2+ shared skills, 60%+) — or the popup had
          already shown in that session.
        </p>
      </Panel>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Who saw it, by field">
          <BarList rows={report.byField} empty="Nobody has seen it in this period." unit="people" />
        </Panel>
        <Panel title="Best match shown">
          <BarList rows={report.byScore} empty="Nobody has seen it in this period." unit="people" />
        </Panel>
      </div>

      <Panel title="People">
        {report.rows.length === 0 ? (
          <Empty>Nobody has seen the popup in this period yet.</Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1100px] text-left text-[0.8rem]">
              <thead className="text-[0.72rem] uppercase tracking-[0.08em] text-ink-30">
                <tr className="border-b border-ink-08">
                  <th className="py-2 pr-3 font-medium">Person</th>
                  <th className="py-2 pr-3 font-medium">Field</th>
                  <th className="py-2 pr-3 font-medium">City · source</th>
                  <th className="py-2 pr-3 font-medium">Popup</th>
                  <th className="py-2 pr-3 font-medium">Clicks</th>
                  <th className="py-2 pr-3 font-medium">Outcome</th>
                  <th className="py-2 font-medium">Jobs</th>
                </tr>
              </thead>
              <tbody>
                {report.rows.map((r) => (
                  <tr key={r.userId} className="border-b border-ink-08 align-top">
                    <td className="py-3 pr-3">
                      <p className="font-medium">{r.name ?? "—"}</p>
                      <p className="text-ink-50">{r.phone ?? r.email ?? ""}</p>
                      {r.phone && r.email && <p className="text-ink-30">{r.email}</p>}
                    </td>
                    <td className="py-3 pr-3">
                      <p>{r.field ?? "—"}</p>
                      <p className="text-ink-30">
                        {r.years !== null ? `${r.years} yrs` : ""}
                        {r.skills.length ? `${r.years !== null ? " · " : ""}${r.skills.slice(0, 4).join(", ")}` : ""}
                      </p>
                    </td>
                    <td className="py-3 pr-3">
                      <p>{r.city ?? "—"}</p>
                      <p className="text-ink-30">{r.source ?? "—"}</p>
                    </td>
                    <td className="py-3 pr-3">
                      <p>
                        {r.shown}× · {r.matches ?? "?"} matches · best {r.best ?? "?"}%
                      </p>
                      <p className="text-ink-30">
                        {r.downloads} downloads · {r.avgSeconds !== null ? `${r.avgSeconds}s on popup` : "—"}
                      </p>
                      <p className="text-ink-30">{when(r.lastAt)}</p>
                    </td>
                    <td className="py-3 pr-3 text-ink-50">
                      {[
                        r.unlockClicks && `₹49 ×${r.unlockClicks}`,
                        r.passClicks && `₹99 ×${r.passClicks}`,
                        r.applyClicks && `apply ×${r.applyClicks}`,
                        r.seeAll && `see all ×${r.seeAll}`,
                        r.proClicks && `Pro ×${r.proClicks}`,
                      ]
                        .filter(Boolean)
                        .join(" · ") || "—"}
                    </td>
                    <td className="py-3 pr-3">
                      <span className={`inline-block whitespace-nowrap rounded-full px-2.5 py-1 text-[0.74rem] font-medium ${TONE[r.outcome] ?? ""}`}>
                        {r.outcome}
                      </span>
                      {r.paidRupees > 0 && <p className="mt-1 text-ink-50">₹{r.paidRupees} · {r.paidKinds.join(", ")}</p>}
                    </td>
                    <td className="py-3 text-ink-50">
                      {r.jobs.length
                        ? r.jobs.slice(0, 3).map((j, i) => (
                            <p key={i} className="max-w-[16rem] truncate">
                              {j.title}
                              {j.company ? ` · ${j.company}` : ""} <span className="text-ink-30">({j.action})</span>
                            </p>
                          ))
                        : "—"}
                    </td>
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
