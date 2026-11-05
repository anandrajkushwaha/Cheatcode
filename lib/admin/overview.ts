import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { createAppAdminClient } from "@/lib/supabase/app";
import { fetchAll } from "@/lib/admin/fetch-all";
import { isDataCentre } from "@/lib/admin/journeys-build";
import type { Range } from "@/lib/admin/range";

/**
 * The Dashboard: the whole business on one screen, for one period, next to the
 * period before it.
 *
 *   visitors     page_views (people = visitor ids; bots and data-centre
 *                crawlers left out, as in Journeys; our own browsers were
 *                never recorded)
 *   sign-ups     profiles.created_at
 *   ATS checks   page_events tool_compute on the ATS checker: a score shown,
 *                or the ₹49 card shown
 *   downloads    account_events resume_download
 *   revenue      job_unlocks paid (₹49 job / ₹99 pass / ₹49 ATS) and Pro
 *                subscription charges (billing_events subscription.charged)
 *
 * Each figure is read for the period and the one of equal length before it,
 * so every card can say how it moved. Every read pages past Supabase's
 * 1,000-row answer (lib/admin/fetch-all.ts).
 */

/** `previous`: the period before, bucket for bucket (a week earlier, or yesterday's same hour). */
export type Kpi = { now: number; before: number; series: number[]; previous: number[] };

export type Activity = {
  at: string;
  kind: "signup" | "payment" | "ats" | "download";
  who: string;
  what: string;
  /** Where the row leads: the person, the payments, the leads, the résumés. */
  href: string;
};

export type Overview = {
  /** What is being shown and what it is compared with, as instants. */
  period: { from: string; to: string; prevFrom: string; prevTo: string };
  labels: string[];
  bucket: "hour" | "day";
  kpis: {
    visitors: Kpi;
    signups: Kpi;
    atsChecks: Kpi;
    downloads: Kpi;
    revenue: Kpi;
  };
  funnel: { label: string; value: number }[];
  revenueBy: { label: string; value: number }[];
  sources: { label: string; value: number }[];
  pages: { label: string; value: number }[];
  activity: Activity[];
  alerts: { text: string; href: string; tone: "warn" | "info" }[];
};

const DAY = 86_400_000;
const istParts = (iso: string) => {
  const d = new Date(new Date(iso).getTime() + 5.5 * 3600_000);
  return { day: d.toISOString().slice(0, 10), hour: d.getUTCHours() };
};

/**
 * The period and the one it is compared with. Today so far is compared with
 * yesterday up to the same time — not with the last hours of yesterday, which
 * is what "the same length just before" would give for a partial day.
 */
function window(range: Range) {
  const to = range.to ? new Date(range.to).getTime() : Date.now();
  const from = range.from ? new Date(range.from).getTime() : to - range.days * DAY;
  if (range.id === "today") return { from, to, prevFrom: from - DAY, prevTo: to - DAY };
  const len = Math.max(to - from, 3600_000);
  return { from, to, prevFrom: from - len, prevTo: from };
}

/** The bucket labels for the period: hours for a single day, otherwise IST days. */
function buckets(from: number, to: number) {
  if (to - from <= DAY + 60_000) {
    // Up to the current hour only: hours still to come are not zeros.
    const last = to >= Date.now() - 60_000 ? istParts(new Date(to - 1).toISOString()).hour : 23;
    return { bucket: "hour" as const, keys: Array.from({ length: last + 1 }, (_, h) => String(h)) };
  }
  const keys: string[] = [];
  for (let t = from; t < to; t += DAY) {
    const k = istParts(new Date(t).toISOString()).day;
    if (keys[keys.length - 1] !== k) keys.push(k);
  }
  const last = istParts(new Date(to - 1).toISOString()).day;
  if (keys[keys.length - 1] !== last) keys.push(last);
  return { bucket: "day" as const, keys };
}

const LABEL = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", timeZone: "UTC" });

export async function getOverview(range: Range): Promise<{ ok: true; data: Overview } | { ok: false; error: string }> {
  const site = createAdminClient();
  const app = createAppAdminClient();
  if (!site || !app) return { ok: false, error: "Supabase isn't configured." };

  const { from, to, prevFrom, prevTo } = window(range);
  const iso = (t: number) => new Date(t).toISOString();
  const lo = iso(prevFrom);
  const hi = iso(to);

  const [views, ats, profiles, downloads, unlocks, charges, recentLeads, pending, atsErrors, engaged] = await Promise.all([
    fetchAll<{ visitor_id: string | null; session_id: string | null; source: string | null; path: string; city: string | null; created_at: string }>(
      (a, b) =>
        site
          .from("page_views")
          .select("visitor_id,session_id,source,path,city,created_at")
          .eq("is_bot", false)
          .gte("created_at", lo)
          .lt("created_at", hi)
          .order("id", { ascending: true })
          .range(a, b),
      100_000,
    ),
    fetchAll<{ value: number | null; params: Record<string, unknown> | null; created_at: string }>((a, b) =>
      site
        .from("page_events")
        .select("value,params,created_at")
        .eq("event", "tool_compute")
        .eq("label", "resume-ats-checker")
        .eq("is_bot", false)
        .gte("created_at", lo)
        .lt("created_at", hi)
        .order("id", { ascending: true })
        .range(a, b),
    ),
    fetchAll<{ id: string; full_name: string | null; email: string | null; signup_source: string | null; created_at: string }>((a, b) =>
      app
        .from("profiles")
        .select("id,full_name,email,signup_source,created_at")
        .gte("created_at", lo)
        .lt("created_at", hi)
        .order("created_at", { ascending: true })
        .range(a, b),
    ),
    fetchAll<{ user_id: string; created_at: string }>((a, b) =>
      app
        .from("account_events")
        .select("user_id,created_at")
        .eq("kind", "resume_download")
        .gte("created_at", lo)
        .lt("created_at", hi)
        .order("id", { ascending: true })
        .range(a, b),
    ),
    fetchAll<{ user_id: string; kind: string; amount_paise: number; paid_at: string }>((a, b) =>
      app
        .from("job_unlocks")
        .select("user_id,kind,amount_paise,paid_at")
        .eq("status", "paid")
        .gte("paid_at", lo)
        .lt("paid_at", hi)
        .order("paid_at", { ascending: true })
        .range(a, b),
    ),
    fetchAll<{ received_at: string; payload: Record<string, unknown> | null }>((a, b) =>
      app
        .from("billing_events")
        .select("received_at,payload")
        .eq("event", "subscription.charged")
        .gte("received_at", lo)
        .lt("received_at", hi)
        .order("received_at", { ascending: true })
        .range(a, b),
    ),
    app.from("ats_leads").select("name,score,created_at").order("created_at", { ascending: false }).limit(8),
    app.from("resume_reviews").select("id", { count: "exact", head: true }).neq("status", "done"),
    site
      .from("page_events")
      .select("id", { count: "exact", head: true })
      .eq("event", "tool_compute")
      .eq("label", "resume-ats-checker")
      .eq("params->>outcome", "error")
      .gte("created_at", iso(Date.now() - DAY)),
    // Every visit that sent any event at all (heartbeat, scroll, time on page,
    // a tool, a click). Crawlers load one page and send nothing.
    fetchAll<{ session_id: string | null }>(
      (a, b) =>
        site
          .from("page_events")
          .select("session_id")
          .eq("is_bot", false)
          .gte("created_at", lo)
          .lt("created_at", hi)
          .order("id", { ascending: true })
          .range(a, b),
      200_000,
    ),
  ]);
  if (views.error) return { ok: false, error: views.error };

  const { bucket, keys } = buckets(from, to);
  const index = new Map(keys.map((k, i) => [k, i]));
  const slot = (at: string) => {
    const p = istParts(at);
    return index.get(bucket === "hour" ? String(p.hour) : p.day);
  };
  const isNow = (at: string) => new Date(at).getTime() >= from;
  const isBefore = (at: string) => {
    const t = new Date(at).getTime();
    return t >= prevFrom && t < prevTo;
  };

  // A KPI from rows: count (or sum) in the period, the period before, and a
  // per-bucket series for the period's chart.
  function kpi<T>(rows: T[], at: (r: T) => string, amount: (r: T) => number = () => 1, distinct?: (r: T) => string | null): Kpi {
    const series = new Array(keys.length).fill(0);
    const previous = new Array(keys.length).fill(0);
    // A row from the period before, moved forward onto the matching bucket.
    const prevSlot = (t: string) => slot(new Date(new Date(t).getTime() + (from - prevFrom)).toISOString());
    const seenPrevSlot = keys.map(() => new Set<string>());
    let now = 0;
    let before = 0;
    const seenNow = new Set<string>();
    const seenBefore = new Set<string>();
    const seenSlot = keys.map(() => new Set<string>());
    for (const r of rows) {
      const t = at(r);
      const current = isNow(t);
      const id = distinct?.(r);
      if (distinct) {
        if (!id) continue;
        if (current) {
          if (!seenNow.has(id)) {
            seenNow.add(id);
            now += 1;
          }
          const s = slot(t);
          if (s !== undefined && !seenSlot[s].has(id)) {
            seenSlot[s].add(id);
            series[s] += 1;
          }
        } else if (isBefore(t)) {
          if (!seenBefore.has(id)) {
            seenBefore.add(id);
            before += 1;
          }
          const s = prevSlot(t);
          if (s !== undefined && !seenPrevSlot[s].has(id)) {
            seenPrevSlot[s].add(id);
            previous[s] += 1;
          }
        }
        continue;
      }
      const v = amount(r);
      if (current) {
        now += v;
        const s = slot(t);
        if (s !== undefined) series[s] += v;
      } else if (isBefore(t)) {
        before += v;
        const s = prevSlot(t);
        if (s !== undefined) previous[s] += v;
      }
    }
    return { now, before, series, previous };
  }

  // A visit counts when it looks like a person: it sent at least one event, or
  // opened more than one page. Cloud crawlers (Beijing, Singapore… — far
  // outside the data-centre city list) open one page and send nothing, and
  // on some days they were nine visits in ten.
  const active = new Set(engaged.rows.map((e) => e.session_id).filter(Boolean) as string[]);
  const viewsPerSession = new Map<string, number>();
  for (const v of views.rows) if (v.session_id) viewsPerSession.set(v.session_id, (viewsPerSession.get(v.session_id) ?? 0) + 1);
  const human = (v: { session_id: string | null; city: string | null }) =>
    !isDataCentre(v.city) && !!v.session_id && (active.has(v.session_id) || (viewsPerSession.get(v.session_id) ?? 0) > 1);
  const people = views.rows.filter(human);
  const atsRows = ats.rows.filter((r) => typeof r.value === "number" || r.params?.outcome === "locked");
  const chargeAmount = (c: { payload: Record<string, unknown> | null }) => {
    const p = c.payload as { payload?: { payment?: { entity?: { amount?: number } } } } | null;
    return (p?.payload?.payment?.entity?.amount ?? 0) / 100;
  };
  const money = [
    ...unlocks.rows.map((u) => ({ at: u.paid_at, amount: u.amount_paise / 100, kind: u.kind })),
    ...charges.rows.map((c) => ({ at: c.received_at, amount: chargeAmount(c), kind: "pro" })),
  ];

  const kpis = {
    visitors: kpi(people, (r) => r.created_at, undefined, (r) => r.visitor_id ?? r.session_id),
    signups: kpi(profiles.rows, (r) => r.created_at),
    atsChecks: kpi(atsRows, (r) => r.created_at),
    downloads: kpi(downloads.rows, (r) => r.created_at),
    revenue: kpi(money, (r) => r.at, (r) => r.amount),
  };

  // The funnel for the period: people at each stage.
  const nowViews = people.filter((v) => isNow(v.created_at));
  const nowProfiles = profiles.rows.filter((p) => isNow(p.created_at));
  const nowAts = atsRows.filter((r) => isNow(r.created_at)).length;
  const nowDownloaders = new Set(downloads.rows.filter((d) => isNow(d.created_at)).map((d) => d.user_id)).size;
  const nowPayers = new Set(unlocks.rows.filter((u) => isNow(u.paid_at)).map((u) => u.user_id)).size + charges.rows.filter((c) => isNow(c.received_at)).length;
  const funnel = [
    { label: "Visitors", value: kpis.visitors.now },
    { label: "Signed up", value: nowProfiles.length },
    { label: "ATS check or resume download", value: nowAts + nowDownloaders },
    { label: "Paid", value: nowPayers },
  ];

  const tally = (items: string[]) => {
    const m = new Map<string, number>();
    for (const k of items) m.set(k, (m.get(k) ?? 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1]).map(([label, value]) => ({ label, value }));
  };
  // Sources by visit (first view of each session), pages by view.
  const firstOfSession = new Map<string, string>();
  for (const v of nowViews) if (v.session_id && !firstOfSession.has(v.session_id)) firstOfSession.set(v.session_id, v.source ?? "direct");
  const sources = tally([...firstOfSession.values()]).slice(0, 6);
  const pages = tally(nowViews.map((v) => v.path)).slice(0, 6);

  const KIND: Record<string, string> = { job: "₹49 job unlock", pass: "₹99 match pass", ats: "₹49 ATS unlimited", pro: "Pro plan" };
  const revenueBy = (
    Object.entries(
      money
        .filter((m) => isNow(m.at))
        .reduce<Record<string, number>>((acc, m) => ({ ...acc, [KIND[m.kind] ?? m.kind]: (acc[KIND[m.kind] ?? m.kind] ?? 0) + m.amount }), {}),
    )
  )
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value);

  // What just happened, newest first.
  const activity: Activity[] = [
    ...nowProfiles.slice(-8).map((p) => ({
      at: p.created_at,
      kind: "signup" as const,
      who: p.full_name || p.email || "Someone",
      what: `signed up${p.signup_source ? ` · ${p.signup_source}` : ""}`,
      href: `/admin/users/${p.id}`,
    })),
    ...money
      .filter((m) => isNow(m.at))
      .slice(-8)
      .map((m) => ({
        at: m.at,
        kind: "payment" as const,
        who: "Payment",
        what: `₹${m.amount} · ${KIND[m.kind] ?? m.kind}`,
        href: m.kind === "pro" ? "/admin/pro" : "/admin/match-popup",
      })),
    ...(((recentLeads.data ?? []) as { name: string | null; score: number | null; created_at: string }[])
      .filter((l) => isNow(l.created_at))
      .map((l) => ({
        at: l.created_at,
        kind: "ats" as const,
        who: l.name || "Someone",
        what: `ran the ATS check${typeof l.score === "number" ? ` · score ${l.score}` : ""}`,
        href: "/admin/leads",
      }))),
    ...downloads.rows
      .filter((d) => isNow(d.created_at))
      .slice(-8)
      .map((d) => ({ at: d.created_at, kind: "download" as const, who: "Resume", what: "downloaded as PDF", href: "/admin/resume" })),
  ]
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, 10);

  const alerts: Overview["alerts"] = [];
  if ((pending.count ?? 0) > 0)
    alerts.push({ text: `${pending.count} paid resume review${pending.count === 1 ? "" : "s"} waiting for a reply`, href: "/admin/resume-requests", tone: "warn" });
  if ((atsErrors.count ?? 0) > 0)
    alerts.push({ text: `${atsErrors.count} ATS check${atsErrors.count === 1 ? "" : "s"} failed in the last 24 hours`, href: "/admin/journeys", tone: "warn" });

  const labels = bucket === "hour" ? keys.map((h) => `${h}:00`) : keys.map((d) => LABEL.format(new Date(`${d}T00:00:00Z`)));
  const period = { from: iso(from), to: iso(to), prevFrom: iso(prevFrom), prevTo: iso(prevTo) };
  return { ok: true, data: { period, labels, bucket, kpis, funnel, revenueBy, sources, pages, activity, alerts } };
}
