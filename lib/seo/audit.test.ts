/**
 * What the article audit calls a problem.
 *
 * Run with the others: npm test
 */
import assert from "node:assert/strict";
import test from "node:test";
import { auditPosts, blogLinks, keywordKey, type AuditPost } from "@/lib/seo/audit";

const body = (extra = "", words = 1500) =>
  `<p>resume format ${"word ".repeat(words)}</p>` +
  "<h2>a</h2><h2>b</h2><h2>c</h2><h2>d</h2><h2>e</h2><table><tr><td>x</td></tr></table>" +
  extra;

const post = (p: Partial<AuditPost> & { slug: string }): AuditPost => ({
  title: "Resume format guide",
  seo_title: "Resume format for freshers in India — 2026 guide",
  seo_description: "x".repeat(130),
  focus_keyword: "resume format",
  content_html: body(),
  faq: [1, 2, 3, 4],
  ...p,
});

test("one search written two ways is one keyword", () => {
  assert.equal(keywordKey("Resume format for freshers"), keywordKey("freshers resume format"));
  assert.equal(keywordKey("B.Tech fresher resume"), keywordKey("btech fresher resume"));
  assert.notEqual(keywordKey("free resume builder"), keywordKey("resume builder"));
});

test("blog links are read from absolute and relative hrefs, fragments dropped", () => {
  const html =
    '<a href="/blog/a">x</a><a href="https://cheatcodeapp.com/blog/b#faq">y</a>' +
    "<a href='/blog/category/c'>z</a><a href=\"/tools\">t</a>";
  assert.deepEqual(blogLinks(html), ["a", "b"]);
});

test("a clean, linked article has no issues", () => {
  const a = post({ slug: "a", content_html: body('<a href="/blog/b">b</a><a href="/blog/c">c</a>') });
  const b = post({
    slug: "b",
    focus_keyword: "cv format",
    title: "CV format",
    seo_title: "CV format for freshers in India — 2026 guide",
    content_html: body('<a href="/blog/a">a</a><a href="/blog/c">c</a>').replace("resume format", "cv format"),
  });
  const c = post({
    slug: "c",
    focus_keyword: "biodata format",
    title: "Biodata format",
    seo_title: "Biodata format for jobs in India — 2026 guide",
    content_html: body('<a href="/blog/a">a</a><a href="/blog/b">b</a>').replace("resume format", "biodata format"),
  });
  const { posts, cannibalised } = auditPosts([a, b, c]);
  assert.deepEqual(cannibalised, []);
  for (const p of posts) assert.deepEqual(p.issues, [], p.slug);
});

test("duplicates, dead links, orphans and thin pages are flagged", () => {
  const { posts, cannibalised } = auditPosts([
    post({ slug: "a", content_html: body('<a href="/blog/gone">x</a>') }),
    post({ slug: "b", focus_keyword: "Resume formats", content_html: "<p>tiny</p>" }),
  ]);
  assert.equal(cannibalised.length, 1);
  const a = posts.find((p) => p.slug === "a")!;
  const b = posts.find((p) => p.slug === "b")!;
  const codes = (p: typeof a) => p.issues.map((i) => i.code);
  assert.ok(codes(a).includes("cannibalised"));
  assert.ok(codes(a).includes("dead-links"));
  assert.ok(codes(a).includes("orphan"));
  assert.ok(codes(b).includes("thin"));
  // Worst first.
  assert.equal(posts[0].slug, "b");
});
