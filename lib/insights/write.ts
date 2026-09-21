import "server-only";
import { llmJson } from "@/lib/app/llm";
import type { FeedItem } from "@/lib/insights/feeds";

/**
 * Deciding whether a story matters to our reader, and writing it in 70 words.
 *
 * One model call per story, and it does both jobs at once: judge, then write.
 * Splitting them would double the calls for the stories we keep and save
 * nothing on the ones we drop, since the judgement needs the same reading.
 */

export const MAX_WORDS = 70;
/** Below this the story is not about our reader closely enough to show. */
export const MIN_RELEVANCE = 6;

export type Written = {
  title: string;
  summary: string;
  category: "trend" | "guide";
  relevance: number;
};

const SYSTEM = `You write "Insights" for Cheatcode, a career app for people in India: students, freshers and professionals with up to about ten years of experience, looking for jobs, switching jobs or trying to grow.

Your job for each news story:
1. Judge how much it matters to that reader, 0 to 10. High: hiring or layoffs in India, salaries and appraisals, which skills and roles are in demand, campus placements, AI changing jobs, rules that touch a salaried person (PF/EPFO, income tax on salary, labour codes, gratuity, notice periods, leave), visas and immigration that affect Indians working abroad (H-1B, UK, Canada, Germany), global company decisions with a clear effect on Indian jobs (GCCs, offshoring, big layoffs with India teams). Low (0–3): stock tips and market moves, politics or crime with no job effect, sports, entertainment, company results that say nothing about hiring or pay, press releases.
2. Category: "guide" if it is a rule, policy, deadline or process the reader may need to act on; otherwise "trend".
3. Write a headline of at most 12 words, in your own words, plain English, no clickbait, no emoji.
4. Write a summary of 55 to 70 words, in your own words. Hard limit 70 words. Lead with what happened, then the number or detail that matters, then one short clause on what it means for the reader — only if the source supports it.

Rules that are never broken:
- Use only facts present in the source text given. Never add numbers, names, dates or claims that are not in it. If the source is too thin to write 55 honest words, set relevance to 0.
- Do not copy sentences from the source. Rephrase.
- No opinion, no advice beyond what the source says, no "experts say" unless the source names them.
- Indian English is fine; write lakh/crore as the source does.`;

const SCHEMA = {
  type: "OBJECT",
  properties: {
    relevance: { type: "INTEGER", description: "0-10, how much this matters to the reader" },
    category: { type: "STRING", enum: ["trend", "guide"] },
    title: { type: "STRING", description: "At most 12 words" },
    summary: { type: "STRING", description: "55 to 70 words, own words, facts from the source only" },
  },
  required: ["relevance", "category", "title", "summary"],
};

export async function writeInsight(item: FeedItem, article: string): Promise<Written | null> {
  const source = [
    `Headline: ${item.title}`,
    item.description ? `Feed summary: ${item.description}` : "",
    article ? `From the article:\n${article}` : "",
    `Published by: ${item.sourceName}`,
  ]
    .filter(Boolean)
    .join("\n\n");

  const res = await llmJson({
    system: SYSTEM,
    user: source,
    schema: SCHEMA,
    name: "insight",
    temperature: 0.2,
    maxTokens: 400,
    timeoutMs: 25_000,
    meta: { feature: "insights" },
  });
  if (!res.ok) return null;

  const d = res.data as Partial<{ relevance: number; category: string; title: string; summary: string }>;
  const relevance = Math.max(0, Math.min(10, Math.round(Number(d.relevance) || 0)));
  if (relevance < MIN_RELEVANCE) return null;

  const title = (d.title ?? "").replace(/\s+/g, " ").trim();
  const summary = fitWords((d.summary ?? "").replace(/\s+/g, " ").trim(), MAX_WORDS);
  if (title.length < 5 || !summary || words(summary) < 30) return null;

  return {
    title: title.slice(0, 160),
    summary,
    category: d.category === "guide" ? "guide" : "trend",
    relevance,
  };
}

/* ------------------------------------------------------------------ words */

export function words(s: string): number {
  return s.split(/\s+/).filter(Boolean).length;
}

/**
 * Never more than `max` words, and never cut mid-sentence where it can be
 * helped. The model is asked for 70 and usually obeys; this is the guarantee.
 * Over by a little: cut back to the last full sentence that fits. Over by a
 * lot, or no sentence fits: give up rather than publish a stump.
 */
export function fitWords(s: string, max: number): string | null {
  if (words(s) <= max) return s;
  const sentences = s.match(/[^.!?]+[.!?]+(\s|$)/g) ?? [];
  let out = "";
  for (const sentence of sentences) {
    const next = (out + sentence).trim();
    if (words(next) > max) break;
    out = next + " ";
  }
  out = out.trim();
  return words(out) >= 30 ? out : null;
}

/**
 * The same story from two outlets. Headlines are reduced to their meaningful
 * words; two whose word sets overlap by 60% or more are one story.
 */
const STOP = new Set(
  "a an the of to in on for and or is are was were be by with at as from its it this that after over into amid says said will may new india indian".split(" "),
);

export function titleKey(title: string): string {
  return [
    ...new Set(
      title
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, " ")
        .split(/\s+/)
        .filter((w) => w.length > 2 && !STOP.has(w)),
    ),
  ]
    .sort()
    .join(" ");
}

export function sameStory(a: string, b: string): boolean {
  const A = new Set(a.split(" ").filter(Boolean));
  const B = new Set(b.split(" ").filter(Boolean));
  if (A.size < 3 || B.size < 3) return false;
  let shared = 0;
  for (const w of A) if (B.has(w)) shared++;
  return shared / Math.min(A.size, B.size) >= 0.6;
}
