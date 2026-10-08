import type { Classified } from "@/lib/govt/classify";
import type { NoticeKind } from "@/lib/govt/types";

/**
 * The same job, done by reading the words.
 *
 * SSC failed twice with "the model's answer wasn't valid JSON" on twenty-five
 * links — one chunk, so not truncation, and not something that can be
 * diagnosed from here. Meanwhile the thing being classified is "SSC CGL 2026
 * Tier-I Admit Card", which does not need a model to recognise.
 *
 * So this is the floor under the model rather than a replacement for it. The
 * model is better at the parts that matter later — grouping four notices onto
 * one recruitment, tidying a title — but it is a network call to someone
 * else's service, and a monitor whose every board depends on that call
 * working is a monitor that goes quiet for reasons nobody can see.
 *
 * It is deliberately strict. A link it cannot place is left out, because the
 * cost of a wrong notice on a government-jobs page is far higher than the
 * cost of a missing one.
 */
const PATTERNS: [NoticeKind, RegExp][] = [
  // Order matters: "CGL 2026 Result" is a result, not a recruitment, and the
  // job pattern below would happily claim it.
  ["answer_key", /\banswer\s*key/i],
  ["admit_card", /\b(admit\s*card|hall\s*ticket|call\s*letter|e[-\s]?admit)\b/i],
  ["result", /\b(result|merit\s*list|final\s*selection|selection\s*list|selected\s*candidates|cut[-\s]?off)\b/i],
  ["syllabus", /\b(syllabus|exam(ination)?\s*pattern|scheme\s*of\s*exam)/i],
  ["admission", /\b(admission|counsell?ing|entrance\s*(test|exam))\b/i],
  ["job", /\b(recruitment|vacanc(y|ies)|notification|advertisement|advt|apply\s*online|cen\s*\d|engagement|appointment)\b/i],
];

export function byPattern(links: { url: string; text: string }[]): Classified[] {
  const out: Classified[] = [];

  for (const link of links) {
    const kind = PATTERNS.find(([, re]) => re.test(link.text))?.[0];
    if (!kind) continue;

    const title = link.text.replace(/\s+/g, " ").trim();
    if (title.length < 8 || title.length > 300) continue;

    const year = Number(/\b(20\d{2})\b/.exec(title)?.[1] ?? 0) || null;

    out.push({
      url: link.url,
      kind,
      title,
      // Only a date written the way these boards write them, and only when it
      // is unambiguous. A bare "10/11" is not worth guessing at.
      publishedOn: isoDate(title),
      // Left to the model. Without a name the notice still publishes; it just
      // does not group onto a recruitment page yet.
      examName: null,
      year: year && year >= 2000 && year <= 2100 ? year : null,
    });
  }

  return out;
}

/** dd-mm-yyyy or dd/mm/yyyy, which is how every one of these boards writes it. */
function isoDate(text: string): string | null {
  const m = /\b(\d{1,2})[-/.](\d{1,2})[-/.](20\d{2})\b/.exec(text);
  if (!m) return null;
  const [, d, mo, y] = m;
  const day = Number(d);
  const month = Number(mo);
  if (day < 1 || day > 31 || month < 1 || month > 12) return null;
  return `${y}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}
