import { getSessionUser } from "@/lib/supabase/app";
import { getProfile } from "@/lib/app/account";
import { jobsByIds } from "@/lib/jobs/matching";
import { accessFor, canSee } from "@/lib/jobs/unlocks";

export const dynamic = "force-dynamic";

/**
 * The popup's jobs, opened or not — for the ATS checker's popup, whose jobs
 * were matched in the browser. A job the person has unlocked (or that a pass
 * or Pro covers) comes back with its company and link; the rest without.
 * 401 when signed out, which is how the popup learns it must sign them in.
 */
export async function GET(request: Request) {
  const user = await getSessionUser();
  if (!user) return Response.json({ ok: false }, { status: 401 });
  const ids = (new URL(request.url).searchParams.get("ids") ?? "")
    .split(",")
    .filter((id) => /^[0-9a-f-]{36}$/i.test(id))
    .slice(0, 20);
  const [jobs, profile] = await Promise.all([jobsByIds(ids), getProfile()]);
  const access = await accessFor(user.id, user.email ?? null, profile);
  return Response.json({
    ok: true,
    all: access.all,
    passUntil: access.passUntil,
    jobs: jobs.map((j) => {
      const open = canSee(access, j.id);
      return { id: j.id, locked: !open, company: open ? j.company : null, applyUrl: open ? j.apply_url : null };
    }),
  });
}
