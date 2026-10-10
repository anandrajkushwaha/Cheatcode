/**
 * The contact block of a resume: name, email, phone, LinkedIn.
 *
 * Used by the ATS checker to save who ran a check (see
 * app/api/tools/ats-lead/route.ts and the notice beside the uploader). Pure:
 * runs in the browser on text that never left it, and only these four fields
 * are sent on.
 *
 * Every field is a best guess and may be null. The name especially: it is
 * taken from the first short line of letters near the top, which is where a
 * resume puts it, and a heading like "CURRICULUM VITAE" is skipped.
 */

export type ResumeContact = {
  name: string | null;
  email: string | null;
  /** E.164, Indian mobiles only: "+919876543210". */
  phone: string | null;
  linkedin: string | null;
};

const EMAIL_RE = /[a-z0-9._%+-]+@[a-z0-9-]+(?:\.[a-z0-9-]+)*\.[a-z]{2,}/i;
// +91 / 91 / 0 prefix optional; "98765 43210", "98765-43210", "9876543210".
const PHONE_RE = /(?<!\d)(?:\+?\s?91[\s-]*|0)?([6-9]\d{4})[\s-]?(\d{5})(?!\d)/;
const LINKEDIN_RE = /(?:https?:\/\/)?(?:[a-z]{2,3}\.)?linkedin\.com\/in\/[a-z0-9_-]+/i;

const NOT_A_NAME =
  /\b(resume|résumé|curriculum|vitae|cv|biodata|profile|summary|objective|contact|email|phone|mobile|address|linkedin|github|experience|education|skills|page)\b/i;

function titleCase(s: string): string {
  return s
    .toLowerCase()
    .replace(/(^|[\s.'-])(\p{L})/gu, (_, sep: string, ch: string) => sep + ch.toUpperCase());
}

function findName(text: string): string | null {
  const lines = text
    .split("\n")
    .map((l) => l.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .slice(0, 8);
  for (const line of lines) {
    if (line.length < 3 || line.length > 40) continue;
    if (NOT_A_NAME.test(line)) continue;
    // Letters, spaces, dots and apostrophes only: no digits, no @, no "|".
    if (!/^[\p{L}][\p{L} .'-]*$/u.test(line)) continue;
    const words = line.split(" ").filter((w) => w.replace(/\./g, "").length > 0);
    if (words.length < 2 || words.length > 4) continue;
    // All caps or all lower is normal for a name line; tidy it.
    return line === line.toUpperCase() || line === line.toLowerCase() ? titleCase(line) : line;
  }
  return null;
}

export function findContact(text: string): ResumeContact {
  const email = text.match(EMAIL_RE)?.[0].toLowerCase() ?? null;
  const p = text.match(PHONE_RE);
  const phone = p ? `+91${p[1]}${p[2]}` : null;
  const li = text.match(LINKEDIN_RE)?.[0] ?? null;
  return {
    name: findName(text),
    email: email && email.length <= 254 ? email : null,
    phone,
    linkedin: li ? `https://${li.replace(/^https?:\/\//i, "").toLowerCase()}` : null,
  };
}
