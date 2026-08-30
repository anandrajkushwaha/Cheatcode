/**
 * The date range every dashboard screen shares.
 *
 * One module rather than a copy per page, because the ranges have to agree:
 * if Overview says "28 days" and Traffic quietly means 30, the two screens
 * disagree by 7% and nobody can tell which is wrong.
 *
 * Everything is anchored to IST, since that is where the audience is and where
 * "today" is being asked about.
 */

export const IST = "Asia/Kolkata";

export type RangeId = "today" | "24h" | "7d" | "28d" | "90d" | "custom";

export const RANGES: { id: RangeId; label: string; days: number }[] = [
  { id: "today", label: "Today", days: 1 },
  { id: "24h", label: "24 hours", days: 1 },
  { id: "7d", label: "7 days", days: 7 },
  { id: "28d", label: "28 days", days: 28 },
  { id: "90d", label: "90 days", days: 90 },
];

export type Range = {
  id: RangeId;
  label: string;
  days: number;
  /** Only set for "today" and "custom" — otherwise the RPC uses p_days. */
  from?: string;
  to?: string;
};

/** Midnight IST today, as an instant. */
function istMidnight(): Date {
  const now = new Date();
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: IST, year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)!.value;
  // IST is UTC+5:30 year-round, so this is exact without a tz library.
  return new Date(`${get("year")}-${get("month")}-${get("day")}T00:00:00+05:30`);
}

const isDate = (s: string | undefined): s is string =>
  !!s && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s));

/**
 * Resolve the range from the query string. Falls back to 7 days for anything
 * unrecognised, so a hand-edited URL can never render a broken screen.
 */
export function resolveRange(sp: { range?: string; from?: string; to?: string }): Range {
  if (sp.range === "custom" && isDate(sp.from) && isDate(sp.to)) {
    const from = new Date(`${sp.from}T00:00:00+05:30`);
    // Inclusive of the end day: through the end of it, not up to its start.
    const to = new Date(`${sp.to}T00:00:00+05:30`);
    to.setDate(to.getDate() + 1);
    if (to > from) {
      const days = Math.max(1, Math.round((+to - +from) / 864e5));
      return {
        id: "custom",
        label: `${sp.from} to ${sp.to}`,
        days,
        from: from.toISOString(),
        to: to.toISOString(),
      };
    }
  }

  if (sp.range === "today") {
    const from = istMidnight();
    return {
      id: "today",
      label: "Today",
      days: 1,
      from: from.toISOString(),
      to: new Date().toISOString(),
    };
  }

  const found = RANGES.find((r) => r.id === sp.range);
  if (found) return { id: found.id, label: found.label, days: found.days };
  return { id: "7d", label: "7 days", days: 7 };
}

/** Preserve the active range when linking between admin screens. */
export function rangeQuery(r: Range, extra: Record<string, string | number> = {}) {
  const q = new URLSearchParams();
  q.set("range", r.id);
  if (r.id === "custom" && r.from && r.to) {
    q.set("from", r.from.slice(0, 10));
    q.set("to", new Date(new Date(r.to).getTime() - 864e5).toISOString().slice(0, 10));
  }
  for (const [k, v] of Object.entries(extra)) q.set(k, String(v));
  return q.toString();
}

/** "the last 7 days", "today", "1 Aug to 20 Aug" — for prose. */
export function rangeWords(r: Range) {
  if (r.id === "today") return "today so far";
  if (r.id === "24h") return "the last 24 hours";
  if (r.id === "custom") return r.label;
  return `the last ${r.days} days`;
}
