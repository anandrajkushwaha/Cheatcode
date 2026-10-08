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
  // "Online Form" is the phrase these boards and every aggregator use for an
  // open application — "RRB NTPC Graduate Level Online Form 2026" is the
  // single most common shape a vacancy notice takes, and leaving it out meant
  // the one kind people actually come for was the one kind missed.
  ["job", /\b(recruitment|vacanc(y|ies)|notification|advertisement|advt|online\s*form|application\s*form|apply\s*online|bharti|cen\s*\d|engagement|appointment|posts?\b.*\b20\d{2})\b/i],
];

/**
 * Link text that is a signpost, not a notice.
 *
 * Every one of these came off a real board and was published as a job:
 * "Vacancies", "Current Openings", "RECRUITMENT EXAMS", "View All". They are
 * the board's own navigation — the heading above the list, or the link to the
 * rest of it — and they match a keyword test perfectly while telling a reader
 * nothing at all.
 */
const SIGNPOST =
  /^(view|see|show|read|click|go)?\s*(all|more|here|details?|archives?|list)?$|^(latest|current|new|old)?\s*(jobs?|vacanc(y|ies)|openings?|notifications?|notices?|results?|advertisements?|recruitments?|recruitment exams?|admit cards?|answer keys?|syllabus|downloads?|circulars?|press releases?|what'?s new|home|archives?)$/i;

/**
 * Does this title say which recruitment it is about?
 *
 * A notice names something: a board, a post, an exam, a year, a number of
 * vacancies. "RRB NTPC Graduate Level Online Form 2026" does. "Vacancies"
 * does not, and the difference is not the keyword — both contain one — it is
 * whether anything in the words identifies a particular thing.
 *
 * Four words, or two with a year in them, is the cheapest test that separates
 * the two. "CGL 2026 Result" passes on the year; "Current Openings" fails on
 * both counts. Applied to what the model returns as well as to what the
 * pattern reader finds, because the model published "View All" twice.
 */
export function isSubstantive(title: string): boolean {
  const text = title.replace(/\s+/g, " ").trim();
  if (text.length < 10) return false;
  if (SIGNPOST.test(text)) return false;

  const words = text.split(" ").filter((w) => /[a-z0-9]/i.test(w)).length;
  const hasYear = /\b20\d{2}\b/.test(text);
  return words >= 4 || (words >= 2 && hasYear);
}

export function byPattern(links: { url: string; text: string }[]): Classified[] {
  const out: Classified[] = [];

  for (const link of links) {
    const kind = PATTERNS.find(([, re]) => re.test(link.text))?.[0];
    if (!kind) continue;

    const title = link.text.replace(/\s+/g, " ").trim();
    if (title.length > 300 || !isSubstantive(title)) continue;

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
