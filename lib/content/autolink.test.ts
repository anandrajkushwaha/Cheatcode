/**
 * Contextual links added to articles at render time.
 *
 * Run with the others: npm test
 */
import assert from "node:assert/strict";
import test from "node:test";
import { autolink, localPath } from "@/lib/content/autolink";

const T = [
  { phrase: "expected CTC", href: "/blog/expected-ctc-question" },
  { phrase: "notice period", href: "/blog/notice-period-rules-india" },
  { phrase: "in-hand salary calculator", href: "/tools/in-hand-salary-calculator" },
  { phrase: "in-hand salary", href: "/blog/ctc-vs-in-hand-salary" },
  { phrase: "UAN", href: "/blog/uan", caseSensitive: true },
];

test("first occurrence only, keeping the reader's casing", () => {
  const out = autolink("<p>Your Expected CTC matters. expected CTC again.</p>", T, "/blog/x");
  assert.equal(out, '<p>Your <a href="/blog/expected-ctc-question">Expected CTC</a> matters. expected CTC again.</p>');
});

test("never in headings, links or code, and never to itself", () => {
  const html =
    '<h2>Notice period</h2><p><a href="/x">notice period</a> <code>expected CTC</code></p><p>notice period</p>';
  const out = autolink(html, T, "/blog/notice-period-rules-india");
  assert.equal(out, html);
});

test("a page already linked is not linked again", () => {
  const html = '<p>See <a href="https://www.cheatcodeapp.com/blog/expected-ctc-question/">this</a>. Expected CTC.</p>';
  assert.equal(autolink(html, T, "/blog/x"), html);
});

test("longest phrase wins and nothing nests", () => {
  const out = autolink("<p>Use the in-hand salary calculator.</p>", T, "/blog/x");
  assert.equal(out, '<p>Use the <a href="/tools/in-hand-salary-calculator">in-hand salary calculator</a>.</p>');
});

test("case-sensitive phrases and the cap", () => {
  assert.equal(autolink("<p>a guan b</p>", T, "/blog/x"), "<p>a guan b</p>");
  const out = autolink("<p>expected CTC, notice period, UAN</p>", T, "/blog/x", 2);
  assert.equal((out.match(/<a /g) ?? []).length, 2);
});

test("local paths from any form of href", () => {
  assert.equal(localPath("https://cheatcodeapp.com/blog/a/#faq"), "/blog/a");
  assert.equal(localPath("/tools"), "/tools");
  assert.equal(localPath("https://example.com/blog/a"), null);
});
