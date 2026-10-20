#!/usr/bin/env node
/**
 * Crawl the live site the way a search engine without JavaScript would, and
 * check it against the sitemap (SEO PRD, section 8).
 *
 *   node scripts/crawl-check.mjs [https://www.cheatcodeapp.com] [--max=1500]
 *
 * Starts at the homepage and follows only <a href> links in the server HTML,
 * on the same host, skipping rel=nofollow. Then fetches every sitemap URL.
 * Reports:
 *   - reachable URLs vs sitemap URLs, and the orphans (in the sitemap, never
 *     reached by following links) — should be 0
 *   - click depth per URL — should be at most 3
 *   - inbound internal links per URL (distinct linking pages) — at least 3
 *   - internal links that point at a redirect, a 404 or a noindex page
 *   - sitemap URLs that are not 200 or whose canonical is not themselves
 *   - the 20 URLs to submit first in Search Console's URL Inspection
 * Writes the full table to crawl-report.csv.
 *
 * Needs Node 18+ (global fetch). Polite: 4 requests at a time.
 */
import { writeFileSync } from "node:fs";

const args = process.argv.slice(2);
const ORIGIN = (args.find((a) => a.startsWith("http")) ?? "https://www.cheatcodeapp.com").replace(/\/$/, "");
const MAX = Number(args.find((a) => a.startsWith("--max="))?.slice(6) ?? 1500);
const HOST = new URL(ORIGIN).host;
const UA = "CheatcodeCrawlCheck/1.0 (+site audit)";

const pages = new Map(); // url -> { status, location, noindex, canonical, links: Set, depth }
const inbound = new Map(); // url -> Set(source url)

function norm(href, base) {
  try {
    const u = new URL(href, base);
    if (u.host !== HOST || !/^https?:$/.test(u.protocol)) return null;
    u.hash = "";
    return u.toString();
  } catch {
    return null;
  }
}

async function fetchPage(url) {
  try {
    const res = await fetch(url, { redirect: "manual", headers: { "user-agent": UA } });
    const status = res.status;
    const location = res.headers.get("location");
    const type = res.headers.get("content-type") ?? "";
    const html = status === 200 && type.includes("text/html") ? await res.text() : "";
    const robots = /<meta[^>]+name=["']robots["'][^>]*content=["']([^"']+)/i.exec(html)?.[1] ?? res.headers.get("x-robots-tag") ?? "";
    const canonical = /<link[^>]+rel=["']canonical["'][^>]*href=["']([^"']+)/i.exec(html)?.[1] ?? null;
    const links = new Set();
    for (const m of html.matchAll(/<a\b([^>]*)>/gi)) {
      const attrs = m[1];
      const href = /\bhref\s*=\s*["']([^"']+)["']/i.exec(attrs)?.[1];
      if (!href || /\brel\s*=\s*["'][^"']*nofollow/i.test(attrs)) continue;
      const n = norm(href, url);
      if (n) links.add(n);
    }
    return { status, location, noindex: /noindex/i.test(robots), canonical, links };
  } catch (e) {
    return { status: 0, location: null, noindex: false, canonical: null, links: new Set(), error: String(e) };
  }
}

async function pool(items, n, fn) {
  const queue = [...items];
  await Promise.all(Array.from({ length: n }, async () => {
    while (queue.length) await fn(queue.shift());
  }));
}

// ---- crawl, breadth first, so depth is the shortest click path
const start = `${ORIGIN}/`;
let frontier = [start];
pages.set(start, { depth: 0 });
for (let depth = 0; frontier.length && pages.size < MAX; depth++) {
  const next = [];
  await pool(frontier, 4, async (url) => {
    const p = await fetchPage(url);
    Object.assign(pages.get(url), p);
    if (p.status !== 200 || p.noindex) return;
    for (const link of p.links) {
      if (!inbound.has(link)) inbound.set(link, new Set());
      inbound.get(link).add(url);
      if (!pages.has(link) && pages.size < MAX) {
        pages.set(link, { depth: depth + 1 });
        next.push(link);
      }
    }
  });
  process.stderr.write(`depth ${depth}: ${frontier.length} fetched, ${pages.size} known\n`);
  frontier = next;
}

// ---- sitemap
const smXml = await (await fetch(`${ORIGIN}/sitemap.xml`, { headers: { "user-agent": UA } })).text();
const sitemap = [...smXml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => norm(m[1].trim(), ORIGIN)).filter(Boolean);
const unseen = sitemap.filter((u) => !pages.get(u)?.status);
await pool(unseen, 4, async (url) => {
  const p = await fetchPage(url);
  pages.set(url, { ...(pages.get(url) ?? {}), ...p, depth: pages.get(url)?.depth ?? null });
});

// ---- report
const inSitemap = new Set(sitemap);
const orphans = sitemap.filter((u) => pages.get(u)?.depth == null);
const deep = sitemap.filter((u) => (pages.get(u)?.depth ?? 99) > 3);
const fewIn = sitemap.filter((u) => (inbound.get(u)?.size ?? 0) < 3);
const badSitemap = sitemap.filter((u) => {
  const p = pages.get(u);
  return !p || p.status !== 200 || p.noindex || (p.canonical && norm(p.canonical, u) !== u);
});
const badLinks = [];
for (const [target, sources] of inbound) {
  const p = pages.get(target);
  if (!p || !p.status) continue;
  // The nav's plain Sign in link is expected (the PRD allows it).
  if (new URL(target).pathname === "/signin") continue;
  if (p.status !== 200 || p.noindex) {
    badLinks.push({ target, status: p.noindex ? "noindex" : p.status, location: p.location, from: [...sources].slice(0, 3) });
  }
}

const rows = [["url", "in_sitemap", "status", "noindex", "depth", "inbound", "canonical_ok"]];
for (const [url, p] of pages) {
  rows.push([url, inSitemap.has(url), p.status ?? "", p.noindex ?? "", p.depth ?? "", inbound.get(url)?.size ?? 0, !p.canonical || norm(p.canonical, url) === url]);
}
writeFileSync("crawl-report.csv", rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n") + "\n");

const reachable = [...pages.values()].filter((p) => p.depth != null && p.status === 200 && !p.noindex).length;
const pass = (ok) => (ok ? "PASS" : "FAIL");
console.log(`\n${ORIGIN}`);
console.log(`Reachable indexable URLs: ${reachable} · sitemap URLs: ${sitemap.length}`);
console.log(`${pass(!orphans.length)} orphans (in sitemap, not reachable): ${orphans.length}`);
orphans.slice(0, 20).forEach((u) => console.log(`   ${u}`));
console.log(`${pass(!deep.length)} sitemap URLs deeper than 3 clicks: ${deep.length}`);
deep.slice(0, 20).forEach((u) => console.log(`   ${u} (depth ${pages.get(u)?.depth ?? "unreached"})`));
console.log(`${pass(!fewIn.length)} sitemap URLs with fewer than 3 inbound links: ${fewIn.length}`);
fewIn.slice(0, 20).forEach((u) => console.log(`   ${u} (${inbound.get(u)?.size ?? 0})`));
console.log(`${pass(!badLinks.length)} internal links to redirect / 404 / noindex: ${badLinks.length}`);
badLinks.slice(0, 20).forEach((b) => console.log(`   ${b.target} → ${b.status}${b.location ? ` ${b.location}` : ""} (from ${b.from.join(", ")})`));
console.log(`${pass(!badSitemap.length)} sitemap URLs not 200 + indexable + self-canonical: ${badSitemap.length}`);
badSitemap.slice(0, 20).forEach((u) => {
  const p = pages.get(u);
  console.log(`   ${u} (status ${p?.status}, noindex ${p?.noindex}, canonical ${p?.canonical})`);
});

const hubs = [
  `${ORIGIN}/blog`,
  `${ORIGIN}/tools/in-hand-salary-calculator`,
  `${ORIGIN}/tools/resume-ats-checker`,
  `${ORIGIN}/government-jobs`,
  ...sitemap.filter((u) => u.includes("/blog/category/")),
];
const top = [...new Set([...hubs, ...sitemap.filter((u) => u.includes("/blog/") && !u.includes("/category/") && !u.includes("/page/")).sort((a, b) => (inbound.get(a)?.size ?? 0) - (inbound.get(b)?.size ?? 0))])].slice(0, 20);
console.log("\nSubmit these first in URL Inspection:");
top.forEach((u, i) => console.log(`  ${i + 1}. ${u}`));
console.log("\nFull table: crawl-report.csv");
