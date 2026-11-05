/**
 * The list screens' periods: what counts as "this period", "the one before",
 * and the sparkline counts.
 *
 * Run with the others: npm test
 */
import assert from "node:assert/strict";
import test from "node:test";
import { daily, periodOf, split } from "@/lib/admin/period";
import { resolveRange } from "@/lib/admin/range";

const NOW = Date.parse("2026-11-05T12:00:00Z");
const ago = (days: number) => new Date(NOW - days * 86_400_000).toISOString();

test("7 days is compared with the 7 days before it", () => {
  const p = periodOf(resolveRange({ range: "7d" }), NOW);
  const rows = [ago(1), ago(3), ago(6.9), ago(8), ago(13), ago(20)].map((at) => ({ at }));
  const { now, before } = split(rows, (r) => r.at, p);
  assert.equal(now.length, 3);
  assert.equal(before.length, 2);
  assert.equal(p.beforeWord, "in the 7 days before");
});

test("All time takes everything and compares with nothing", () => {
  const p = periodOf(resolveRange({ range: "all" }), NOW);
  const rows = [ago(1), ago(400)].map((at) => ({ at }));
  const { now, before } = split(rows, (r) => r.at, p);
  assert.equal(now.length, 2);
  assert.equal(before.length, 0);
  assert.equal(p.all, true);
});

test("daily counts land in the right day and add up", () => {
  const p = periodOf(resolveRange({ range: "7d" }), NOW);
  const rows = [ago(0.5), ago(0.6), ago(5.5)].map((at) => ({ at }));
  const s = daily(rows, (r) => r.at, p, NOW);
  assert.equal(s.length, 7);
  assert.equal(s.reduce((a, b) => a + b, 0), 3);
  assert.equal(s[s.length - 1], 2);
});
