/**
 * Where a recruitment is in its deadline lifecycle.
 *
 * One function, used by the hub sections, the list filters, the badges, the
 * detail page and the archive. Not because sharing code is tidy, but because
 * the alternative has been seen: a badge that says "Closing soon" on a page a
 * filter has already dropped, and nobody able to say which is right. A single
 * derivation cannot disagree with itself.
 *
 * Two things this is NOT:
 *
 * It is not proof that applications are being accepted. A deadline in the
 * future means the stated closing date has not passed; it does not mean the
 * portal is open, the notice has not been cancelled, or that applications
 * have started. That claim needs evidence from the source, and the page keeps
 * the two apart.
 *
 * And it is never guessed. A missing, unparsed or contradictory closing date
 * returns `unknown` and the page says the dates are not stated. Falling
 * through to "open" would be telling somebody they still have time to apply,
 * which is the one mistake on a page like this that costs a person something
 * real.
 */

/** How close is "closing soon". One place, so a badge and a filter agree. */
export const CLOSING_SOON_DAYS = 7;

/**
 * The calendar these dates belong to.
 *
 * A notification says "20 October 2026" and means a day in India, not an
 * instant. Compared in UTC, a date-only deadline flips to closed at 5:30am
 * IST on the last day — while the portal is still open and people are still
 * applying. So both sides of the comparison are reduced to an Indian
 * calendar day first, and nothing here ever constructs a timestamp.
 */
export const RECRUITMENT_TZ = "Asia/Kolkata";

export type Lifecycle = "open" | "closing_soon" | "closed" | "unknown";

export const LIFECYCLE_LABEL: Record<Lifecycle, string> = {
  open: "Open",
  closing_soon: "Closing soon",
  closed: "Closed",
  unknown: "Dates not stated",
};

/** Today in India, as `YYYY-MM-DD`. Takes a clock so tests can move it. */
export function todayIn(tz: string = RECRUITMENT_TZ, now: Date = new Date()): string {
  // `en-CA` formats as YYYY-MM-DD, which is the one locale that gives an ISO
  // date back without string surgery on a formatted day/month/year.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

const ISO = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Whole calendar days from `from` to `to`, both `YYYY-MM-DD`.
 *
 * Counted on the dates themselves rather than by subtracting timestamps: the
 * point of a date-only comparison is that no clock, offset or daylight-saving
 * rule can get between the two values.
 */
export function daysBetween(from: string, to: string): number | null {
  if (!ISO.test(from) || !ISO.test(to)) return null;
  const a = Date.parse(`${from}T00:00:00Z`);
  const b = Date.parse(`${to}T00:00:00Z`);
  if (Number.isNaN(a) || Number.isNaN(b)) return null;
  return Math.round((b - a) / 86_400_000);
}

/**
 * The lifecycle state of one closing date.
 *
 * `lastDate` is the verified application closing date and nothing else — not
 * the notification date, not the application start, not the exam date, not
 * when we imported it. Null when it was never stated or could not be read,
 * and the two are kept apart upstream even though both land here as unknown.
 *
 * The boundaries, stated once so a test can hold them to it:
 *   past          → closed
 *   today         → closing_soon, all of today
 *   within N days → closing_soon, N inclusive
 *   beyond N      → open
 */
export function lifecycleOf(
  lastDate: string | null | undefined,
  now: Date = new Date(),
  closingSoonDays: number = CLOSING_SOON_DAYS,
): Lifecycle {
  if (!lastDate || !ISO.test(lastDate)) return "unknown";

  const left = daysBetween(todayIn(RECRUITMENT_TZ, now), lastDate);
  if (left === null) return "unknown";

  if (left < 0) return "closed";
  return left <= closingSoonDays ? "closing_soon" : "open";
}

/** Days until the deadline, in Indian calendar days. Null when unknown. */
export function daysLeft(lastDate: string | null | undefined, now: Date = new Date()): number | null {
  if (!lastDate || !ISO.test(lastDate)) return null;
  return daysBetween(todayIn(RECRUITMENT_TZ, now), lastDate);
}
