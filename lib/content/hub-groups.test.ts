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
