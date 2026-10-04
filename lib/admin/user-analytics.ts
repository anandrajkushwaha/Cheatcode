import "server-only";
import { createAppAdminClient } from "@/lib/supabase/app";
import { cleanResume, type Resume } from "@/lib/app/resume-schema";

/**
 * Who the people using this actually are.
 *
 * The People tab counts accounts. This one reads what they wrote. Almost
 * nobody fills in a profile, but everybody who builds a résumé types their
 * name, city, phone and job title into it — so the résumé is the better
 * source for every field here, and the profile is only the fallback.
 *
 * Nothing on this screen is invented. A field with no source shows a dash.
 * The single exception is the age, which is marked as an estimate wherever
 * it appears, because it is arithmetic on a graduation year rather than
 * something anybody told us: there is no date of birth in this product.
 */

export type Gap = {
  label: string;
  detail: string;
  status: "warn" | "fail";
  weight: number;
};

export type PersonCard = {
  userId: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  city: string | null;
  /** Bucketed from years of experience, or from having no work history at all. */
  careerStage: string | null;
  yearsExperience: number | null;
  /** Their own words — a headline, a target role, or their latest job title. */
  profession: string | null;
  /** That title sorted into a family, by keyword. Never guessed by an LLM. */
  domain: string | null;
  /** Arithmetic on the graduation year. Always shown as an estimate. */
  ageEstimate: number | null;
  gradYear: number | null;
  plan: string;
  joined: string;
  lastActive: string | null;
  drafts: number;
  atsScore: number | null;
  gaps: Gap[];
  /** Where the identity fields came from, so the screen can say so. */
  source: "resume" | "profile" | "none";
};

export type UserAnalytics = {
  people: PersonCard[];
  stages: { label: string; count: number }[];
  domains: { label: string; count: number }[];
  cities: { label: string; count: number }[];
  commonGaps: { label: string; count: number }[];
  withResume: number;
};

/* ------------------------------------------------------------------ domain */

/**
 * Job title to field, by keyword.
 *
 * Deliberately a lookup table and not a model call: this runs for every
 * person on the list, and paying an LLM to read the word "developer" is a
 * bill with no answer attached. Order matters — the first family whose words
 * appear wins, so the narrower ones are listed before the broad ones.
 */
const DOMAINS: { label: string; words: string[] }[] = [
  { label: "Data & analytics", words: ["data scien", "data analy", "analytics", "machine learning", "ml engineer", "data engineer", "business analy", "bi "] },
  { label: "Design", words: ["designer", "design ", "ux", "ui ", "graphic", "visual", "motion"] },
  { label: "Product", words: ["product manager", "product owner", "associate product", "product manage"] },
  { label: "Engineering", words: ["engineer", "developer", "programmer", "sde", "full stack", "fullstack", "backend", "frontend", "devops", "qa ", "tester", "architect", "technical lead"] },
  { label: "Marketing", words: ["marketing", "seo", "growth", "brand", "social media", "digital market", "performance market"] },
  { label: "Sales & BD", words: ["sales", "business development", "account executive", "bdm", "inside sales", "relationship manager"] },
  { label: "Finance & accounting", words: ["accountant", "finance", "financial", "audit", "taxation", "ca ", "chartered account", "treasury"] },
  { label: "HR & recruiting", words: ["human resource", "recruit", "talent acquisition", "hr ", "people ops"] },
  { label: "Operations", words: ["operations", "supply chain", "logistics", "procurement", "warehouse", "production"] },
  { label: "Support", words: ["customer support", "customer success", "technical support", "service desk", "call centre", "call center"] },
  { label: "Content & writing", words: ["content", "writer", "copywrit", "editor", "journalis"] },
  { label: "Teaching", words: ["teacher", "lecturer", "professor", "tutor", "faculty", "trainer"] },
  { label: "Healthcare", words: ["nurse", "doctor", "pharmac", "medical", "clinical", "physio"] },
  { label: "Legal", words: ["lawyer", "legal", "advocate", "paralegal", "compliance"] },
  { label: "Consulting", words: ["consultant", "consulting", "advisory"] },
];

function domainOf(title: string | null): string | null {
  if (!title) return null;
  const t = ` ${title.toLowerCase()} `;
  for (const d of DOMAINS) if (d.words.some((w) => t.includes(w))) return d.label;
  return "Other";
}

/* ------------------------------------------------------------ career stage */

function stageOf(years: number | null, resume: Resume | null): string | null {
  if (years === null || Number.isNaN(years)) {
    // No number given. Somebody with education and no jobs is a fresher; with
    // neither, we know nothing and say nothing.
    if (!resume) return null;
    if (resume.roles.length === 0 && resume.education.length > 0) return "Fresher";
    return null;
  }
  if (years < 1) return "Fresher";
  if (years < 3) return "1–3 yrs";
  if (years < 6) return "3–6 yrs";
  if (years < 10) return "6–10 yrs";
  return "10+ yrs";
}

/* -------------------------------------------------------------------- age */

const NOW_YEAR = new Date().getFullYear();

/**
 * The latest plausible four-digit year in the education section.
 *
 * "2018 - 2022", "2022", "Batch of 2021" all appear, so the string is
 * scanned rather than parsed, and the largest sane year wins — that is the
 * one they finished on.
 */
function graduationYear(resume: Resume | null): number | null {
  if (!resume) return null;
  let best: number | null = null;
  for (const e of resume.education) {
    for (const m of (e.year ?? "").matchAll(/\b(19|20)\d{2}\b/g)) {
      const y = Number(m[0]);
      if (y >= 1970 && y <= NOW_YEAR + 6 && (best === null || y > best)) best = y;
    }
  }
  return best;
}

/** Graduating at about 22 is the assumption, and it is only ever an estimate. */
function ageFrom(gradYear: number | null): number | null {
  if (gradYear === null) return null;
  const age = NOW_YEAR - gradYear + 22;
  return age >= 17 && age <= 75 ? age : null;
}

/* ------------------------------------------------------------------- gaps */

type Check = { label?: string; detail?: string; status?: string; weight?: number };

function gapsOf(result: unknown): Gap[] {
  const checks = (result as { checks?: Check[] } | null)?.checks;
  if (!Array.isArray(checks)) return [];
  return checks
    .filter((c) => c?.status === "warn" || c?.status === "fail")
    .map((c) => ({
      label: String(c.label ?? "").slice(0, 120),
      detail: String(c.detail ?? "").slice(0, 400),
      status: c.status === "fail" ? ("fail" as const) : ("warn" as const),
      weight: Number(c.weight ?? 0),
    }))
    .filter((g) => g.label)
    .sort((a, b) => (a.status === b.status ? b.weight - a.weight : a.status === "fail" ? -1 : 1));
}

/* ------------------------------------------------------------------ build */

const first = <T,>(...vals: (T | null | undefined)[]): T | null => {
  for (const v of vals) {
    if (v === null || v === undefined) continue;
    if (typeof v === "string" && !v.trim()) continue;
    return v;
  }
  return null;
};

type ProfileRow = {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  headline: string | null;
  current_title: string | null;
  years_experience: number | null;
  preferred_cities: string[] | null;
  target_roles: string[] | null;
  plan: string | null;
  created_at: string;
};

type DraftRow = {
  user_id: string;
  content: unknown;
  ats_score: number | null;
  ats_result: unknown;
  is_primary: boolean | null;
  updated_at: string;
};

export async function getUserAnalytics(
  limit = 400,
): Promise<UserAnalytics | { missing: true }> {
  const db = createAppAdminClient();
  if (!db) return { missing: true };

  const { data: profiles, error: pErr } = await db
    .from("profiles")
    .select(
      "id,full_name,email,phone,headline,current_title,years_experience,preferred_cities,target_roles,plan,created_at",
    )
    .order("created_at", { ascending: false })
    .limit(limit);
  if (pErr) return { missing: true };

  const { data: drafts, error: dErr } = await db
    .from("resume_drafts")
    .select("user_id,content,ats_score,ats_result,is_primary,updated_at")
    .order("updated_at", { ascending: false })
    .limit(limit * 3);
  if (dErr) return { missing: true };

  // One résumé per person: the primary if they marked one, else the newest.
  const best = new Map<string, DraftRow>();
  const counts = new Map<string, number>();
  for (const d of (drafts ?? []) as DraftRow[]) {
    counts.set(d.user_id, (counts.get(d.user_id) ?? 0) + 1);
    const held = best.get(d.user_id);
    if (!held || (d.is_primary && !held.is_primary)) best.set(d.user_id, d);
  }

  const people: PersonCard[] = [];

  for (const p of (profiles ?? []) as ProfileRow[]) {
    const draft = best.get(p.id) ?? null;
    const r = draft ? cleanResume(draft.content) : null;
    const hasResume = Boolean(r && (r.full_name || r.roles.length || r.education.length));

    const name = first(r?.full_name, p.full_name);
    const email = first(r?.email, p.email);
    const phone = first(r?.phone, p.phone);
    const city = first(r?.location, p.preferred_cities?.[0]);
    const profession = first(
      r?.headline,
      r?.target_role,
      r?.roles.find((x) => x.title)?.title,
      p.current_title,
      p.headline,
      p.target_roles?.[0],
    );
    const years = first(r?.years_experience ?? null, p.years_experience);
    const grad = graduationYear(r);

    people.push({
      userId: p.id,
      name,
      email,
      phone,
      city,
      careerStage: stageOf(years, r),
      yearsExperience: years,
      profession,
      domain: domainOf(profession),
      ageEstimate: ageFrom(grad),
      gradYear: grad,
      plan: p.plan ?? "free",
      joined: p.created_at,
      lastActive: draft?.updated_at ?? null,
      drafts: counts.get(p.id) ?? 0,
      atsScore: draft?.ats_score ?? null,
      gaps: gapsOf(draft?.ats_result),
      source: hasResume ? "resume" : name || email || phone ? "profile" : "none",
    });
  }

  const tally = (vals: (string | null)[]) => {
    const m = new Map<string, number>();
    for (const v of vals) if (v) m.set(v, (m.get(v) ?? 0) + 1);
    return [...m.entries()]
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => b.count - a.count);
  };

  return {
    people,
    stages: tally(people.map((x) => x.careerStage)),
    domains: tally(people.map((x) => x.domain)).slice(0, 10),
    cities: tally(people.map((x) => x.city)).slice(0, 10),
    commonGaps: tally(people.flatMap((x) => x.gaps.map((g) => g.label))).slice(0, 8),
    withResume: people.filter((x) => x.source === "resume").length,
  };
}
