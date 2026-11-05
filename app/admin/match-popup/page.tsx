import Link from "next/link";
import { Panel, Stat, Empty, BarList } from "@/components/admin/ui";
import { getPopupReport } from "@/lib/admin/match-popup";
import { getAtsPaywall } from "@/lib/admin/ats-paywall";
import { RangePicker } from "@/components/admin/RangePicker";
import { rangeQuery, resolveRange } from "@/lib/admin/range";
import { PopupPeople } from "@/components/admin/PopupPeople";
import { TabSwitch } from "@/components/admin/TabSwitch";

export const dynamic = "force-dynamic";

/**
 * The post-download match popup, person by person: who saw it, what field
 * they're in, how long they looked, what they clicked, what they paid.
 * See lib/admin/match-popup.ts for where each number comes from.
 */

const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)}%` : "—");
const pctOf = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)}% of them` : "—");
const WHEN = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" });
const when = (iso: string) => WHEN.format(new Date(iso));
const phoneText = (e164: string) => `+91 ${e164.slice(3, 8)} ${e164.slice(8)}`;

const SOURCES = [
  { id: "all", label: "Both" },
  { id: "resume", label: "After resume download" },
  { id: "ats", label: "After ATS check" },
] as const;

export default async function AdminMatchPopup({
  searchParams,
}: {
  searchParams: Promise<{ range?: string; from?: string; to?: string; src?: string }>;
}) {
  const sp = await searchParams;
  const range = resolveRange({ ...sp, range: sp.range ?? "28d" });
  const src = (SOURCES.find((x) => x.id === sp.src)?.id ?? "all") as "all" | "resume" | "ats";
  // The reports count back from now; a custom range reads from its first day.
  const days =
    range.id === "all" ? null : range.from ? Math.max(1, Math.ceil((Date.now() - new Date(range.from).getTime()) / 86_400_000)) : range.days;
  const [report, paywall] = await Promise.all([getPopupReport(days, src), getAtsPaywall(days ?? 3650)]);
  const link = (q: { src?: string }) => `/admin/match-popup?${rangeQuery(range, { src: q.src ?? src })}`;

  if (!report.ok) {
    return (
      <p className="rounded-xl border border-ink-15 px-4 py-3 text-[0.82rem] text-ink-50">
        Not recording yet — run <code>supabase/schemas/{report.missing}</code>.
      </p>
    );
  }
  const t = report.totals;
  const steps = [
    ...(src === "resume" ? [{ label: "Downloaded a resume", value: t.downloaders }] : []),
    { label: "Saw the match popup", value: t.shownUsers },
    { label: "Clicked something", value: t.clickedUsers },
    { label: "Started a payment (₹49 / ₹99)", value: t.startedPayUsers },
    { label: "Paid", value: t.paidUsers },
  ];
  const top = Math.max(1, ...steps.map((x) => x.value));

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[1.3rem] font-semibold tracking-[-0.03em]">Match popup</h1>
          <p className="mt-2 max-w-[80ch] text-[0.85rem] leading-relaxed text-ink-50">
          The match popup after a resume download or ATS check, and the ₹49 ATS card: who saw it, clicked and paid.
        </p>
        </div>
        <div className="flex flex-col items-end gap-2">
        <div className="flex flex-wrap gap-1.5">
          {SOURCES.map((x) => (
            <Link
              key={x.id}
              href={link({ src: x.id })}
              className={`rounded-full px-3.5 py-1.5 text-[0.8rem] ${src === x.id ? "bg-ink text-paper" : "border border-ink-15 text-ink-50 hover:text-ink"}`}
            >
              {x.label}
            </Link>
          ))}
        </div>
        <RangePicker basePath="/admin/match-popup" range={range} keep={{ src }} allTime />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Stat
          label="Saw popup"
          value={t.shownUsers}
          hint={src === "resume" ? `${t.shows} times · ${pct(t.shownUsers, t.downloaders)} of downloaders` : `${t.shows} times`}
        />
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
          No popup means the resume had no genuine match (2+ shared skills, 60%+) — or, after a download, the popup had
          already shown in that session.
        </p>
      </Panel>

      {/* People and the ₹49 ATS card: one card, a pill to switch. */}
      <section className="min-w-0 rounded-[1.25rem] bg-paper p-6">
        <TabSwitch
          scope="match-popup"
          tabs={[
            {
              id: "people",
              label: "People",
              stamps: report.rows.map((r) => r.lastAt),
              content: (
                <>
                  {report.rows.length === 0 ? (
                    <Empty>Nobody has seen the popup in this period yet.</Empty>
                  ) : (
                    <PopupPeople rows={report.rows} />
                  )}
                </>
              ),
            },
            {
              id: "ats-card",
              label: "₹49 ATS card",
              stamps: paywall.ok ? paywall.rows.map((r) => r.lastShown) : [],
              content: (
                <>
                  <p className="mb-4 max-w-[80ch] text-[0.8rem] leading-relaxed text-ink-50">
                    The other ₹49 payment: the ATS checker&apos;s second check of the day, locked until ₹49 for unlimited
                    checks. Same period as above. Steps count people.
                  </p>
        {!paywall.ok ? (
          <Empty>Couldn&apos;t read it: {paywall.error}</Empty>
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-5">
              {[
                { label: "Used free check", value: paywall.freeChecks, hint: "free checks" },
                { label: "Saw ₹49 card", value: paywall.people, hint: `${paywall.shows} times shown` },
                { label: "Tapped See my score", value: paywall.tapped, hint: pctOf(paywall.tapped, paywall.people) },
                { label: "Opened payment", value: paywall.opened, hint: "after signing in" },
                { label: "Paid ₹49", value: paywall.paid, hint: `₹${paywall.revenue.toLocaleString("en-IN")} in all` },
              ].map((s) => (
                <div key={s.label} className="rounded-xl border border-ink-08 p-4">
                  <p className="text-[0.72rem] leading-snug text-ink-50">{s.label}</p>
                  <p className="mt-2 text-[1.6rem] font-semibold leading-none tracking-[-0.04em] tabular-nums">{s.value}</p>
                  <p className="mt-2 text-[0.72rem] text-ink-30">{s.hint}</p>
                </div>
              ))}
            </div>
            {paywall.rows.length > 0 && (
              <div className="mt-5 overflow-x-auto">
                <table className="w-full min-w-[640px] text-left text-[0.82rem]">
                  <thead className="text-[0.7rem] uppercase tracking-[0.08em] text-ink-30">
                    <tr className="border-b border-ink-08">
                      <th className="py-2 pr-3 font-medium">Person</th>
                      <th className="py-2 pr-3 font-medium">Card shown</th>
                      <th className="py-2 pr-3 font-medium">Got to</th>
                      <th className="py-2 text-right font-medium">Last seen</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paywall.rows.map((r) => (
                      <tr key={r.key} className="border-b border-ink-08">
                        <td className="py-2.5 pr-3">
                          <span className="font-medium">{r.name ?? r.email ?? (r.phone ? phoneText(r.phone) : "Unknown")}</span>
                          <span className="ml-2 text-ink-30">
                            {[r.name ? r.email : null, r.phone ? phoneText(r.phone) : null].filter(Boolean).join(" · ")}
                          </span>
                        </td>
                        <td className="py-2.5 pr-3 tabular-nums text-ink-50">{r.shown}×</td>
                        <td className="py-2.5 pr-3">
                          <span
                            className={`inline-block rounded-full px-2 py-0.5 text-[0.72rem] font-medium ${
                              r.paid
                                ? "bg-[#e7f6ec] text-[#14532d]"
                                : r.opened
                                  ? "bg-[#fff4e0] text-[#7a4b00]"
                                  : r.signedIn
                                    ? "bg-[#eef2ff] text-[#3730a3]"
                                    : "bg-ink-04 text-ink-50"
                            }`}
                          >
                            {r.paid ? "Paid ₹49" : r.opened ? "Opened payment, didn’t pay" : r.signedIn ? "Signed in, didn’t pay" : "Saw the card"}
                          </span>
                        </td>
                        <td className="py-2.5 text-right tabular-nums text-ink-50">{when(r.lastShown)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
                </>
              ),
            },
          ]}
        />
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Who saw it, by field">
          <BarList rows={report.byField} empty="Nobody has seen it in this period." unit="people" />
        </Panel>
        <Panel title="Best match shown">
          <BarList rows={report.byScore} empty="Nobody has seen it in this period." unit="people" />
        </Panel>
      </div>
    </div>
  );
}
