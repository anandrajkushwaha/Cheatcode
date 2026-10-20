/**
 * How hub categories group their guides.
 *
 * Run with the others: npm test
 */
import assert from "node:assert/strict";
import test from "node:test";
import { groupForHub, packageLakhs } from "@/lib/content/hub-groups";

const posts = (...slugs: string[]) => slugs.map((slug) => ({ slug }));

test("resume formats group by reader, and nothing is dropped", () => {
  const g = groupForHub(
    "resume-format",
    posts("bcom-fresher-resume-format", "java-developer-resume-format", "banking-resume-format", "nurse-resume-format", "hobbies-in-resume"),
  )!;
  assert.deepEqual(
    g.map((x) => [x.title, x.posts.map((p) => p.slug)]),
    [
      ["For freshers and students", ["bcom-fresher-resume-format"]],
      ["Engineering and tech roles", ["java-developer-resume-format"]],
      ["Business, finance and management roles", ["banking-resume-format"]],
      ["Other professions", ["nurse-resume-format"]],
      ["Resume sections and tips", ["hobbies-in-resume"]],
    ],
  );
});

test("in-hand pages sort by package, crore last", () => {
  const g = groupForHub("salary", posts("1-crore-in-hand-salary", "12-lpa-in-hand-salary", "3-lpa-in-hand-salary", "how-to-negotiate-salary"))!;
  assert.deepEqual(g[0].posts.map((p) => p.slug), ["3-lpa-in-hand-salary", "12-lpa-in-hand-salary", "1-crore-in-hand-salary"]);
  assert.equal(packageLakhs("1-crore-in-hand-salary"), 100);
});

test("a category that is not a hub is not grouped", () => {
  assert.equal(groupForHub("linkedin", posts("a")), null);
});

test("series: package order on in-hand pages, with the calculator as hub", async () => {
  const { seriesFor } = await import("@/lib/content/series");
  const p = (slug: string) => ({ slug, title: slug });
  const list = [p("20-lpa-in-hand-salary"), p("14-lpa-in-hand-salary"), p("16-lpa-in-hand-salary"), p("how-to-negotiate-salary")];
  const s = seriesFor("salary", "Salary", list, "16-lpa-in-hand-salary")!;
  assert.equal(s.prev?.label, "14 LPA");
  assert.equal(s.next?.label, "20 LPA");
  assert.equal(s.hub.href, "/tools/in-hand-salary-calculator");
  assert.equal(seriesFor("linkedin", "LinkedIn", list, "x"), null);
});
