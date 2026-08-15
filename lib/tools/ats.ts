/**
 * The ATS checker's scoring engine.
 *
 * A word on honesty: no applicant tracking system publishes its scoring, and
 * anyone claiming to return "your real Workday score" is guessing. What is
 * genuinely knowable is the other half — the things that reliably break a
 * parser or leave a recruiter with nothing to read. Every check below is
 * derived from the actual file the user uploaded, and every one of them maps
 * to a failure we can describe in plain words. Nothing here is decorative.
 *
 * This module is deliberately free of DOM and PDF APIs so the logic can be
 * exercised directly. Extraction lives in extract.ts.
 */

export type CheckStatus = "pass" | "warn" | "fail";

export type Check = {
  id: string;
  group: GroupId;
  label: string;
  status: CheckStatus;
  /** Points earned out of `weight`. */
  earned: number;
  weight: number;
  /** What we found, in plain language. */
  detail: string;
  /** What to do about it. Omitted when the check passed cleanly. */
  fix?: string;
};

export type GroupId = "parse" | "contact" | "content" | "keywords" | "format";

export const GROUPS: { id: GroupId; label: string; blurb: string }[] = [
  {
    id: "parse",
    label: "Machine readability",
    blurb: "Whether software can extract your resume at all.",
  },
  {
    id: "contact",
    label: "Contact & sections",
    blurb: "The fields a parser looks for first.",
  },
  {
    id: "content",
    label: "What your bullets say",
    blurb: "The part a human reads once you're through.",
  },
  {
    id: "keywords",
    label: "Skills & keywords",
    blurb: "Whether a search for the role would surface you.",
  },
  {
    id: "format",
    label: "Formatting hygiene",
    blurb: "Length, dates, and characters that trip parsers.",
  },
];

/** Everything extract.ts is able to observe about the uploaded file. */
export type ResumeFacts = {
  text: string;
  fileType: "pdf" | "docx" | "txt";
  pages: number;
  /** Characters of real text recovered per page. */
  charsPerPage: number[];
  /** Pages where text items cluster into two or more x-bands. */
  multiColumnPages: number;
};

export type AtsResult = {
  score: number;
  verdict: string;
  summary: string;
  checks: Check[];
  groups: { id: GroupId; label: string; blurb: string; earned: number; weight: number }[];
  wordCount: number;
};

// --------------------------------------------------------------- vocabularies

const ACTION_VERBS = [
  "built","led","shipped","designed","developed","launched","owned","drove","cut","reduced",
  "increased","improved","migrated","automated","scaled","architected","implemented","created",
  "delivered","optimised","optimized","refactored","negotiated","managed","mentored","analysed",
  "analyzed","tested","deployed","integrated","streamlined","rewrote","introduced","established",
  "resolved","accelerated","grew","saved","won","published","presented","trained","coordinated",
];

const FILLER = [
  "responsible for","worked on","involved in","team player","hard working","hardworking",
  "duties included","assisted with","helped with","participated in","various tasks",
  "good communication skills","detail oriented","detail-oriented","go-getter","self starter",
  "self-starter","think outside the box","results driven","results-driven","dynamic professional",
];

const SECTION_PATTERNS: { key: string; label: string; re: RegExp }[] = [
  { key: "experience", label: "Experience", re: /\b(work\s+experience|professional\s+experience|experience|employment)\b/i },
  { key: "education", label: "Education", re: /\b(education|academics?|qualifications?)\b/i },
  { key: "skills", label: "Skills", re: /\b(skills?|technical\s+skills|technologies|tech\s+stack)\b/i },
  { key: "projects", label: "Projects", re: /\b(projects?|personal\s+projects|academic\s+projects)\b/i },
];

/** Characters that survive a copy-paste but confuse older parsers. */
const RISKY_CHARS = /[•●▪■–—‘’“”→➢❖]/g;
const REALLY_BAD_CHARS = /[-�]/g;

// --------------------------------------------------------------- small helpers

const EMAIL_RE = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i;
const PHONE_RE = /(?:\+?91[\s-]?)?[6-9]\d{9}\b|\+?\d[\d\s().-]{8,}\d/;
const LINKEDIN_RE = /linkedin\.com\/in\/[a-z0-9-]+/i;
const GITHUB_RE = /github\.com\/[a-z0-9-]+/i;
const DATE_RANGE_RE =
  /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s*'?\d{2,4}\s*(?:[-–—]|to)\s*(present|current|(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s*'?\d{2,4})/gi;
const YEAR_RANGE_RE = /\b(19|20)\d{2}\s*(?:[-–—]|to)\s*((19|20)\d{2}|present|current)\b/gi;
const QUANT_RE = /(₹\s?\d[\d,.]*\s*(?:lpa|cr|crore|lakh|l\b|k\b)?|\b\d+(?:\.\d+)?\s?%|\b\d[\d,]{2,}\b|\b\d+\s?(?:x|times)\b|\b\d+\s?(?:ms|s|hrs?|hours?|days?|weeks?|months?)\b)/gi;

/**
 * Section detection has to be line-based, not a search over the whole text.
 * "good communication skills" sitting inside a paragraph is not a Skills
 * section, and treating it as one hands free marks to exactly the resumes
 * that deserve them least.
 */
function detectSections(text: string) {
  const headingLines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => {
      if (!l || l.length > 40) return false;
      const words = l.split(/\s+/).length;
      if (words > 4) return false;
      // A heading is short and either all-caps, title-case, or ends with a colon.
      return /^[A-Z][A-Za-z /&]*:?$/.test(l) || l === l.toUpperCase();
    })
    .map((l) => l.replace(/:$/, ""));

  return SECTION_PATTERNS.filter((s) => headingLines.some((h) => s.re.test(h)));
}

/** The lines sitting under the Skills heading, up to the next heading. */
function skillsBlock(text: string): string {
  const lines = text.split(/\r?\n/);
  const start = lines.findIndex(
    (l) => l.trim().length <= 40 && SECTION_PATTERNS[2].re.test(l.trim()),
  );
  if (start < 0) return "";

  const out: string[] = [];
  for (let i = start + 1; i < lines.length; i++) {
    const l = lines[i].trim();
    if (!l) continue;
    const isHeading =
      l.length <= 40 &&
      l.split(/\s+/).length <= 4 &&
      (l === l.toUpperCase() || /^[A-Z][A-Za-z /&]*:?$/.test(l));
    if (isHeading && out.length) break;
    out.push(l);
    if (out.length >= 8) break;
  }
  return out.join(", ");
}

function bulletLines(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => /^[-•*·▪◦‣>•]|^\d+[.)]\s/.test(l) || (l.length > 45 && l.length < 260))
    .map((l) => l.replace(/^[-•*·▪◦‣>•]\s*|^\d+[.)]\s*/, "").trim())
    .filter((l) => l.length > 20);
}

function scale(value: number, floor: number, ceiling: number): number {
  if (ceiling === floor) return value >= ceiling ? 1 : 0;
  return Math.max(0, Math.min(1, (value - floor) / (ceiling - floor)));
}

function statusFor(earned: number, weight: number): CheckStatus {
  const ratio = weight === 0 ? 1 : earned / weight;
  if (ratio >= 0.8) return "pass";
  if (ratio >= 0.4) return "warn";
  return "fail";
}

function push(
  checks: Check[],
  c: Omit<Check, "status"> & { status?: CheckStatus },
): void {
  checks.push({ ...c, status: c.status ?? statusFor(c.earned, c.weight) });
}

// --------------------------------------------------------------- the analysis

export function analyseResume(facts: ResumeFacts): AtsResult {
  const { text } = facts;
  const lower = text.toLowerCase();
  const words = text.split(/\s+/).filter((w) => /[a-z0-9]/i.test(w));
  const wordCount = words.length;
  const checks: Check[] = [];

  // ---------------------------------------------------------- 1. readability

  // Text actually recovered. An image-only resume yields almost nothing.
  const charsPerPageAvg = facts.pages
    ? facts.charsPerPage.reduce((a, b) => a + b, 0) / facts.pages
    : text.length;
  const textEarned = Math.round(14 * scale(charsPerPageAvg, 100, 700));
  push(checks, {
    id: "text-layer",
    group: "parse",
    label: "Text can be extracted",
    earned: textEarned,
    weight: 14,
    detail:
      charsPerPageAvg < 120
        ? `Only ~${Math.round(charsPerPageAvg)} characters per page came out. That usually means the resume is an image or a scan.`
        : `~${Math.round(charsPerPageAvg)} characters per page extracted cleanly.`,
    fix:
      charsPerPageAvg < 700
        ? "Export straight to PDF from Word or Google Docs — never a screenshot, scan, or exported image. If you designed it in Canva or Figma, use their PDF export with text enabled, not the PNG."
        : undefined,
  });

  // Two-column layouts read out of order: a parser interleaves the columns.
  const colWeight = 12;
  const colEarned =
    facts.multiColumnPages === 0 ? colWeight : facts.multiColumnPages >= facts.pages ? 0 : 5;
  push(checks, {
    id: "columns",
    group: "parse",
    label: "Single-column layout",
    earned: colEarned,
    weight: colWeight,
    detail:
      facts.multiColumnPages === 0
        ? "Content runs top to bottom in one column."
        : `${facts.multiColumnPages} of ${facts.pages} page${facts.pages === 1 ? "" : "s"} appear to use side-by-side columns.`,
    fix:
      facts.multiColumnPages > 0
        ? "Parsers read left to right across the whole page, so a sidebar gets spliced into the middle of your job descriptions. Move everything into one column — the sidebar template is the single most common reason a good resume scores badly."
        : undefined,
  });

  // ---------------------------------------------------------- 2. contact

  const hasEmail = EMAIL_RE.test(text);
  const hasPhone = PHONE_RE.test(text.replace(/\s{2,}/g, " "));
  const hasLinkedIn = LINKEDIN_RE.test(text);
  const hasGithub = GITHUB_RE.test(text);
  const contactHits = [hasEmail, hasPhone, hasLinkedIn].filter(Boolean).length;
  push(checks, {
    id: "contact",
    group: "contact",
    label: "Email, phone and LinkedIn",
    earned: hasEmail && hasPhone ? (hasLinkedIn ? 10 : 8) : contactHits * 3,
    weight: 10,
    detail: [
      hasEmail ? "email found" : "no email found",
      hasPhone ? "phone found" : "no phone found",
      hasLinkedIn ? "LinkedIn found" : "no LinkedIn URL",
      hasGithub ? "GitHub found" : null,
    ]
      .filter(Boolean)
      .join(" · "),
    fix:
      !hasEmail || !hasPhone || !hasLinkedIn
        ? "Put all three as plain text on the first two lines — not inside an icon, a text box, or an image. A parser reads characters, and an envelope icon next to your address is worth nothing to it."
        : undefined,
  });

  // A parser reads top-down and a recruiter scans the same way. Contact
  // details buried halfway down cost you nothing with software, but plenty
  // with the person deciding in seven seconds.
  const emailAt = text.search(EMAIL_RE);
  const contactPosition = emailAt < 0 ? 1 : emailAt / Math.max(1, text.length);
  push(checks, {
    id: "contact-position",
    group: "contact",
    label: "Contact details near the top",
    earned: contactPosition <= 0.12 ? 4 : contactPosition <= 0.3 ? 2 : 0,
    weight: 4,
    detail:
      emailAt < 0
        ? "No email to locate."
        : contactPosition <= 0.12
          ? "Email appears in the opening lines."
          : `Email appears about ${Math.round(contactPosition * 100)}% of the way down.`,
    fix:
      contactPosition > 0.12
        ? "Move your name and contact line to the very top. Anything below the first few lines is read after the recruiter has already formed an opinion."
        : undefined,
  });

  const foundSections = detectSections(text);
  const missingSections = SECTION_PATTERNS.filter(
    (s) => !foundSections.some((f) => f.key === s.key),
  );
  push(checks, {
    id: "sections",
    group: "contact",
    label: "Standard section headings",
    earned: Math.round(10 * scale(foundSections.length, 0, 4)),
    weight: 10,
    detail:
      foundSections.length === 4
        ? "Experience, Education, Skills and Projects all present."
        : `Found: ${foundSections.map((s) => s.label).join(", ") || "none"}.`,
    fix: missingSections.length
      ? `Add plain headings for ${missingSections.map((s) => s.label).join(", ")}. Parsers segment your resume by matching these exact words — "My Journey" and "What I Bring" segment into nothing.`
      : undefined,
  });

  // ---------------------------------------------------------- 3. content

  const bullets = bulletLines(text);
  push(checks, {
    id: "bullets",
    group: "content",
    label: "Written as bullets, not paragraphs",
    earned: Math.round(8 * scale(bullets.length, 2, 12)),
    weight: 8,
    detail: `${bullets.length} bullet-style line${bullets.length === 1 ? "" : "s"} detected.`,
    fix:
      bullets.length < 8
        ? "Break your experience into 3–5 bullets per role. A recruiter gives a resume about seven seconds; a paragraph gets skipped in all seven of them."
        : undefined,
  });

  const verbStarts = bullets.filter((b) =>
    ACTION_VERBS.includes(b.split(/\s+/)[0]?.toLowerCase().replace(/[^a-z]/g, "") ?? ""),
  ).length;
  const verbRatio = bullets.length ? verbStarts / bullets.length : 0;
  push(checks, {
    id: "action-verbs",
    group: "content",
    label: "Bullets open with an action verb",
    earned: Math.round(8 * scale(verbRatio, 0.15, 0.6)),
    weight: 8,
    detail: bullets.length
      ? `${verbStarts} of ${bullets.length} bullets start with a verb like built, shipped, cut, led.`
      : "No bullets to check.",
    fix:
      verbRatio < 0.6
        ? "Start each bullet with what you did: Built, Shipped, Cut, Migrated, Owned. The sentence gets shorter and the achievement lands first."
        : undefined,
  });

  const quantified = bullets.filter((b) => QUANT_RE.test(b)).length;
  QUANT_RE.lastIndex = 0;
  const quantRatio = bullets.length ? quantified / bullets.length : 0;
  push(checks, {
    id: "quantified",
    group: "content",
    label: "Results backed by numbers",
    earned: Math.round(9 * scale(quantRatio, 0.1, 0.5)),
    weight: 9,
    detail: bullets.length
      ? `${quantified} of ${bullets.length} bullets contain a number, percentage or amount.`
      : "No bullets to check.",
    fix:
      quantRatio < 0.5
        ? 'Put a number on at least half your bullets. "Improved load time" is a claim; "cut load time from 4.2s to 1.1s" is evidence. Even rough numbers beat none.'
        : undefined,
  });

  const fillerFound = FILLER.filter((f) => lower.includes(f));
  push(checks, {
    id: "filler",
    group: "content",
    label: "No filler phrases",
    earned: Math.max(0, 6 - fillerFound.length * 2),
    weight: 6,
    detail: fillerFound.length
      ? `Found: ${fillerFound.slice(0, 4).map((f) => `"${f}"`).join(", ")}${fillerFound.length > 4 ? ` and ${fillerFound.length - 4} more` : ""}.`
      : "No filler phrases found.",
    fix: fillerFound.length
      ? 'Delete them and say what you actually did instead. "Responsible for the payments module" becomes "Rebuilt the payments module, cutting failed transactions by 18%".'
      : undefined,
  });

  // ---------------------------------------------------------- 4. keywords

  const hasSkillsSection = foundSections.some((s) => s.key === "skills");
  push(checks, {
    id: "skills-section",
    group: "keywords",
    label: "A dedicated skills section",
    earned: hasSkillsSection ? 8 : 0,
    weight: 8,
    detail: hasSkillsSection
      ? "Skills section found."
      : "No heading reading Skills or Technical Skills.",
    fix: hasSkillsSection
      ? undefined
      : "Add a short Skills block listing your tools and languages as plain comma-separated words. Recruiters search their database for exactly these strings, and a skill mentioned only inside a bullet is far harder to match.",
  });

  // A skills section is only useful if it is a list. One prose sentence about
  // being "proficient in various technologies" matches nothing.
  const skillItems = skillsBlock(text)
    .split(/[,|•·;/]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 1 && s.split(/\s+/).length <= 4);
  push(checks, {
    id: "skills-list",
    group: "keywords",
    label: "Skills listed as searchable terms",
    earned: Math.round(7 * scale(skillItems.length, 2, 10)),
    weight: 7,
    detail: hasSkillsSection
      ? `${skillItems.length} distinct term${skillItems.length === 1 ? "" : "s"} in the skills block.`
      : "No skills block to read.",
    fix:
      skillItems.length < 10
        ? "List 10–15 concrete tools, languages and frameworks, separated by commas. Write them the way a job description writes them — PostgreSQL, not Postgres knowledge."
        : undefined,
  });

  // ---------------------------------------------------------- 5. formatting

  // A band, not a slope: 300–900 words is a normal resume at any experience
  // level, and everything inside that range should score the same.
  const tooShort = wordCount < 180;
  const thin = wordCount < 280;
  const tooLong = wordCount > 1100;
  const lengthEarned = tooShort || tooLong ? 1 : thin || wordCount > 900 ? 3 : 5;
  push(checks, {
    id: "length",
    group: "format",
    label: "Sensible length",
    earned: lengthEarned,
    weight: 5,
    detail: `${wordCount} words across ${facts.pages} page${facts.pages === 1 ? "" : "s"}.`,
    fix: tooLong
      ? "Cut it back. Under five years of experience, one page is the expectation in India — a second page is usually the first page repeated less well."
      : thin
        ? "There isn't much here yet. Add 3–5 bullets per role or project; a resume this thin reads as inexperience even when it isn't."
        : undefined,
  });

  const dateMatches = (text.match(DATE_RANGE_RE) ?? []).length + (text.match(YEAR_RANGE_RE) ?? []).length;
  push(checks, {
    id: "dates",
    group: "format",
    label: "Readable date ranges",
    earned: Math.round(5 * scale(dateMatches, 0, 3)),
    weight: 5,
    detail: dateMatches
      ? `${dateMatches} date range${dateMatches === 1 ? "" : "s"} in a standard format.`
      : "No date ranges found in a format a parser recognises.",
    fix:
      dateMatches < 3
        ? 'Write dates as "Jun 2023 – Present" or "2021 – 2023". A parser uses these to compute your years of experience; when it cannot find them, that field comes back empty and filters drop you.'
        : undefined,
  });

  const badChars = (text.match(REALLY_BAD_CHARS) ?? []).length;
  const riskyChars = (text.match(RISKY_CHARS) ?? []).length;
  push(checks, {
    id: "characters",
    group: "format",
    label: "Clean characters",
    earned: badChars > 5 ? 0 : badChars > 0 ? 2 : riskyChars > 60 ? 3 : 5,
    weight: 5,
    detail: badChars
      ? `${badChars} character${badChars === 1 ? "" : "s"} came out as unreadable symbols.`
      : "Characters extracted cleanly.",
    fix: badChars
      ? "Some glyphs — usually decorative bullets or icon fonts — did not survive extraction. Replace them with a plain hyphen or a standard bullet and re-export."
      : undefined,
  });

  // ---------------------------------------------------------- totals

  const groups = GROUPS.map((g) => {
    const own = checks.filter((c) => c.group === g.id);
    return {
      id: g.id,
      label: g.label,
      blurb: g.blurb,
      earned: own.reduce((a, c) => a + c.earned, 0),
      weight: own.reduce((a, c) => a + c.weight, 0),
    };
  });

  const totalEarned = groups.reduce((a, g) => a + g.earned, 0);
  const totalWeight = groups.reduce((a, g) => a + g.weight, 0);
  const score = Math.round((totalEarned / totalWeight) * 100);

  const failing = checks.filter((c) => c.status === "fail").length;

  let verdict: string;
  let summary: string;
  if (score >= 85) {
    verdict = "This one gets through.";
    summary =
      "Nothing here will stop a parser, and the writing does its job. Fix whatever is left below and move on to actually applying.";
  } else if (score >= 70) {
    verdict = "Close. A few things are costing you.";
    summary =
      "The structure is sound. What is left is the difference between being read and being shortlisted — and most of it is twenty minutes of work.";
  } else if (score >= 50) {
    verdict = "This is losing you interviews.";
    summary =
      "Some of your resume is reaching the recruiter and some of it isn't. Start with the red items — those are the ones being dropped before a human sees them.";
  } else {
    verdict = "Most of this never reaches a human.";
    summary =
      "The problems below are structural, not cosmetic. Fix the red ones first; each of them can quietly remove you from a search you would otherwise have matched.";
  }

  if (failing === 0 && score < 85) {
    summary =
      "Nothing is badly broken — this is about sharpening. The amber items below are where the marks went.";
  }

  return { score, verdict, summary, checks, groups, wordCount };
}
