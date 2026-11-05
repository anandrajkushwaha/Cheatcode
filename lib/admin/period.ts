import type { Range } from "@/lib/admin/range";

/**
 * A screen's period, the one before it, and per-day counts for a sparkline —
 * shared by the list screens (People, ATS leads, Pro interest) so their
 * cards move with the date switch the way the Dashboard's do.
 *
 * "All time" has no period before it; its cards show totals without a change.
 */

const DAY = 86_400_000;

export type Period = {
  all: boolean;
  lo: number;
  hi: number;
  prevLo: number;
  prevHi: number;
  /** "yesterday by now", "in the 7 days before"… for card hints. */
  beforeWord: string;
};

export function periodOf(range: Range, now = Date.now()): Period {
  if (range.id === "all") return { all: true, lo: 0, hi: Infinity, prevLo: 0, prevHi: 0, beforeWord: "" };
  const hi = range.to ? new Date(range.to).getTime() : now;
  const lo = range.from ? new Date(range.from).getTime() : hi - range.days * DAY;
  if (range.id === "today") return { all: false, lo, hi, prevLo: lo - DAY, prevHi: hi - DAY, beforeWord: "yesterday by now" };
  const len = hi - lo;
  const word =
    range.id === "24h" ? "in the 24 hours before" : range.id === "custom" ? "in the period before" : `in the ${range.days} days before`;
  return { all: false, lo, hi, prevLo: lo - len, prevHi: lo, beforeWord: word };
}

/** Rows of the period and of the period before, by a timestamp field. */
export function split<T>(rows: T[], at: (r: T) => string, p: Period): { now: T[]; before: T[] } {
  const now: T[] = [];
  const before: T[] = [];
  for (const r of rows) {
    const t = new Date(at(r)).getTime();
    if (t >= p.lo && t < p.hi) now.push(r);
    else if (!p.all && t >= p.prevLo && t < p.prevHi) before.push(r);
  }
  return { now, before };
}

/**
 * Counts per India day across the period, for a sparkline. "All time" runs
 * from the earliest row, a week per point once that is longer than 90 days.
 */
export function daily<T>(rows: T[], at: (r: T) => string, p: Period, now = Date.now()): number[] {
  const times = rows.map((r) => new Date(at(r)).getTime()).filter((t) => t >= p.lo && t < p.hi);
  const start = p.all ? Math.min(now, ...times) : p.lo;
  const end = Math.min(p.hi, now);
  const span = Math.max(DAY, end - start);
  const step = span > 90 * DAY ? 7 * DAY : DAY;
  const n = Math.max(1, Math.ceil(span / step));
  const out = new Array(n).fill(0);
  for (const t of times) {
    const i = Math.min(n - 1, Math.floor((t - start) / step));
    if (i >= 0) out[i] += 1;
  }
  return out;
}
