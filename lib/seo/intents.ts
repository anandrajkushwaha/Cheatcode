/**
 * The keyword-to-URL map: one search intent, one canonical URL.
 *
 * Before a page is written, look its intent up here. If a URL already owns
 * it, that page gets updated — a second page on the same intent only splits
 * the clicks and the links between two URLs that each rank worse than one
 * would. The test beside this file fails when two URLs claim the same
 * keyword, and when an entry points at a route that does not exist.
 *
 * Only pages that exist go in. A keyword with no page is a backlog item, not
 * an entry here: the map describes the site, not the plan.
 *
 * Pure on purpose — no database, no server-only — so it runs under `npm test`.
 */

/** The page type an intent is served by. One per intent; see contentTypeFor. */
export type PageType =
  | "product"
  | "job-listing"
  | "government-job"
  | "exam"
  | "lifecycle"
  | "calculator"
  | "guide"
  | "insights"
  | "report"
  | "compare"
  | "trust";

export type Intent = {
  /** Canonical path, starting with "/". */
  path: string;
  type: PageType;
  /** The pillar it belongs to, for internal linking and reporting. */
  pillar: "resume" | "ats" | "jobs" | "government-jobs" | "interview" | "salary" | "career" | "brand";
  /** Queries this URL is the one answer to. Lower case, as typed. */
  keywords: string[];
  /** The next step a reader of this page should be offered. */
  next?: string;
};

export const INTENTS: Intent[] = [
  {
    path: "/tools/resume-ats-checker",
    type: "product",
    pillar: "ats",
    keywords: [
      "ats resume checker",
      "ats score checker",
      "free ats checker",
      "resume ats score",
      "resume keyword checker",
    ],
    next: "/signin?next=/app/resume",
  },
  {
    path: "/tools/in-hand-salary-calculator",
    type: "calculator",
    pillar: "salary",
    keywords: [
      "in-hand salary calculator",
      "ctc to in-hand",
      "ctc calculator",
      "salary calculator",
      "salary after tax",
      "salary breakup",
    ],
  },
  {
    path: "/tools",
    type: "product",
    pillar: "brand",
    keywords: ["free career tools", "career tools india"],
  },
  {
    path: "/jobs",
    type: "job-listing",
    pillar: "jobs",
    keywords: ["private jobs", "jobs for freshers", "fresher jobs india"],
  },
  {
    path: "/government-jobs",
    type: "government-job",
    pillar: "government-jobs",
    keywords: ["government jobs", "govt jobs", "sarkari jobs", "government vacancy"],
  },
  {
    path: "/government-jobs/latest-jobs",
    type: "government-job",
    pillar: "government-jobs",
    keywords: ["latest government jobs", "latest govt jobs", "government recruitment"],
  },
  {
    path: "/government-jobs/closing-soon",
    type: "lifecycle",
    pillar: "government-jobs",
    keywords: ["government jobs last date", "govt jobs closing soon"],
  },
  {
    path: "/government-jobs/admit-card",
    type: "lifecycle",
    pillar: "government-jobs",
    keywords: ["admit card", "sarkari admit card"],
  },
  {
    path: "/government-jobs/answer-key",
    type: "lifecycle",
    pillar: "government-jobs",
    keywords: ["answer key", "sarkari answer key"],
  },
  {
    path: "/government-jobs/results",
    type: "lifecycle",
    pillar: "government-jobs",
    keywords: ["sarkari result", "government exam result"],
  },
  {
    path: "/government-jobs/syllabus",
    type: "lifecycle",
    pillar: "government-jobs",
    keywords: ["government exam syllabus"],
  },
  {
    path: "/interview-questions",
    type: "guide",
    pillar: "interview",
    keywords: ["interview questions", "interview questions for freshers"],
    next: "/signin?next=/app/interviews",
  },
  {
    path: "/insights",
    type: "insights",
    pillar: "career",
    keywords: ["hiring trends india", "career news india"],
  },
  {
    path: "/blog",
    type: "guide",
    pillar: "career",
    keywords: ["career guides", "career advice for freshers"],
  },
  {
    path: "/about",
    type: "trust",
    pillar: "brand",
    keywords: ["about cheatcode", "what is cheatcode"],
  },
  {
    path: "/editorial-standards",
    type: "trust",
    pillar: "brand",
    keywords: ["cheatcode editorial standards"],
  },
];

const normal = (k: string) => k.trim().toLowerCase().replace(/\s+/g, " ");

/** The URL that owns a query, or null if nothing does yet. */
export function ownerOf(keyword: string): Intent | null {
  const k = normal(keyword);
  return INTENTS.find((i) => i.keywords.some((x) => normal(x) === k)) ?? null;
}

/** Every keyword claimed by more than one URL. Empty is the only good answer. */
export function cannibalised(intents: Intent[] = INTENTS): { keyword: string; paths: string[] }[] {
  const by = new Map<string, Set<string>>();
  for (const i of intents) {
    for (const k of i.keywords) {
      const key = normal(k);
      if (!by.has(key)) by.set(key, new Set());
      by.get(key)!.add(i.path);
    }
  }
  return [...by]
    .filter(([, paths]) => paths.size > 1)
    .map(([keyword, paths]) => ({ keyword, paths: [...paths] }));
}

/* ------------------------------------------------------------ content type
 *
 * Which kind of page answers which kind of search. Deciding this first is
 * what stops a salary question becoming a blog post when it wants a
 * calculator, or a current story landing in the evergreen guides.
 */
export type SearchIntent =
  | "product"
  | "job"
  | "government-job"
  | "exam"
  | "result-admit-card-answer-key"
  | "salary-calculation"
  | "evergreen-question"
  | "current-trend"
  | "original-research"
  | "comparison";

const TYPE_FOR: Record<SearchIntent, PageType> = {
  product: "product",
  job: "job-listing",
  "government-job": "government-job",
  exam: "exam",
  "result-admit-card-answer-key": "lifecycle",
  "salary-calculation": "calculator",
  "evergreen-question": "guide",
  "current-trend": "insights",
  "original-research": "report",
  comparison: "compare",
};

export function contentTypeFor(intent: SearchIntent): PageType {
  return TYPE_FOR[intent];
}

/* ---------------------------------------------------------- publish score
 *
 * Whether a proposed page is worth writing. Each factor is scored 0 to 1 by
 * whoever proposes the page; the weights sum to 100. Below 70 it is not
 * published, 70–84 only with a reason, 85 and up goes first.
 */
export const SCORE_WEIGHTS = {
  searchDemand: 20,
  businessRelevance: 15,
  originality: 15,
  intentMatch: 15,
  authorityOpportunity: 10,
  internalLinking: 10,
  freshness: 5,
  conversionPotential: 5,
  sourceQuality: 5,
} as const;

export type ScoreInput = Record<keyof typeof SCORE_WEIGHTS, number>;

export function publishScore(input: ScoreInput): {
  score: number;
  verdict: "do-not-publish" | "publish-if-justified" | "high-priority";
} {
  let score = 0;
  for (const [k, w] of Object.entries(SCORE_WEIGHTS) as [keyof ScoreInput, number][]) {
    const v = Number(input[k]);
    score += w * (Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 0);
  }
  score = Math.round(score);
  const verdict = score >= 85 ? "high-priority" : score >= 70 ? "publish-if-justified" : "do-not-publish";
  return { score, verdict };
}
