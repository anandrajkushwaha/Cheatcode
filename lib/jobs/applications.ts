import "server-only";
import { createAppAdminClient, createAppServerClient } from "@/lib/supabase/app";
import { isPaid, type Profile } from "@/lib/app/account";
import { isOwnerEmail } from "@/lib/analytics/owner";
import type { Pack } from "@/lib/jobs/pack-guard";

/**
 * Applications somebody prepared (114_job_applications.sql), and how many
 * more they may prepare. Free accounts get a few a month — each one is two
 * model calls — and Pro is unlimited.
 */

export const FREE_PACKS_PER_MONTH = 3;

export type ApplicationStatus = "prepared" | "applied" | "interview" | "offer" | "rejected" | "withdrawn";
export const STATUSES: ApplicationStatus[] = ["prepared", "applied", "interview", "offer", "rejected", "withdrawn"];

export type Application = {
  id: string;
  job_id: string | null;
  company: string;
  title: string;
  apply_url: string | null;
  status: ApplicationStatus;
  match_score: number | null;
  pack: Pack | null;
  draft_id: string | null;
  notes: string | null;
  applied_at: string | null;
  created_at: string;
  updated_at: string;
};

const COLUMNS =
  "id,job_id,company,title,apply_url,status,match_score,pack,draft_id,notes,applied_at,created_at,updated_at";

export type JobDetail = {
  id: string;
  title: string;
  company: string;
  description: string | null;
  skills: string[];
  cities: string[];
  is_remote: boolean;
  location_raw: string | null;
  years_min: number | null;
  years_max: number | null;
  apply_url: string;
};

export async function getJob(id: string): Promise<JobDetail | null> {
  const supabase = await createAppServerClient();
  if (!supabase || !/^[0-9a-f-]{36}$/i.test(id)) return null;
  const { data } = await supabase
    .from("jobs")
    .select("id,title,company,description,skills,cities,is_remote,location_raw,years_min,years_max,apply_url")
    .eq("id", id)
    .maybeSingle();
  return (data as JobDetail | null) ?? null;
}

export async function listApplications(): Promise<Application[]> {
  const supabase = await createAppServerClient();
  if (!supabase) return [];
  const { data } = await supabase.from("job_applications").select(COLUMNS).order("updated_at", { ascending: false });
  return (data ?? []) as Application[];
}

export async function getApplicationForJob(jobId: string): Promise<Application | null> {
  const supabase = await createAppServerClient();
  if (!supabase) return null;
  const { data } = await supabase.from("job_applications").select(COLUMNS).eq("job_id", jobId).maybeSingle();
  return (data as Application | null) ?? null;
}

export async function getApplication(id: string): Promise<Application | null> {
  const supabase = await createAppServerClient();
  if (!supabase || !/^[0-9a-f-]{36}$/i.test(id)) return null;
  const { data } = await supabase.from("job_applications").select(COLUMNS).eq("id", id).maybeSingle();
  return (data as Application | null) ?? null;
}

/** How many packs are left this month. Infinity for Pro and for the owner's test account. */
export async function packsLeft(userId: string, email: string | null, profile: Profile | null): Promise<number> {
  if (isPaid(profile) || isOwnerEmail(email)) return Number.POSITIVE_INFINITY;
  const db = createAppAdminClient();
  if (!db) return 0;
  const start = new Date();
  start.setUTCDate(1);
  start.setUTCHours(0, 0, 0, 0);
  const { count } = await db
    .from("job_applications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .not("pack", "is", null)
    .gte("created_at", start.toISOString());
  return Math.max(0, FREE_PACKS_PER_MONTH - (count ?? 0));
}

/** Written by the server only: the pack is the model's output, not the person's. */
export async function savePack(
  userId: string,
  job: JobDetail,
  pack: Pack,
  matchScore: number,
): Promise<Application> {
  const db = createAppAdminClient();
  if (!db) throw new Error("Applications aren't configured.");
  const { data, error } = await db
    .from("job_applications")
    .upsert(
      {
        user_id: userId,
        job_id: job.id,
        company: job.company,
        title: job.title,
        apply_url: job.apply_url,
        match_score: matchScore,
        pack,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,job_id" },
    )
    .select(COLUMNS)
    .single();
  if (error) throw new Error(error.message);
  return data as Application;
}

export async function linkDraft(userId: string, applicationId: string, draftId: string): Promise<void> {
  const db = createAppAdminClient();
  if (!db) return;
  await db.from("job_applications").update({ draft_id: draftId }).eq("id", applicationId).eq("user_id", userId);
}

/** Quiet for this long after applying: time to follow up. */
export const FOLLOW_UP_DAYS = 10;

export function needsFollowUp(a: Application, now = Date.now()): boolean {
  if (a.status !== "applied" || !a.applied_at) return false;
  return now - new Date(a.applied_at).getTime() > FOLLOW_UP_DAYS * 86_400_000;
}
