/**
 * SEO audit of every published guide → seo-audit.csv (SEO PRD, section D).
 *
 *   node --experimental-strip-types --import ./scripts/alias-hook.mjs \
 *     scripts/seo-audit.ts posts.json [out.csv]
 *
 * posts.json is an array of published posts with slug, title, seo_title,
 * seo_description, h1, focus_keyword, cat (category slug) and content_html
 * — an export from the posts table. Links are counted as the page serves
 * them: the stored body plus the contextual links added at render time
 * (lib/content/autolink.ts).
 *
 * Per post: words, internal links in from other guides, internal links out,
 * and the most similar sibling in its hub group (or category) by Jaccard
 * similarity of five-word shingles. Rows are sorted worst first.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { autolink, KEYWORD_LINKS, localPath, type LinkTarget } from "@/lib/content/autolink";
import { groupForHub } from "@/lib/content/hub-groups";

type Post = {
  slug: string;
  title: string;
  seo_title: string | null;
  seo_description: string | null;
  h1: string | null;
  focus_keyword: string | null;
  cat: string | null;
  content_html: string;
};

const [input, out = "seo-audit.csv"] = process.argv.slice(2);
if (!input) throw new Error("usage: seo-audit.ts posts.json [out.csv]");
const posts = JSON.parse(readFileSync(input, "utf8")) as Post[];

const live = new Set(posts.map((p) => `/blog/${p.slug}`));
const targets: LinkTarget[] = [
  ...KEYWORD_LINKS.filter((t) => !t.href.startsWith("/blog/") || live.has(t.href)),
  ...posts
    .filter((p) => p.focus_keyword && p.focus_keyword.trim().split(/\s+/).length >= 2 && p.focus_keyword.length >= 10)
    .map((p) => ({ phrase: p.focus_keyword!.trim(), href: `/blog/${p.slug}` })),
];

const text = (html: string) =>
  html.replace(/<(script|style)[\s\S]*?<\/\1>/gi, " ").replace(/<[^>]+>/g, " ").replace(/&[a-z#0-9]+;/gi, " ").toLowerCase();
const words = (html: string) => text(html).split(/\s+/).filter(Boolean);
function shingles(html: string): Set<string> {
  const w = words(html);
  const s = new Set<string>();
  for (let i = 0; i + 5 <= w.length; i++) s.add(w.slice(i, i + 5).join(" "));
  return s;
}
function jaccard(a: Set<string>, b: Set<string>): number {
  if (!a.size || !b.size) return 0;
  let inter = 0;
  for (const x of a) if (b.has(x)) inter++;
  return inter / (a.size + b.size - inter);
}

const served = new Map(posts.map((p) => [p.slug, autolink(p.content_html, targets, `/blog/${p.slug}`)]));
const outLinks = new Map<string, Set<string>>();
const inbound = new Map<string, number>();
for (const p of posts) {
  const set = new Set<string>();
  for (const m of served.get(p.slug)!.matchAll(/<a\b[^>]*\bhref\s*=\s*["']([^"']+)["']/gi)) {
    const path = localPath(m[1]);
    if (path && path !== `/blog/${p.slug}` && (path.startsWith("/blog/") || path.startsWith("/tools/"))) set.add(path);
  }
  outLinks.set(p.slug, set);
  for (const path of set) if (path.startsWith("/blog/")) inbound.set(path, (inbound.get(path) ?? 0) + 1);
}

// Clusters: the hub group a post is in, or its category.
const cluster = new Map<string, string>();
const byCat = new Map<string, Post[]>();
for (const p of posts) byCat.set(p.cat ?? "none", [...(byCat.get(p.cat ?? "none") ?? []), p]);
for (const [cat, list] of byCat) {
  const groups = groupForHub(cat, list);
  if (groups) groups.forEach((g) => g.posts.forEach((p) => cluster.set(p.slug, `${cat}/${g.title}`)));
  else list.forEach((p) => cluster.set(p.slug, cat));
}
const sh = new Map(posts.map((p) => [p.slug, shingles(p.content_html)]));

const dupTitle = new Map<string, number>();
const dupDesc = new Map<string, number>();
for (const p of posts) {
  const t = (p.seo_title ?? p.title).trim().toLowerCase();
  dupTitle.set(t, (dupTitle.get(t) ?? 0) + 1);
  const d = (p.seo_description ?? "").trim().toLowerCase();
  if (d) dupDesc.set(d, (dupDesc.get(d) ?? 0) + 1);
}

const rows = posts.map((p) => {
  const sibs = posts.filter((q) => q.slug !== p.slug && cluster.get(q.slug) === cluster.get(p.slug));
  let best = 0;
  let bestSlug = "";
  for (const q of sibs) {
    const j = jaccard(sh.get(p.slug)!, sh.get(q.slug)!);
    if (j > best) [best, bestSlug] = [j, q.slug];
  }
  const h1s = (p.content_html.match(/<h1\b/gi) ?? []).length;
  const issues = [
    words(p.content_html).length < 800 ? "thin" : "",
    (inbound.get(`/blog/${p.slug}`) ?? 0) < 3 ? "few-inbound" : "",
    outLinks.get(p.slug)!.size < 3 ? "few-outbound" : "",
    best >= 0.8 ? "near-duplicate" : best >= 0.5 ? "similar" : "",
    dupTitle.get((p.seo_title ?? p.title).trim().toLowerCase())! > 1 ? "dup-title" : "",
    p.seo_description && dupDesc.get(p.seo_description.trim().toLowerCase())! > 1 ? "dup-description" : "",
    !p.seo_description ? "no-description" : "",
    h1s > 0 ? "h1-in-body" : "",
  ].filter(Boolean);
  return {
    slug: p.slug,
    cluster: cluster.get(p.slug) ?? "",
    words: words(p.content_html).length,
    inbound: inbound.get(`/blog/${p.slug}`) ?? 0,
    outbound: outLinks.get(p.slug)!.size,
    similarity: Math.round(best * 100) / 100,
    most_similar: bestSlug,
    issues: issues.join(" "),
    // Worst first: issues weighted, then fewest inbound, then fewest words.
    score: issues.length * 1000 - (inbound.get(`/blog/${p.slug}`) ?? 0) * 10 - words(p.content_html).length / 100,
  };
});
rows.sort((a, b) => b.score - a.score);

const cols = ["slug", "cluster", "words", "inbound", "outbound", "similarity", "most_similar", "issues"] as const;
const csv = [cols.join(","), ...rows.map((r) => cols.map((c) => `"${String(r[c]).replace(/"/g, '""')}"`).join(","))].join("\n");
writeFileSync(out, csv + "\n");

const count = (k: string) => rows.filter((r) => r.issues.split(" ").includes(k)).length;
console.log(`${rows.length} posts → ${out}`);
for (const k of ["thin", "few-inbound", "few-outbound", "near-duplicate", "similar", "dup-title", "dup-description", "no-description", "h1-in-body"]) {
  console.log(`  ${k}: ${count(k)}`);
}
console.log("\nWorst 30:");
for (const r of rows.slice(0, 30)) {
  console.log(`  ${r.slug} — ${r.words}w, in ${r.inbound}, out ${r.outbound}, sim ${r.similarity}${r.most_similar ? ` (${r.most_similar})` : ""} — ${r.issues}`);
}
