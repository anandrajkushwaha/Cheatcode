import "server-only";
import { createAppAdminClient } from "@/lib/supabase/app";
import { TEMPLATES } from "@/lib/app/resume-templates";
import { cleanResume, type Resume } from "@/lib/app/resume-schema";
import { sampleFor } from "@/lib/app/design-sample";

/**
 * Who the people using this actually are.
 *
 * The People tab counts accounts. This one reads what they wrote. Almost
 * nobody fills in a profile, but everybody who builds a résumé types their
 * name, city, phone and job title into it — so the résumé is the better
 * source for every field here, and the profile is only the fallback.
 *
 * One trap had to be closed first. Picking a template fills a thin draft with
 * `starterContent` — a complete sample résumé, somebody else's name, jobs and
 * city, saved straight into `content` so the template opens with something to
 * write over. Read naively, those nine invented people appear on this screen
 * as users, with phone numbers and an age. Every draft is therefore checked
 * against its own template's sample before a single field is believed.
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

/** Where the identity on a card came from. Best available wins. */
export type Source = "resume" | "design" | "upload" | "profile" | "sample" | "none";

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
  /**
   * Where the identity fields came from, so the screen can say so.
   * `sample` means they picked a template and never replaced its words.
   */
  source: Source;
};

export type UserAnalytics = {
  people: PersonCard[];
  stages: { label: string; count: number }[];
  domains: { label: string; count: number }[];
  cities: { label: string; count: number }[];
  commonGaps: { label: string; count: number }[];
  withResume: number;
  /** Picked a template, wrote nothing of their own. */
  sampleOnly: number;
  /** Identity recovered from a résumé that only exists on the canvas. */
  fromDesign: number;
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

/* ------------------------------------------------------- the canvas, read */

/**
 * Pulling a person out of a résumé that only exists as positioned boxes.
 *
 * The builder stops writing back to `content` the moment somebody edits on
 * the canvas, so for everybody who designed their résumé and took the PDF
 * away, the structured copy is frozen at whatever it was before they started
 * and the real document is a list of text elements. Those people are exactly
 * the ones worth knowing about — they finished — and reading `content` for
 * them returns a half-empty record.
 *
 * Only what can be recognised for certain is taken. An email and a phone
 * number are patterns and cannot be mistaken for anything else. The name is
 * the largest line on the first page, which is how every one of these
 * templates is built. Job title and city are not guessed from here: there is
 * no way to tell a city from a company from a degree in a bare list of
 * strings, and a wrong city is worse than an empty one.
 */
type TextEl = { type: string; text?: string; size?: number; y?: number };

const EMAIL = /[\w.+-]+@[\w-]+\.[\w.-]{2,}/;
const PHONE = /(?:\+?91[\s-]?)?[6-9]\d{4}[\s-]?\d{5}\b|\+\d{1,3}[\s-]?\d[\d\s-]{7,13}\d/;

function readDesign(design: unknown): { name: string | null; email: string | null; phone: string | null } {
  const pages = (design as { pages?: { elements?: TextEl[] }[] } | null)?.pages;
  if (!Array.isArray(pages) || pages.length === 0) return { name: null, email: null, phone: null };

  const all: TextEl[] = [];
  for (const pg of pages) for (const el of pg.elements ?? []) if (el?.type === "text" && el.text) all.push(el);
  const blob = all.map((e) => e.text).join("\n");

  const email = blob.match(EMAIL)?.[0] ?? null;
  const phone = blob.match(PHONE)?.[0]?.trim() ?? null;

  // The name: biggest type on sheet one, and only if it reads like a name
  // rather than a heading somebody set large.
  const firstPage = (pages[0].elements ?? []).filter((e) => e?.type === "text" && e.text);
  let name: string | null = null;
  let best = 0;
  for (const el of firstPage) {
    const line = (el.text ?? "").split("\n")[0].trim();
    const size = Number(el.size ?? 0);
    if (!line || size <= best) continue;
    const words = line.split(/\s+/);
    const plausible =
      words.length >= 2 &&
      words.length <= 5 &&
      line.length <= 48 &&
      !EMAIL.test(line) &&
      !/\d/.test(line) &&
      line !== line.toUpperCase();
    if (plausible) {
      best = size;
      name = line;
    }
  }

  return { name, email, phone };
}

/* ----------------------------------------------------------------- sample */

/**
 * Is this document still the sample the template arrived with?
 *
 * Judged on identity, not on the body: somebody who starts writing replaces
 * the name and the contact line long before they finish rewriting the jobs,
 * and somebody who has not started has left all of it. Matching whole fields
 * against that template's own sample avoids the obvious trap of a string
 * blocklist — half the sample people live in Bengaluru, and so do a lot of
 * real ones.
 */
const SAMPLE_NAMES = new Set<string>();
for (const t of TEMPLATES) {
  const n = sampleFor(t.id).full_name;
  if (n) SAMPLE_NAMES.add(n.trim().toLowerCase());
}

function isSample(r: Resume, templateId: string | null): boolean {
  const email = (r.email ?? "").trim().toLowerCase();
  // Reserved by RFC 2606 and used by every sample here. Never a real address.
  if (email.endsWith("@example.com")) return true;

  const name = (r.full_name ?? "").trim().toLowerCase();
  if (name && SAMPLE_NAMES.has(name)) return true;

  if (templateId) {
    const s = sampleFor(templateId);
    if (name && name === (s.full_name ?? "").trim().toLowerCase()) return true;
    if (email && email === (s.email ?? "").trim().toLowerCase()) return true;
  }
  return false;
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
  template: string | null;
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

  /**
   * Résumés people uploaded to be scanned. Parsed once by a model and never
   * edited — the file says so: "so its score stays honest". For anybody who
   * came for the ATS check and never opened the builder, this is the only
   * record of who they are, and it is a good one.
   */
  const { data: uploads } = await db
    .from("resumes")
    .select("user_id,parsed,ats_score,ats_result,created_at")
    .not("parsed", "is", null)
    .order("created_at", { ascending: false })
    .limit(limit * 2);

  const parsedByUser = new Map<string, { parsed: unknown; ats_score: number | null; ats_result: unknown }>();
  for (const u of (uploads ?? []) as { user_id: string; parsed: unknown; ats_score: number | null; ats_result: unknown }[]) {
    if (!parsedByUser.has(u.user_id)) parsedByUser.set(u.user_id, u);
  }

  const { data: drafts, error: dErr } = await db
    .from("resume_drafts")
    .select("user_id,template,content,ats_score,ats_result,is_primary,updated_at")
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
    const raw = draft ? cleanResume(draft.content) : null;

    // The template's own sample, still untouched. None of it is theirs — not
    // the name, not the city, not the jobs, and not the graduation year the
    // age would have been worked out from. It is dropped whole.
    const sample = Boolean(raw && isSample(raw, draft?.template ?? null));
    const r = sample ? null : raw;

    const hasResume = Boolean(r && (r.full_name || r.roles.length || r.education.length));

    // The uploaded file, parsed. Real, and untouched since the day it landed.
    const up = parsedByUser.get(p.id);
    const u = up ? cleanResume(up.parsed) : null;
    const hasUpload = Boolean(u && (u.full_name || u.roles.length || u.education.length));

    const name = first(r?.full_name, u?.full_name, p.full_name);
    const email = first(r?.email, u?.email, p.email);
    const phone = first(r?.phone, u?.phone, p.phone);
    const city = first(r?.location, u?.location, p.preferred_cities?.[0]);
    const profession = first(
      r?.headline,
      r?.target_role,
      r?.roles.find((x) => x.title)?.title,
      u?.headline,
      u?.target_role,
      u?.roles.find((x) => x.title)?.title,
      p.current_title,
      p.headline,
      p.target_roles?.[0],
    );
    const years = first(r?.years_experience ?? null, u?.years_experience ?? null, p.years_experience);
    const grad = graduationYear(r) ?? graduationYear(u);

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
      atsScore: (sample ? null : draft?.ats_score) ?? up?.ats_score ?? null,
      gaps: sample ? gapsOf(up?.ats_result) : gapsOf(draft?.ats_result ?? up?.ats_result),
      source: hasResume
        ? "resume"
        : hasUpload
          ? "upload"
          : name || email || phone
            ? "profile"
            : sample
              ? "sample"
              : "none",
    });
  }

  /**
   * Last pass: the people whose résumé only exists on the canvas.
   *
   * Designs are fetched here and not with everything else because each one
   * carries its photograph inside it as a base64 string of up to three
   * megabytes. Pulling four hundred of those to read a handful of names
   * would be a hundred megabytes for nothing, so only the cards that are
   * still missing a name, an email or a phone ask for one, ten at a time.
   */
  const needy = people.filter((x) => !x.name || !x.email || !x.phone).map((x) => x.userId);
  const byId = new Map(people.map((x) => [x.userId, x]));

  for (let i = 0; i < needy.length; i += 10) {
    const slice = needy.slice(i, i + 10);
    const { data: rows } = await db
      .from("resume_drafts")
      .select("user_id,design")
      .in("user_id", slice)
      .not("design", "is", null)
      .order("updated_at", { ascending: false });

    for (const row of (rows ?? []) as { user_id: string; design: unknown }[]) {
      const card = byId.get(row.user_id);
      if (!card || (card.name && card.email && card.phone)) continue;

      const found = readDesign(row.design);
      let used = false;
      if (!card.name && found.name) {
        card.name = found.name;
        used = true;
      }
      if (!card.email && found.email) {
        card.email = found.email;
        used = true;
      }
      if (!card.phone && found.phone) {
        card.phone = found.phone;
        used = true;
      }
      // Only claim the canvas as the source when it supplied the identity.
      if (used && (card.source === "none" || card.source === "sample" || card.source === "profile")) {
        card.source = "design";
      }
    }
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
    sampleOnly: people.filter((x) => x.source === "sample").length,
    fromDesign: people.filter((x) => x.source === "design").length,
  };
}
