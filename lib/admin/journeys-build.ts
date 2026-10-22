/**
 * Visits, step by step — the ad funnel and every visitor's path through it.
 *
 * Built from the two analytics tables the site already writes (page_views,
 * page_events). A visit is a session_id; its source, city, phone and browser
 * come from its first page view. Nothing here names anybody: the rows carry
 * a random visitor id, as the privacy page says, so a journey is "someone in
 * Lucknow on Instagram's browser", never a person.
 *
 * Each funnel step counts the visits that did that step, independently. So
 * the numbers need not narrow: the free ATS page gives a score with no
 * sign-up, and a returning user can open /app without seeing the sign-up
 * screen. That is what happened, so that is what is shown.
 *
 * Pure — no imports — so npm test can run it; lib/admin/journeys.ts reads
 * the rows and hands them here.
 */

export const STEPS = [
  "Landed",
  "Saw sign-up form",
  "Entered number / email",
  "Signed in",
  "Used ATS / resume",
] as const;

export type SourceFilter = "meta" | "paid" | "all";

export type TimelineItem = { at: string; kind: "page" | "event"; text: string };

export type Journey = {
  session: string;
  startedAt: string;
  seconds: number;
  city: string | null;
  os: string | null;
  browser: string | null;
  device: string | null;
  source: string | null;
  campaign: string | null;
  landing: string;
  pages: number;
  /** Index into STEPS of the furthest step reached. */
  furthest: number;
  /** Indexes into STEPS of every step reached. */
  reached: number[];
  timeline: TimelineItem[];
};

export type Breakdown = { key: string; visits: number; signedIn: number }[];

/**
 * Cities that are data centres, not audiences. Meta's ad review opens every
 * ad's link from these (Prineville, Luleå, Forest City, Clonee, Fort Worth…)
 * and cloud crawlers from the AWS/Google ones; on an India-targeted ad they
 * were a sixth of all "visits", every one bouncing in 0s. Hidden, and counted.
 */
const DATA_CENTRE_CITIES = new Set(
  [
    "Prineville",
    "Luleå",
    "Lulea",
    "Forest City",
    "Clonee",
    "Fort Worth",
    "Altoona",
    "Papillion",
    "Los Lunas",
    "New Albany",
    "Henrico",
    "Eagle Mountain",
    "Huntsville",
    "DeKalb",
    "Gallatin",
    "Odense",
    "Mesa",
    "Sarpy",
    "Boardman",
    "Ashburn",
    "Council Bluffs",
    "The Dalles",
  ].map((c) => c.toLowerCase()),
);

export function isDataCentre(city: string | null): boolean {
  return !!city && DATA_CENTRE_CITIES.has(city.toLowerCase());
}

export type JourneysReport = {
  funnel: { step: string; visits: number }[];
  byBrowser: Breakdown;
  byOs: Breakdown;
  byCity: Breakdown;
  journeys: Journey[];
  total: number;
  /** Visits from data-centre cities, left out of everything above. */
  crawlers: number;
  truncated: boolean;
};

const META_RE = /meta|facebook|instagram|^fb\b|^ig\b|site_source_name/i;

// Events that are noise in a timeline: they fire constantly and say nothing
// about what the person did.
const QUIET = new Set([
  "scroll_depth",
  "time_on_page",
  "cta_view",
  "banner_view",
  "article_read",
  "page_view",
]);

export type View = {
  path: string;
  session_id: string | null;
  source: string | null;
  medium: string | null;
  campaign: string | null;
  city: string | null;
  os: string | null;
  browser: string | null;
  device: string | null;
  created_at: string;
};

export type Event = {
  event: string;
  path: string | null;
  label: string | null;
  value: number | null;
  params: Record<string, unknown> | null;
  session_id: string | null;
  created_at: string;
};

function eventText(e: Event): string | null {
  if (e.event === "builder_step") {
    const p = e.params ?? {};
    switch (e.label) {
      case "template_click":
        return p.where === "resume-templates" || p.where === "home"
          ? `Picked template "${String(p.template ?? "?")}" on ${p.where === "home" ? "the home page" : "/resume-templates"}`
          : `Picked template "${String(p.template ?? "?")}" — details form opened`;
      case "details_submit":
        return "Filled details, tapped Continue";
      case "account_created":
        return "Created account";
      case "existing_account":
        return "Already had an account — asked for password";
      case "login":
        return "Signed in with password";
      case "draft_created":
        return "Resume opened in the editor";
      case "guest_open":
        return `Opened the free builder (no login), template "${String(p.template ?? "?")}"`;
      case "gate_shown":
        return `Save popup shown (${String(p.reason ?? "auto")}, ${String(p.fields ?? "?")} fields filled)`;
      case "gate_dismissed":
        return "Closed the save popup";
      case "error":
        return `Form error: ${String(p.reason ?? "unknown").slice(0, 80)}`;
      default:
        return `Builder: ${e.label ?? "step"}`;
    }
  }
  const p = e.params ?? {};
  if (e.event === "signup_step") {
    const method =
      p.method === "phone"
        ? "number"
        : p.method === "email"
          ? "email"
          : "number / email";
    switch (e.label) {
      case "google":
        return "Tapped Continue with Google";
      case "identify":
        return `Entered ${method}`;
      case "identify_invalid":
        return "Typed an invalid number / email";
      case "account_created":
        return `Created account (${method})`;
      case "existing_account":
        return "Already had an account — asked for password";
      case "login":
        return "Signed in with password";
      case "error":
        return `Sign-up error: ${String(p.reason ?? "unknown").slice(0, 80)}`;
      default:
        return `Sign-up: ${e.label ?? "step"}`;
    }
  }
  if (e.event === "tool_compute" && e.label === "resume-ats-checker") {
    if (typeof e.value === "number") return `Got ATS score ${e.value}`;
    return `ATS check failed (${String(p.outcome ?? "error")})`;
  }
  if (e.event === "tool_input" && e.label === "resume-ats-checker-choose")
    return "Tapped Choose a file";
  if (QUIET.has(e.event)) return null;
  return e.label
    ? `${e.event.replace(/_/g, " ")}: ${e.label}`
    : e.event.replace(/_/g, " ");
}

function matches(filter: SourceFilter, v: View): boolean {
  if (filter === "all") return true;
  if (filter === "paid") return v.medium === "paid";
  return META_RE.test(v.source ?? "");
}

function breakdown(
  list: Journey[],
  key: (j: Journey) => string | null,
): Breakdown {
  const m = new Map<string, { visits: number; signedIn: number }>();
  for (const j of list) {
    const k = key(j) || "unknown";
    const cur = m.get(k) ?? { visits: 0, signedIn: 0 };
    cur.visits += 1;
    if (j.reached.includes(3)) cur.signedIn += 1;
    m.set(k, cur);
  }
  return [...m.entries()]
    .map(([k, v]) => ({ key: k, ...v }))
    .sort((a, b) => b.visits - a.visits)
    .slice(0, 8);
}

/** The whole report from raw rows, oldest first. Pure, so it can be tested. */
export function buildJourneys(
  views: View[],
  events: Event[],
  filter: SourceFilter,
  truncated = false,
): JourneysReport {
  // ---- visits, from their first page view
  const bySession = new Map<
    string,
    { first: View; views: View[]; events: Event[] }
  >();
  for (const row of views) {
    if (!row.session_id) continue;
    const s = bySession.get(row.session_id);
    if (s) s.views.push(row);
    else
      bySession.set(row.session_id, { first: row, views: [row], events: [] });
  }
  for (const ev of events) {
    if (!ev.session_id) continue;
    bySession.get(ev.session_id)?.events.push(ev);
  }

  const journeys: Journey[] = [];
  let crawlers = 0;
  for (const [session, s] of bySession) {
    if (!matches(filter, s.first)) continue;
    if (isDataCentre(s.first.city)) {
      crawlers += 1;
      continue;
    }

    const got = new Set<number>([0]);
    const reach = (i: number) => {
      got.add(i);
    };
    for (const pv of s.views) {
      if (pv.path === "/signup" || pv.path === "/signin") reach(1);
      if (pv.path.startsWith("/app")) reach(3);
      if (pv.path.startsWith("/app/resume")) reach(4);
    }
    for (const ev of s.events) {
      if (ev.event === "builder_step") {
        // The guest builder is not a sign-up form until its popup opens.
        const browsing =
          ev.label === "guest_open" ||
          (ev.label === "template_click" &&
            (ev.params?.where === "resume-templates" || ev.params?.where === "home"));
        if (!browsing) reach(1);
        if (ev.label === "details_submit" || ev.label === "existing_account")
          reach(2);
        if (ev.label === "account_created" || ev.label === "login") reach(3);
        if (ev.label === "draft_created") reach(4);
      }
      if (ev.event === "signup_step") {
        reach(1);
        if (ev.label === "identify" || ev.label === "existing_account")
          reach(2);
        if (ev.label === "account_created" || ev.label === "login") reach(3);
      }
      if (
        ev.event === "tool_compute" &&
        ev.label === "resume-ats-checker" &&
        typeof ev.value === "number"
      ) {
        reach(4);
      }
    }

    const timeline: TimelineItem[] = [
      ...s.views.map((pv) => ({
        at: pv.created_at,
        kind: "page" as const,
        text: pv.path,
      })),
      ...s.events.flatMap((ev) => {
        const text = eventText(ev);
        return text
          ? [{ at: ev.created_at, kind: "event" as const, text }]
          : [];
      }),
    ].sort((a, b) => a.at.localeCompare(b.at));

    const lastAt = timeline[timeline.length - 1]?.at ?? s.first.created_at;
    journeys.push({
      session,
      startedAt: s.first.created_at,
      seconds: Math.max(
        0,
        Math.round(
          (Date.parse(lastAt) - Date.parse(s.first.created_at)) / 1000,
        ),
      ),
      city: s.first.city,
      os: s.first.os,
      browser: s.first.browser,
      device: s.first.device,
      source: s.first.source,
      campaign: s.first.campaign,
      landing: s.first.path,
      pages: s.views.length,
      furthest: Math.max(...got),
      reached: [...got].sort(),
      timeline: timeline.slice(0, 60),
    });
  }

  journeys.sort((a, b) => b.startedAt.localeCompare(a.startedAt));

  return {
    funnel: STEPS.map((step, i) => ({
      step,
      visits: journeys.filter((j) => j.reached.includes(i)).length,
    })),
    byBrowser: breakdown(journeys, (j) => j.browser),
    byOs: breakdown(journeys, (j) => j.os),
    byCity: breakdown(journeys, (j) => j.city),
    journeys: journeys.slice(0, 150),
    total: journeys.length,
    crawlers,
    truncated,
  };
}
