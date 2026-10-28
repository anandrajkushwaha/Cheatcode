import { createAppAdminClient } from "@/lib/supabase/app";

/**
 * The open jobs the free ATS checker matches a resume against — in the
 * browser, because the checker promises the resume never leaves it.
 *
 * So this sends the jobs to the resume rather than the resume to the jobs:
 * role, skills, experience and city only. No company and no link — those are
 * what an unlock pays for (lib/jobs/unlocks.ts). One role per company, and
 * cached at the edge for an hour; it is the same list for everybody.
 */
export const revalidate = 3600;

export async function GET() {
  const db = createAppAdminClient();
  if (!db) return Response.json({ jobs: [] });
  const { data } = await db
    .from("jobs")
    .select("id,title,company,skills,years_min,years_max,cities,is_remote")
    .eq("is_active", true)
    .order("posted_at", { ascending: false, nullsFirst: false })
    .limit(800);
  const seen = new Set<string>();
  const jobs = [];
  for (const j of (data ?? []) as { id: string; title: string; company: string; skills: string[] | null; years_min: number | null; years_max: number | null; cities: string[] | null; is_remote: boolean }[]) {
    if (!j.skills?.length) continue;
    const k = `${j.company}|${j.title}`.toLowerCase().replace(/\s+/g, " ").trim();
    if (seen.has(k)) continue;
    seen.add(k);
    jobs.push({ id: j.id, title: j.title, skills: j.skills, years_min: j.years_min, years_max: j.years_max, cities: j.cities ?? [], is_remote: j.is_remote });
  }
  return Response.json({ jobs }, { headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400" } });
}
