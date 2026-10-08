/**
 * The lifecycle rules, pinned.
 *
 * Run: node --experimental-strip-types --import ./scripts/alias-hook.mjs \
 *        lib/govt/lifecycle.test.ts
 *
 * These are the cases that cost somebody something if they drift. A deadline
 * of "today" has to stay applicable all day in India — not expire at 18:30
 * IST because a server in Virginia has already turned the page — and a date
 * we could not read has to stay `unknown` instead of falling through to
 * "open", which would tell a person they still have time to apply.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { CLOSING_SOON_DAYS, daysBetween, daysLeft, lifecycleOf, todayIn } from "@/lib/govt/lifecycle";

/** An instant, written the way a reader in India would read it. */
const ist = (s: string) => new Date(`${s}+05:30`);

test("a date-only deadline lasts the whole Indian calendar day", () => {
  // 00:30 IST on the last date: still live.
  assert.equal(lifecycleOf("2026-03-10", ist("2026-03-10T00:30:00")), "closing_soon");
  // 23:30 IST on the last date: still live. (Already 18:00 UTC — the bug this
  // test exists for would have called it closed five and a half hours early.)
  assert.equal(lifecycleOf("2026-03-10", ist("2026-03-10T23:30:00")), "closing_soon");
  // 04:30 the next morning: closed.
  assert.equal(lifecycleOf("2026-03-10", ist("2026-03-11T04:30:00")), "closed");
});

test("closing soon is a window, not a feeling", () => {
  const now = ist("2026-03-01T10:00:00");
  assert.equal(lifecycleOf("2026-03-08", now), "closing_soon"); // exactly 7 days
  assert.equal(lifecycleOf("2026-03-09", now), "open"); // 8 days
  assert.equal(CLOSING_SOON_DAYS, 7);
});

test("anything we cannot read is unknown, never open", () => {
  for (const bad of [null, "", "soon", "10/03/2026", "2026-13-40", "2026-03"]) {
    assert.equal(lifecycleOf(bad as string | null, ist("2026-03-01T10:00:00")), "unknown", String(bad));
  }
});

test("days left counts calendar days in IST, and is null when there is no date", () => {
  assert.equal(daysLeft("2026-03-10", ist("2026-03-10T23:00:00")), 0);
  assert.equal(daysLeft("2026-03-12", ist("2026-03-10T00:10:00")), 2);
  assert.equal(daysLeft(null, ist("2026-03-10T10:00:00")), null);
  assert.equal(daysLeft("not a date", ist("2026-03-10T10:00:00")), null);
});

test("the day boundary is India's, not the server's", () => {
  // 19:00 UTC on 9 March is already 10 March in Kolkata.
  assert.equal(todayIn("Asia/Kolkata", new Date("2026-03-09T19:00:00Z")), "2026-03-10");
  assert.equal(daysBetween("2026-03-10", "2026-03-10"), 0);
  assert.equal(daysBetween("2026-03-11", "2026-03-10"), -1);
  assert.equal(daysBetween("2026-02-28", "2026-03-01"), 1); // 2026 is not a leap year
  assert.equal(daysBetween("nope", "2026-03-01"), null);
});
