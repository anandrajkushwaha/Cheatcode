/**
 * A guide as JSON in, one SQL INSERT out — the daily writer's publish step.
 *
 *   node --experimental-strip-types --import ./scripts/alias-hook.mjs \
 *     scripts/post-sql.ts guide.json > guide.sql
 *
 * The scheduled writer (docs/content/daily-guides.md) has the database but
 * not an admin session, so it cannot call /api/admin/post. This does the same
 * work that route does on every save — sanitise the HTML, derive the table of
 * contents from the H2s, count words, refuse a merged slug — and prints the
 * row for the writer to run. Nothing here touches the network.
 */
import { readFileSync } from "node:fs";
import { sanitiseHtml, slugify, textOf, wordCount } from "@/lib/content/sanitise";
import { withHeadingIds } from "@/lib/content/render";
import { mergedTarget } from "@/lib/seo/merged-guides";

type Guide = {
  title: string;
  slug?: string;
  excerpt: string;
  content_html: string;
  category: string;
  seo_title?: string;
  seo_description?: string;
  focus_keyword: string;
  secondary_keywords?: string[];
  faq?: { q: string; a: string }[];
  related_tool_slugs?: string[];
  /** ISO time; defaults to now. */
  published_at?: string;
};

const EDITORIAL_AUTHOR = "cheatcode-team";

function fail(msg: string): never {
  console.error(`post-sql: ${msg}`);
  process.exit(1);
}

const file = process.argv[2];
if (!file) fail("give the guide's JSON file");
const g = JSON.parse(readFileSync(file, "utf8")) as Guide;

const title = (g.title ?? "").trim();
if (!title) fail("title is empty");
const slug = slugify(g.slug || title);
if (!slug) fail("no slug");
if (mergedTarget(slug)) fail(`/blog/${slug} is a merged guide; pick another slug`);

const html = sanitiseHtml(g.content_html ?? "");
const words = wordCount(html);
if (words < 900) fail(`only ${words} words; a guide needs at least 900`);
const excerpt = (g.excerpt ?? "").trim();
if (excerpt.length < 120) fail("excerpt must be the 2–3 sentence direct answer (120+ characters)");
if (!g.focus_keyword?.trim()) fail("focus_keyword is empty");

const toc = [...withHeadingIds(html, []).matchAll(/<h2[^>]*\sid="([^"]+)"[^>]*>([\s\S]*?)<\/h2>/g)].map((m) => ({
  id: m[1],
  text: textOf(m[2]),
}));
const internal = [...html.matchAll(/href="(\/blog\/[a-z0-9-]+)"/g)].map((m) => m[1]);
if (new Set(internal).size < 3) fail(`only ${new Set(internal).size} links to other guides; link at least 3`);

// Dollar quoting with a tag the text cannot contain, so no escaping is needed.
const tag = `$cc${Math.random().toString(36).slice(2, 8)}$`;
const q = (s: string) => {
  if (s.includes(tag)) fail("text contains the quote tag; run again");
  return `${tag}${s}${tag}`;
};
const arr = (xs: string[] = []) => `ARRAY[${xs.map((x) => q(x)).join(",")}]::text[]`;
const json = (v: unknown) => `${q(JSON.stringify(v))}::jsonb`;
const now = new Date().toISOString();
const at = g.published_at ? new Date(g.published_at).toISOString() : now;

process.stdout.write(`insert into posts (
  slug, title, h1, excerpt, content_html, toc, category_id, author_id,
  seo_title, seo_description, focus_keyword, secondary_keywords, faq,
  related_tool_slugs, status, published_at, updated_at, last_edited_at,
  word_count, reading_minutes, origin, post_type
) values (
  ${q(slug)}, ${q(title)}, ${q(title)}, ${q(excerpt)}, ${q(html)}, ${json(toc)},
  (select id from categories where slug = ${q(g.category)}),
  (select id from authors where slug = ${q(EDITORIAL_AUTHOR)}),
  ${q((g.seo_title ?? "").trim() || title.slice(0, 62))},
  ${q((g.seo_description ?? "").trim() || excerpt.slice(0, 158))},
  ${q(g.focus_keyword.trim())}, ${arr(g.secondary_keywords)}, ${json(g.faq ?? [])},
  ${arr(g.related_tool_slugs)}, 'published', ${q(at)}, ${q(now)}, ${q(now)},
  ${words}, ${Math.max(1, Math.round(words / 210))}, 'editor', 'editorial'
) returning slug;
`);
console.error(`post-sql: /blog/${slug} · ${words} words · ${toc.length} sections · ${new Set(internal).size} guide links`);
