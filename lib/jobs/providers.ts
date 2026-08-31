import "server-only";
import { assemble, type NormalisedJob, type Money } from "@/lib/jobs/normalise";

/**
 * The three job board APIs, each reduced to the same call.
 *
 * All three are public, documented endpoints that these companies publish so
 * their jobs can be syndicated — no keys, no scraping, no terms being bent.
 * If a board ever requires auth or asks us to stop, its row in job_sources
 * gets switched off and nothing else in the product changes.
 */

export type Provider = "greenhouse" | "lever" | "ashby";

export type FetchResult =
  | { ok: true; jobs: NormalisedJob[] }
  | { ok: false; error: string };

/** Boards are slow and occasionally hang. None of them deserves a whole run. */
const TIMEOUT_MS = 20_000;

async function getJson(url: string): Promise<{ ok: true; data: unknown } | { ok: false; error: string }> {
  let res: Response;
  try {
    res = await fetch(url, {
      headers: { Accept: "application/json", "User-Agent": "cheatcodeapp.com job sync" },
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store",
    });
  } catch (e) {
    const timedOut = e instanceof Error && e.name === "TimeoutError";
    return { ok: false, error: timedOut ? "Timed out" : "Could not reach the board" };
  }

  if (res.status === 404) return { ok: false, error: "Board not found — check the slug" };
  if (res.status === 429) return { ok: false, error: "Rate limited" };
  if (!res.ok) return { ok: false, error: `Board returned ${res.status}` };

  try {
    return { ok: true, data: await res.json() };
  } catch {
    return { ok: false, error: "Board did not return JSON" };
  }
}

export async function fetchBoard(
  provider: Provider,
  token: string,
  companyName: string,
): Promise<FetchResult> {
  const slug = encodeURIComponent(token.trim());
  if (!slug) return { ok: false, error: "Empty board slug" };

  switch (provider) {
    case "greenhouse":
      return greenhouse(slug, companyName);
    case "lever":
      return lever(slug, companyName);
    case "ashby":
      return ashby(slug, companyName);
  }
}

/* ------------------------------------------------------------ greenhouse */

type GhJob = {
  id?: number | string;
  title?: string;
  absolute_url?: string;
  updated_at?: string;
  first_published?: string;
  company_name?: string;
  content?: string;
  location?: { name?: string };
  offices?: { name?: string; location?: string }[];
  departments?: { name?: string }[];
  metadata?: { name?: string; value?: unknown }[];
};

async function greenhouse(slug: string, company: string): Promise<FetchResult> {
  // content=true returns the full HTML description in the same call, which is
  // the difference between one request and one request per job.
  const got = await getJson(`https://boards-api.greenhouse.io/v1/boards/${slug}/jobs?content=true`);
  if (!got.ok) return got;

  const raw = (got.data as { jobs?: GhJob[] })?.jobs;
  if (!Array.isArray(raw)) return { ok: false, error: "No jobs array in the response" };

  const jobs: NormalisedJob[] = [];
  for (const j of raw) {
    const built = assemble({
      provider: "greenhouse",
      external_id: String(j.id ?? ""),
      title: j.title ?? "",
      company: j.company_name || company,
      department: j.departments?.[0]?.name ?? null,
      locations: [j.location?.name, ...(j.offices ?? []).map((o) => o.name ?? o.location)],
      // Greenhouse HTML-escapes the description inside a JSON string.
      descriptionHtml: j.content ? decodeEntities(j.content) : null,
      apply_url: j.absolute_url ?? "",
      posted_at: j.first_published ?? j.updated_at ?? null,
    });
    if (built) jobs.push(built);
  }
  return { ok: true, jobs };
}

/* ----------------------------------------------------------------- lever */

type LvJob = {
  id?: string;
  text?: string;
  hostedUrl?: string;
  applyUrl?: string;
  createdAt?: number;
  workplaceType?: string;
  country?: string;
  descriptionPlain?: string;
  description?: string;
  additionalPlain?: string;
  categories?: {
    commitment?: string;
    department?: string;
    location?: string;
    team?: string;
    allLocations?: string[];
  };
};

async function lever(slug: string, company: string): Promise<FetchResult> {
  const got = await getJson(`https://api.lever.co/v0/postings/${slug}?mode=json`);
  if (!got.ok) return got;

  const raw = got.data;
  if (!Array.isArray(raw)) return { ok: false, error: "Expected a JSON array" };

  const jobs: NormalisedJob[] = [];
  for (const j of raw as LvJob[]) {
    const built = assemble({
      provider: "lever",
      external_id: String(j.id ?? ""),
      title: j.text ?? "",
      company,
      department: j.categories?.department ?? j.categories?.team ?? null,
      locations: [j.categories?.location, ...(j.categories?.allLocations ?? []), country(j.country)],
      workplaceType: j.workplaceType ?? null,
      employmentRaw: j.categories?.commitment ?? null,
      // Lever hands us plain text already; the two halves are the description
      // and the "requirements" lists, and years-of-experience usually lives
      // in the second one.
      descriptionText: [j.descriptionPlain, j.additionalPlain].filter(Boolean).join("\n\n") || null,
      descriptionHtml: j.description ?? null,
      apply_url: j.hostedUrl || j.applyUrl || "",
      posted_at: j.createdAt ? new Date(j.createdAt).toISOString() : null,
    });
    if (built) jobs.push(built);
  }
  return { ok: true, jobs };
}

/* ----------------------------------------------------------------- ashby */

type AsJob = {
  id?: string;
  title?: string;
  department?: string;
  team?: string;
  employmentType?: string;
  location?: string;
  secondaryLocations?: { location?: string }[];
  isRemote?: boolean;
  isListed?: boolean;
  workplaceType?: string;
  publishedAt?: string;
  jobUrl?: string;
  applyUrl?: string;
  descriptionPlain?: string;
  descriptionHtml?: string;
  compensationTiers?: {
    components?: {
      compensationType?: string;
      interval?: string;
      currencyCode?: string;
      minValue?: number;
      maxValue?: number;
    }[];
  }[];
};

async function ashby(slug: string, company: string): Promise<FetchResult> {
  const got = await getJson(
    `https://api.ashbyhq.com/posting-api/job-board/${slug}?includeCompensation=true`,
  );
  if (!got.ok) return got;

  const raw = (got.data as { jobs?: AsJob[] })?.jobs;
  if (!Array.isArray(raw)) return { ok: false, error: "No jobs array in the response" };

  const jobs: NormalisedJob[] = [];
  for (const j of raw as AsJob[]) {
    if (j.isListed === false) continue;

    const built = assemble({
      provider: "ashby",
      external_id: String(j.id ?? ""),
      title: j.title ?? "",
      company,
      department: j.department ?? j.team ?? null,
      locations: [
        j.location,
        ...(j.secondaryLocations ?? []).map((s) => s.location),
        j.isRemote ? "Remote" : null,
      ],
      workplaceType: j.workplaceType ?? null,
      employmentRaw: j.employmentType ?? null,
      descriptionText: j.descriptionPlain ?? null,
      descriptionHtml: j.descriptionHtml ?? null,
      apply_url: j.applyUrl || j.jobUrl || "",
      posted_at: j.publishedAt ?? null,
      money: ashbyMoney(j),
    });
    if (built) jobs.push(built);
  }
  return { ok: true, jobs };
}

/**
 * Ashby is the only one of the three that publishes structured pay, and it
 * publishes several components — salary, equity, bonus. Only base salary is
 * comparable across jobs, so the rest is dropped rather than added up.
 */
function ashbyMoney(j: AsJob): Money | undefined {
  for (const tier of j.compensationTiers ?? []) {
    for (const c of tier.components ?? []) {
      if ((c.compensationType ?? "").toLowerCase() !== "salary") continue;
      const min = typeof c.minValue === "number" ? c.minValue : null;
      const max = typeof c.maxValue === "number" ? c.maxValue : null;
      if (min === null && max === null) continue;
      return {
        min,
        max,
        currency: c.currencyCode ?? null,
        period: (c.interval ?? "").toLowerCase().includes("year") ? "year" : (c.interval ?? null),
      };
    }
  }
  return undefined;
}

/* ------------------------------------------------------------------ util */

/**
 * Lever sends an ISO country code. "IN" cannot go into the location matcher
 * as-is — it is a two-letter word that appears inside half the English
 * language — so it is expanded here, where the meaning is unambiguous.
 */
function country(code: string | null | undefined): string | null {
  if (!code) return null;
  const c = code.trim().toUpperCase();
  if (c === "IN" || c === "IND") return "India";
  return c.length === 2 ? null : code;
}

function decodeEntities(s: string): string {
  return s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&");
}
