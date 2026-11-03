/**
 * Custom date ranges on the admin screens: the days picked are the days read,
 * and a range survives being carried through a link.
 *
 * Run with the others: npm test
 */
import assert from "node:assert/strict";
import test from "node:test";
import { istDay, istLastDay, rangeQuery, resolveRange } from "@/lib/admin/range";

test("a custom range covers both days, in India time", () => {
  const r = resolveRange({ range: "custom", from: "2026-11-01", to: "2026-11-02" });
  assert.equal(r.from, "2026-10-31T18:30:00.000Z"); // 1 Nov, 00:00 IST
  assert.equal(r.to, "2026-11-02T18:30:00.000Z"); // 3 Nov, 00:00 IST: all of 2 Nov included
  assert.equal(r.days, 2);
});

test("a custom range round-trips through a link without moving a day", () => {
  let r = resolveRange({ range: "custom", from: "2026-10-05", to: "2026-10-20" });
  for (let i = 0; i < 3; i++) {
    const q = new URLSearchParams(rangeQuery(r, { src: "all" }));
    assert.equal(q.get("from"), "2026-10-05");
    assert.equal(q.get("to"), "2026-10-20");
    assert.equal(q.get("src"), "all");
    r = resolveRange({ range: q.get("range")!, from: q.get("from")!, to: q.get("to")! });
  }
});

test("istDay names the Indian calendar day", () => {
  assert.equal(istDay("2026-11-02T18:29:59Z"), "2026-11-02");
  assert.equal(istDay("2026-11-02T18:30:00Z"), "2026-11-03");
  assert.equal(istLastDay(resolveRange({ range: "custom", from: "2026-11-02", to: "2026-11-02" })), "2026-11-02");
});
