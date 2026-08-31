import "server-only";
import { createAppServerClient, getSessionUser } from "@/lib/supabase/app";

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
};

export type ParsedResume = {
  full_name?: string | null;
  email?: string | null;
  phone?: string | null;
  location?: string | null;
  headline?: string | null;
  summary?: string | null;
  years_experience?: number | null;
  skills?: string[];
  roles?: {
    title?: string | null;
    company?: string | null;
    start?: string | null;
    end?: string | null;
    is_current?: boolean;
    highlights?: string[];
  }[];
  education?: { degree?: string | null; institution?: string | null; year?: string | null }[];
  certifications?: string[];
  links?: { label?: string | null; url?: string | null }[];
};

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
  return (data ?? []) as unknown as Resume[];
}

export async function getPrimaryResume(): Promise<Resume | null> {
  const all = await getResumes();
  return all.find((r) => r.is_primary) ?? all[0] ?? null;
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
