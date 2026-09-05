import "server-only";
import { createAppServerClient, getSessionUser } from "@/lib/supabase/app";
import type { AtsResult } from "@/lib/tools/ats";
import { cleanResume, type Resume as ResumeContent } from "@/lib/app/resume-schema";

export type Plan = "free" | "pro";
export type PlanStatus = "inactive" | "active" | "past_due" | "cancelled";

export type Profile = {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  avatar_url: string | null;
  headline: string | null;
  current_title: string | null;
  current_company: string | null;
  years_experience: number | null;
  current_ctc: number | null;
  expected_ctc: number | null;
  notice_period_days: number | null;
  preferred_cities: string[];
  open_to_remote: boolean;
  target_roles: string[];
  plan: Plan;
  plan_status: PlanStatus;
  plan_expires_at: string | null;
  onboarded_at: string | null;
  updated_at: string | null;
};

/**
 * The resume's contents, as opposed to the row it lives in.
 *
 * One definition, in lib/app/resume-schema.ts, shared by the parser, the
 * builder, the agent's tools and any form. This alias stays because most of
 * the app already calls it `ParsedResume`, and because `Resume` below is
 * already taken by the database row — two different things that would
 * otherwise share a name.
 */
export type ParsedResume = ResumeContent;

export type Resume = {
  id: string;
  user_id: string;
  file_name: string | null;
  file_type: string | null;
  ats_score: number | null;
  parsed: ParsedResume | null;
  parse_error: string | null;
  parsed_at: string | null;
  skills: string[];
  years_experience: number | null;
  latest_title: string | null;
  latest_company: string | null;
  is_primary: boolean;
  created_at: string;
};

/**
 * A resume being written, as opposed to one that was uploaded.
 *
 * `content` is the same shape as `resumes.parsed` on purpose — a draft begins
 * as a copy of it. `ats_score` is stored rather than computed on read so a
 * list screen does not have to render and re-score every draft to show a
 * number; it is written by the route on every save, never by hand.
 */
export type ResumeDraft = {
  id: string;
  user_id: string;
  source_resume_id: string | null;
  title: string;
  content: ParsedResume;
  ats_score: number | null;
  ats_result: AtsResult | null;
  /**
   * Which theme it is painted in. Presentation only — every template
   * renders the same sections in the same order, so this never changes
   * what the score describes. See lib/app/resume-templates.ts.
   */
  template: string;
  /** Unguessable address for /r/<id>, once sharing has been switched on once. */
  share_id: string | null;
  /** Whether that address currently serves anything. */
  is_public: boolean;
  is_primary: boolean;
  created_at: string;
  updated_at: string;
};

/**
 * The signed-in user's profile.
 *
 * Returns null when nobody is signed in, and — separately — null when the row
 * is missing. Those are different problems: the second means the sign-up
 * trigger did not fire, which is worth knowing rather than silently rendering
 * an empty dashboard.
 */
export async function getProfile(): Promise<Profile | null> {
  const supabase = await createAppServerClient();
  if (!supabase) return null;

  const user = await getSessionUser();
  if (!user) return null;

  const { data } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  return (data as Profile) ?? null;
}

export async function getResumes(): Promise<Resume[]> {
  const supabase = await createAppServerClient();
  if (!supabase) return [];
  const { data } = await supabase
    .from("resumes")
    .select(
      "id,user_id,file_name,file_type,ats_score,parsed,parse_error,parsed_at," +
        "skills,years_experience,latest_title,latest_company,is_primary,created_at",
    )
    .order("created_at", { ascending: false })
    .limit(20);

  /**
   * Cleaned on the way out, not on the way in.
   *
   * Rows written before the schema gained projects and achievements are
   * missing those keys entirely, and code reading `parsed.projects` would find
   * undefined where the type promises an array. Normalising here means old
   * rows quietly become current ones as they are read, with no migration and
   * no version column.
   */
  return ((data ?? []) as unknown as Resume[]).map((r) => ({
    ...r,
    parsed: r.parsed ? cleanResume(r.parsed) : null,
  }));
}

export async function getPrimaryResume(): Promise<Resume | null> {
  const all = await getResumes();
  return all.find((r) => r.is_primary) ?? all[0] ?? null;
}

const DRAFT_COLUMNS =
  "id,user_id,source_resume_id,title,content,ats_score,ats_result,template,share_id,is_public,is_primary,created_at,updated_at";

/**
 * The draft somebody is working on.
 *
 * A missing table is not an error worth showing anybody a stack trace over —
 * it means `50_resume_drafts.sql` has not been run on this deployment yet, and
 * the page above should say "nothing here yet" rather than break. Every other
 * failure lands in the same place, which is a real cost: a broken database
 * looks identical to an empty one from here. It is the right trade for a read
 * that only decides whether to show a preview.
 */
export async function getPrimaryDraft(): Promise<ResumeDraft | null> {
  const supabase = await createAppServerClient();
  if (!supabase) return null;

  const { data } = await supabase
    .from("resume_drafts")
    .select(DRAFT_COLUMNS)
    .order("is_primary", { ascending: false })
    .order("updated_at", { ascending: false })
    .limit(1);

  const draft = ((data ?? [])[0] as unknown as ResumeDraft) ?? null;
  // Same normalisation as getResumes, for the same reason.
  return draft ? { ...draft, content: cleanResume(draft.content) } : null;
}

/**
 * Is this account paid, right now?
 *
 * Mirrors has_active_plan() in SQL rather than calling it, so a page render
 * costs no extra round trip. A cancelled plan stays valid until it expires —
 * somebody who paid for the month gets the month.
 */
export function isPaid(profile: Profile | null): boolean {
  if (!profile) return false;
  if (profile.plan !== "pro") return false;
  if (!["active", "cancelled"].includes(profile.plan_status)) return false;
  if (!profile.plan_expires_at) return true;
  return new Date(profile.plan_expires_at) > new Date();
}

/** How complete the profile is, and what to ask for next. */
export function profileGaps(profile: Profile | null, resume: Resume | null) {
  const gaps: { key: string; label: string; href: string }[] = [];
  if (!resume) {
    gaps.push({ key: "resume", label: "Add your resume", href: "/app/resume" });
  } else if (!resume.parsed) {
    gaps.push({ key: "parse", label: "Finish reading your resume", href: "/app/resume" });
  }
  if (!profile?.target_roles?.length) {
    gaps.push({ key: "roles", label: "Say what roles you want", href: "/app/profile" });
  }
  if (!profile?.preferred_cities?.length && !profile?.open_to_remote) {
    gaps.push({ key: "cities", label: "Add where you'd work", href: "/app/profile" });
  }
  return gaps;
}

/**
 * How much of this person we actually know, 0–100.
 *
 * Weighted by what matching needs rather than by how many boxes are filled.
 * The resume and the target role are most of the signal; a notice period
 * changes which jobs are worth showing but not whether we can rank at all.
 * The numbers are a judgement, not a measurement — but a stable judgement,
 * so the bar only ever moves when the person does something.
 */
export function profileStrength(profile: Profile | null, resume: Resume | null): number {
  const checks: [boolean, number][] = [
    [Boolean(resume), 22],
    [Boolean(resume?.parsed), 12],
    [(resume?.skills?.length ?? 0) >= 4, 10],
    [Boolean(profile?.target_roles?.length), 18],
    [Boolean(profile?.preferred_cities?.length) || Boolean(profile?.open_to_remote), 14],
    [profile?.years_experience !== null && profile?.years_experience !== undefined, 8],
    [Boolean(profile?.expected_ctc), 8],
    [profile?.notice_period_days !== null && profile?.notice_period_days !== undefined, 5],
    [Boolean(profile?.full_name), 3],
  ];

  return checks.reduce((sum, [done, weight]) => sum + (done ? weight : 0), 0);
}

/** Has this person told us what they actually want yet? */
export function hasIntent(profile: Profile | null): boolean {
  return Boolean(
    profile?.target_roles?.length &&
      (profile.preferred_cities?.length || profile.open_to_remote),
  );
}
