import "server-only";
import { llmJson } from "@/lib/app/llm";
import { NOTICE_KINDS, type NoticeKind } from "@/lib/govt/types";
import { byPattern, isSubstantive } from "@/lib/govt/patterns";

/**
 * Which of these links is a recruitment notice, and what kind.
 *
 * One model call per board page. This is the part a CSS selector cannot do:
 * ten boards lay their pages out ten ways and redesign them without notice,
 * but "SSC CGL 2026 Tier-I Admit Card" reads the same on every one of them.
 * A selector encodes where a notice sits; this encodes what a notice *is*,
 * and only the second one survives a redesign.
 *
 * It is asked for nothing it cannot read off a link. No vacancy counts, no
 * fees, no closing dates — those live inside the notification PDF, and a
 * model asked for them from a link title will invent them. Everything here is
 * either visible in the text it was given or left null.
 */

export type Classified = {
  url: string;
  kind: NoticeKind;
  title: string;
  /** ISO date, only when the link text actually stated one. */
  publishedOn: string | null;
  /** 'SSC CGL 2026' — what this notice is about. */
  examName: string | null;
  year: number | null;
};

const SCHEMA = {
  type: "object",
  properties: {
    notices: {
      type: "array",
      items: {
        type: "object",
        properties: {
          url: { type: "string", description: "Exactly the url as given" },
          kind: { type: "string", enum: [...NOTICE_KINDS] },
          title: { type: "string", description: "The link text, tidied. Never invented." },
          published_on: {
            type: "string",
            description: "YYYY-MM-DD if the link text states a date, else empty string",
          },
          exam_name: {
            type: "string",
            description: "The recruitment this is about, e.g. 'CGL 2026'. Empty if unclear.",
          },
          year: { type: "integer", description: "0 when no year is stated" },
        },
        required: ["url", "kind", "title", "published_on", "exam_name", "year"],
      },
    },
  },
  required: ["notices"],
} as const;

const SYSTEM = `You are reading the links from an Indian government recruitment board's website.

Pick out only links that are a RECRUITMENT NOTICE, and say which kind:
- job: a vacancy notification, advertisement, or recruitment announcement
- result: a declared result, merit list or final selection list
- admit_card: an admit card, hall ticket or call letter
- answer_key: a provisional or final answer key
- syllabus: a syllabus or exam pattern document
- admission: an entrance exam or counselling notice for a course

Ignore everything else: tenders, press releases, officer transfers, office
orders, RTI, contact pages, archives.

Above all, ignore the site's own NAVIGATION. A notice names a particular
recruitment — an organisation, a post, an exam, a year. A link whose whole
text is "Vacancies", "Current Openings", "Recruitment Exams", "View All",
"Latest Jobs", "Notifications" or "Click here" is the heading above a list or
the link to the rest of it, and is never a notice however well it matches a
keyword.

Rules you must not break:
- Copy the url exactly as given. Never alter or shorten it.
- The title must come from the link text. Tidy spacing and capitalisation only.
  Never add a number, a date, a vacancy count or a word that was not there.
- published_on only if the link text itself states a date. Otherwise "".
- If you are not sure a link is a recruitment notice, leave it out.

Returning an empty list is a correct answer when the page has no notices.`;

/**
 * How many links go in one call.
 *
 * SSC's first real run came back "the model's answer wasn't valid JSON" with
 * twenty-five links sent — the output had been cut off mid-array, because a
 * reasoning model spends part of its token budget thinking and what is left
 * was not enough to finish the list. Raising the cap alone would only move
 * the cliff; forty links at a time keeps every answer short enough to land,
 * and means a board that does fail loses one chunk rather than its whole page.
 */
const CHUNK = 40;

export async function classify(
  pageTitle: string,
  links: { url: string; text: string }[],
): Promise<
  { ok: true; notices: Classified[]; degraded?: string } | { ok: false; error: string }
> {
  if (links.length === 0) return { ok: true, notices: [] };

  const chunks: { url: string; text: string }[][] = [];
  for (let i = 0; i < links.length; i += CHUNK) chunks.push(links.slice(i, i + CHUNK));

  const all: Classified[] = [];
  const failures: string[] = [];

  for (const chunk of chunks) {
    const result = await classifyChunk(pageTitle, chunk);
    if (result.ok) all.push(...result.notices);
    else failures.push(result.error);
  }

  // Every chunk failed. Rather than losing the board, fall back to reading
  // the link text directly — see `byPattern`.
  if (failures.length === chunks.length) {
    const guessed = byPattern(links);
    return guessed.length
      ? { ok: true, notices: guessed, degraded: failures[0] }
      : { ok: false, error: failures[0] };
  }
  return { ok: true, notices: all };
}
async function classifyChunk(
  pageTitle: string,
  links: { url: string; text: string }[],
): Promise<{ ok: true; notices: Classified[] } | { ok: false; error: string }> {
  const user =
    `Page: ${pageTitle}\n\nLinks:\n` +
    links.map((l, i) => `${i + 1}. ${l.text}\n   ${l.url}`).join("\n");

  const result = await llmJson({
    system: SYSTEM,
    user,
    schema: SCHEMA as unknown as Record<string, unknown>,
    name: "govt_notices",
    temperature: 0,
    maxTokens: 12_000,
    timeoutMs: 60_000,
    meta: { feature: "govt_ingest", userId: null },
  });

  if (!result.ok) return { ok: false, error: result.error };

  const raw = (result.data as { notices?: unknown })?.notices;
  if (!Array.isArray(raw)) return { ok: true, notices: [] };

  const given = new Set(links.map((l) => l.url));
  const kinds = new Set<string>(NOTICE_KINDS);
  const out: Classified[] = [];

  for (const item of raw) {
    const r = item as Record<string, unknown>;
    const url = typeof r.url === "string" ? r.url : "";
    const kind = typeof r.kind === "string" ? r.kind : "";
    const title = typeof r.title === "string" ? r.title.trim() : "";

    // A url the page did not contain is the one failure mode that matters
    // here: it would publish a link to somewhere nobody chose, under an
    // official board's name. Checked against what we actually sent rather
    // than trusted, every time.
    if (!given.has(url)) continue;
    if (!kinds.has(kind)) continue;
    // The same bar the pattern reader is held to. The model published "View
    // All" and "Current Openings" as jobs; being a model does not make a
    // signpost a notice.
    if (title.length > 300 || !isSubstantive(title)) continue;

    const date = typeof r.published_on === "string" ? r.published_on.trim() : "";
    const year = typeof r.year === "number" && r.year >= 2000 && r.year <= 2100 ? r.year : null;

    out.push({
      url,
      kind: kind as NoticeKind,
      title,
      publishedOn: /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : null,
      examName: typeof r.exam_name === "string" && r.exam_name.trim() ? r.exam_name.trim() : null,
      year,
    });
  }

  return { ok: true, notices: out };
}
