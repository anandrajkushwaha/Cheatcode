import "server-only";

export type Draft = {
  slug: string;
  category_slug: string;
  post_type: "editorial" | "programmatic" | "practical";
  focus_keyword: string;
  secondary_keywords?: string[];
  title: string;
  h1?: string;
  seo_title: string;
  seo_description: string;
  excerpt: string;
  content_html: string;
  /** Either shape is accepted; normaliseFaq() converts to {q,a}. */
  faq?: { q?: string; a?: string; question?: string; answer?: string }[];
  entity_type?: string | null;
  entity_slug?: string | null;
  entity_name?: string | null;
};

const ALLOWED_TAGS = new Set([
  "p", "h2", "h3", "ul", "ol", "li", "table", "thead", "tbody", "tr", "th", "td",
  "strong", "em", "a", "blockquote", "br", "code",
]);

const DATA_RE =
  /(₹|\bLPA\b|\bCTC\b|Naukri|TCS|Infosys|Wipro|Accenture|Cognizant|Capgemini|EPFO?|LinkedIn|\bFY\s?20\d\d|\d+\s?%)/gi;

/**
 * Writers produce {q,a} or {question,answer}. Normalise once, here, so a key
 * mismatch can never reach the database and render an empty FAQ block.
 */
export function normaliseFaq(items: Draft["faq"]): { q: string; a: string }[] {
  return (items ?? [])
    .map((it) => ({
      q: (it.q ?? it.question ?? "").trim(),
      a: (it.a ?? it.answer ?? "").trim(),
    }))
    .filter((it) => it.q && it.a);
}

export function textOf(html: string) {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

export function analyse(draft: Draft) {
  // Normalise single-quoted attributes so extraction is consistent.
  const html = draft.content_html.replace(/(\b(?:href|id))='([^']*)'/g, '$1="$2"');
  const text = textOf(html);
  const words = text.split(/\s+/).filter(Boolean).length;
  const h2s = html.match(/<h2[^>]*>/gi) ?? [];
  const links = Array.from(html.matchAll(/<a\s[^>]*href="([^"]+)"/gi)).map((m) => m[1]);
  const internal = links.filter((l) => l.startsWith("/"));
  const blogLinks = internal.filter((l) => l.startsWith("/blog/"));
  const dataPoints = new Set((text.match(DATA_RE) ?? []).map((s) => s.toLowerCase())).size;
  const first120 = text.split(/\s+/).slice(0, 120).join(" ").toLowerCase();
  const tags = Array.from(html.matchAll(/<\s*\/?\s*([a-z0-9]+)/gi)).map((m) => m[1].toLowerCase());
  const badTags = Array.from(new Set(tags.filter((t) => !ALLOWED_TAGS.has(t))));

  const toc = Array.from(html.matchAll(/<h2[^>]*>([\s\S]*?)<\/h2>/gi)).map((m) => {
    const t = textOf(m[1]);
    return { id: t.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, ""), text: t };
  });

  return { html, text, words, h2Count: h2s.length, internal, blogLinks, dataPoints, first120, badTags, toc };
}

export type GateResult =
  | { pass: true; metrics: ReturnType<typeof analyse>; score: number }
  | { pass: false; reasons: string[]; metrics: ReturnType<typeof analyse> };

/**
 * The gate exists so a weak page is never published. A rejected slot stays
 * empty and the keyword goes back in the queue — that is the correct outcome.
 */
export function runQualityGate(draft: Draft, knownSlugs: Set<string>): GateResult {
  const m = analyse(draft);
  const reasons: string[] = [];
  const kw = draft.focus_keyword.toLowerCase();

  if (m.words < 1400) reasons.push(`too short: ${m.words} words (min 1400)`);
  if (m.h2Count < 5) reasons.push(`only ${m.h2Count} H2 sections (min 5)`);
  if (m.blogLinks.length < 2) reasons.push(`only ${m.blogLinks.length} internal blog links (min 2)`);
  if (m.dataPoints < 3) reasons.push(`only ${m.dataPoints} India-specific data points (min 3)`);
  if (!/<table/i.test(m.html)) reasons.push("no table");
  if (m.badTags.length) reasons.push(`disallowed tags: ${m.badTags.join(", ")}`);
  if (/<h1/i.test(m.html)) reasons.push("contains an h1 (the template renders it)");

  if (draft.seo_title.length < 30 || draft.seo_title.length > 62) {
    reasons.push(`seo_title is ${draft.seo_title.length} chars (need 30–62)`);
  }
  if (draft.seo_description.length < 110 || draft.seo_description.length > 158) {
    reasons.push(`seo_description is ${draft.seo_description.length} chars (need 110–158)`);
  }
  if (!draft.title.toLowerCase().includes(kw)) reasons.push("focus keyword missing from title");
  if (!m.first120.includes(kw)) reasons.push("focus keyword missing from the first 120 words");
  const faq = normaliseFaq(draft.faq);
  if (faq.length < 4) {
    reasons.push(
      `fewer than 4 usable FAQ items (got ${faq.length}; each needs a question and an answer)`,
    );
  }

  const dead = m.blogLinks
    .map((l) => l.replace("/blog/", ""))
    .filter((s) => !knownSlugs.has(s));
  if (dead.length) reasons.push(`links to articles that don't exist: ${dead.join(", ")}`);

  if (knownSlugs.has(draft.slug)) reasons.push(`slug already exists: ${draft.slug}`);

  if (reasons.length) return { pass: false, reasons, metrics: m };

  const score = Math.min(
    100,
    40 + Math.min(m.words, 2400) / 60 + m.h2Count * 2 + m.dataPoints * 2 + m.blogLinks.length * 3,
  );
  return { pass: true, metrics: m, score: Math.round(score) };
}
