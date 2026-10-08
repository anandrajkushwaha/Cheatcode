/**
 * What ?page= is allowed to be.
 *
 * Run with the others: npm test
 *
 * These URLs get shared, truncated and typed by hand, and crawlers try
 * things. Every bad input has to land on page one rather than on a 500 or,
 * worse, on a negative range that Postgres answers with an empty list that
 * looks exactly like "nothing published".
 */
import assert from "node:assert/strict";
import test from "node:test";
import { pageFrom, pagedMetadata } from "@/lib/govt/paging";

test("anything that is not a real page number is page one", () => {
  for (const bad of [undefined, "", "0", "-3", "abc", "1.5", "99999999", " ", "2x"]) {
    assert.equal(pageFrom(bad === undefined ? undefined : { page: bad }), 1, String(bad));
  }
  assert.equal(pageFrom({}), 1);
});

test("a real page number survives, including as a repeated param", () => {
  assert.equal(pageFrom({ page: "2" }), 2);
  assert.equal(pageFrom({ page: "47" }), 47);
  assert.equal(pageFrom({ page: ["3", "9"] }), 3);
});

test("page two canonicalises to itself, not to page one", () => {
  const base = {
    title: "Sarkari Result 2026",
    alternates: { canonical: "https://x/government-jobs/results" },
  };
  const two = pagedMetadata(base, "results", 2);
  assert.match(String(two.alternates?.canonical), /\/government-jobs\/results\?page=2$/);
  assert.match(String(two.title), /Page 2$/);

  // Page one is untouched — same object, so no accidental "— Page 1".
  assert.equal(pagedMetadata(base, "results", 1), base);
});
