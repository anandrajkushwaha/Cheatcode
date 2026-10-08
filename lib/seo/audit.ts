/**
 * The SEO audit of every published article.
 *
 * The quality gate in lib/ingest/quality.ts checks a draft once, on the way
 * in, and only for drafts that come through the ingest API. Articles written
 * in the admin never meet it, and every article drifts after it is published:
 * the posts it links to get renamed, a newer post takes its keyword, nothing
 * links to it any more. This reads the whole set at once and says what each
 * article needs, worst first.
 *
 * Pure — no database, no server-only — so it runs under `npm test` and the
 * admin page only has to hand it rows.
 */

export type AuditPost = {
  slug: string;
  title: string;
  seo_title: string | null;
  seo_description: string | null;
  focus_keyword: string | null;
  content_html: string | null;
  faq: unknown[] | null;
  noindex?: boolean | null;
  category?: string | null;
};

export type Severity = "high" | "medium" | "low";
export type Issue = { code: string; severity: Severity; message: string };

export type PostAudit = {
  slug: string;
  title: string;
  category: string | null;
  focusKeyword: string;
  words: number;
  inbound: number;
  issues: Issue[];
  /** 100 minus weighted issues; for sorting, not a ranking prediction. */
  score: number;
};

export type SiteAudit = {
  posts: PostAudit[];
  /** Keywords targeted by more than one article: the pages compete. */
  cannibalised: { keyword: string; slugs: string[] }[];
  totals: Record<Severity, number>;
};

const WEIGHT: Record<Severity, number> = { high: 15, medium: 6, low: 2 };

export function textOf(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * The form two keywords are compared in. "Resume format for freshers" and
 * "freshers resume format" are one search; so are "b.tech" and "btech".
 * Deliberately conservative — words like "india" or "free" are kept, because
 * "free resume builder" and "resume builder" can fairly be two pages.
 */
export function keywordKey(k: string): string {
  return k
    .toLowerCase()
    .replace(/[.’']/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .split(" ")
    .filter((w) => w && !["a", "an", "the", "for", "of", "in", "to", "and", "how"].includes(w))
    .map((w) => (w.length > 3 && w.endsWith("s") && !w.endsWith("ss") ? w.slice(0, -1) : w))
    .sort()
    .join(" ");
}

/**
 * Lower case, punctuation as spaces. "In-Hand" and "in hand", "UI/UX" and
 * "ui ux" are the same search to Google and must be the same here, or the
 * audit flags a keyword that is plainly in the title.
 */
export function plain(s: string): string {
  return ` ${s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()} `;
}

/** Internal /blog/<slug> targets in a body, without fragments or query strings. */
export function blogLinks(html: string): string[] {
  const out: string[] = [];
  for (const m of html.matchAll(/<a\s[^>]*href\s*=\s*["']([^"']+)["']/gi)) {
    let href = m[1];
    href = href.replace(/^https?:\/\/(www\.)?cheatcodeapp\.com/i, "");
    const hit = href.match(/^\/blog\/([a-z0-9-]+)\/?(?:[?#].*)?$/i);
    if (hit && hit[1] !== "page" && hit[1] !== "category") out.push(hit[1].toLowerCase());
  }
  return out;
}

export function auditPosts(rows: AuditPost[]): SiteAudit {
  const slugs = new Set(rows.map((r) => r.slug));

  // Who links to whom, counted once per linking article.
  const inbound = new Map<string, number>();
  for (const r of rows) {
    for (const target of new Set(blogLinks(r.content_html ?? ""))) {
      if (target !== r.slug) inbound.set(target, (inbound.get(target) ?? 0) + 1);
    }
  }

  // Same keyword, more than one article.
  const byKey = new Map<string, { keyword: string; slugs: string[] }>();
  for (const r of rows) {
    if (!r.focus_keyword?.trim() || r.noindex) continue;
    const key = keywordKey(r.focus_keyword);
    const g = byKey.get(key) ?? { keyword: r.focus_keyword.trim().toLowerCase(), slugs: [] };
    g.slugs.push(r.slug);
    byKey.set(key, g);
  }
  const cannibalised = [...byKey.values()].filter((g) => g.slugs.length > 1);
  const clashWith = new Map<string, string[]>();
  for (const g of cannibalised) {
    for (const s of g.slugs) clashWith.set(s, g.slugs.filter((x) => x !== s));
  }

  const posts = rows.map((r): PostAudit => {
    const html = r.content_html ?? "";
    const text = textOf(html);
    const words = text ? text.split(" ").length : 0;
    const kw = (r.focus_keyword ?? "").trim().toLowerCase();
    const kwPlain = plain(kw);
    const seoTitle = (r.seo_title ?? "").trim();
    const desc = (r.seo_description ?? "").trim();
    const h2 = (html.match(/<h2[\s>]/gi) ?? []).length;
    const links = blogLinks(html);
    const dead = [...new Set(links.filter((s) => !slugs.has(s)))];
    const faqCount = Array.isArray(r.faq) ? r.faq.length : 0;
    const issues: Issue[] = [];
    const add = (code: string, severity: Severity, message: string) =>
      issues.push({ code, severity, message });

    if (r.noindex) add("noindex", "high", "Marked noindex — Google will drop it. Intentional?");
    if (!kw) add("no-keyword", "high", "No focus keyword set.");
    const clash = clashWith.get(r.slug);
    if (clash) {
      add(
        "cannibalised",
        "high",
        `Targets the same keyword as ${clash.join(", ")}. Merge into the stronger page, or retarget one.`,
      );
    }
    if (dead.length) add("dead-links", "high", `Links to articles that do not exist: ${dead.join(", ")}.`);
    if (kw && !plain(r.title).includes(kwPlain) && !plain(seoTitle).includes(kwPlain)) {
      add("kw-title", "high", `Focus keyword "${kw}" is in neither the title nor the SEO title.`);
    }
    if (kw && !plain(text.split(" ").slice(0, 120).join(" ")).includes(kwPlain)) {
      add("kw-intro", "medium", "Focus keyword is not in the first 120 words — answer the query up top.");
    }
    if (!seoTitle) add("seo-title-missing", "high", "No SEO title.");
    else if (seoTitle.length > 62) add("seo-title-long", "medium", `SEO title is ${seoTitle.length} characters; Google cuts at about 60.`);
    else if (seoTitle.length < 30) add("seo-title-short", "low", `SEO title is only ${seoTitle.length} characters.`);
    if (!desc) add("desc-missing", "high", "No meta description.");
    else if (desc.length > 158) add("desc-long", "low", `Meta description is ${desc.length} characters (aim for 110–158).`);
    else if (desc.length < 110) add("desc-short", "low", `Meta description is ${desc.length} characters (aim for 110–158).`);
    if (words < 800) add("thin", "high", `Only ${words} words — too thin to rank for most queries.`);
    else if (words < 1400) add("short", "medium", `${words} words; the guides that rank here run 1,400+.`);
    if (h2 < 5) add("structure", "medium", `${h2} H2 sections; break it into at least 5 answerable sections.`);
    if (/<h1[\s>]/i.test(html)) add("h1-in-body", "medium", "Body contains an <h1>; the template already renders one.");
    if (!/<table[\s>]/i.test(html)) add("no-table", "low", "No table — comparisons and numbers read better as one.");
    if (faqCount < 4) add("faq", "low", `${faqCount} FAQ items; add at least 4 real questions.`);
    if (links.length - dead.length < 2) add("few-outlinks", "medium", "Links to fewer than 2 other guides.");
    if (!inbound.get(r.slug)) add("orphan", "medium", "No other guide links here — add links from 2–3 related guides.");

    const score = Math.max(0, 100 - issues.reduce((n, i) => n + WEIGHT[i.severity], 0));
    return {
      slug: r.slug,
      title: r.title,
      category: r.category ?? null,
      focusKeyword: kw,
      words,
      inbound: inbound.get(r.slug) ?? 0,
      issues,
      score,
    };
  });

  posts.sort((a, b) => a.score - b.score || a.slug.localeCompare(b.slug));
  const totals: Record<Severity, number> = { high: 0, medium: 0, low: 0 };
  for (const p of posts) for (const i of p.issues) totals[i.severity]++;
  return { posts, cannibalised, totals };
}
