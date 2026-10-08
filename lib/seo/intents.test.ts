/**
 * The keyword-to-URL map stays honest.
 *
 * Run with the others: npm test
 *
 * Two ways it rots: a second page is added for a query an existing page
 * already owns, or a page is moved and its entry still points at the old
 * path. Both fail here rather than in Search Console a month later.
 */
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import test from "node:test";
import {
  INTENTS,
  SCORE_WEIGHTS,
  cannibalised,
  contentTypeFor,
  ownerOf,
  publishScore,
} from "@/lib/seo/intents";

test("no keyword is claimed by two URLs", () => {
  assert.deepEqual(cannibalised(), []);
});

test("no URL is listed twice", () => {
  const paths = INTENTS.map((i) => i.path);
  assert.equal(new Set(paths).size, paths.length);
});

test("every mapped URL is a route that exists", () => {
  const route = (p: string) =>
    p === "/"
      ? ["app/page.tsx"]
      : [`app/(content)${p}/page.tsx`, `app${p}/page.tsx`];
  for (const i of INTENTS) {
    assert.ok(route(i.path).some((f) => existsSync(f)), `no page for ${i.path}`);
  }
});

test("a clash between two URLs is reported", () => {
  const clash = cannibalised([
    { path: "/a", type: "guide", pillar: "resume", keywords: ["resume format"] },
    { path: "/b", type: "guide", pillar: "resume", keywords: ["Resume  Format"] },
  ]);
  assert.deepEqual(clash, [{ keyword: "resume format", paths: ["/a", "/b"] }]);
});

test("lookup ignores case and spacing", () => {
  assert.equal(ownerOf("  ATS Resume   Checker ")?.path, "/tools/resume-ats-checker");
  assert.equal(ownerOf("a query nobody owns"), null);
});

test("a salary question is a calculator, a trend is Insights", () => {
  assert.equal(contentTypeFor("salary-calculation"), "calculator");
  assert.equal(contentTypeFor("current-trend"), "insights");
  assert.equal(contentTypeFor("evergreen-question"), "guide");
});

test("the weights sum to 100 and the thresholds sit at 70 and 85", () => {
  assert.equal(Object.values(SCORE_WEIGHTS).reduce((a, b) => a + b, 0), 100);
  const all = (v: number) =>
    Object.fromEntries(Object.keys(SCORE_WEIGHTS).map((k) => [k, v])) as Parameters<
      typeof publishScore
    >[0];
  assert.deepEqual(publishScore(all(1)), { score: 100, verdict: "high-priority" });
  assert.deepEqual(publishScore(all(0.85)), { score: 85, verdict: "high-priority" });
  assert.deepEqual(publishScore(all(0.7)), { score: 70, verdict: "publish-if-justified" });
  assert.deepEqual(publishScore(all(0.69)), { score: 69, verdict: "do-not-publish" });
  // Out-of-range and missing input cannot inflate a score.
  assert.equal(publishScore({ ...all(0), searchDemand: 5 }).score, 20);
  assert.equal(publishScore({ ...all(1), originality: Number.NaN }).score, 85);
});
