import { redirect } from "next/navigation";
import { currentAdmin } from "@/lib/admin/guard";
import { listTeam } from "@/lib/admin/users";
import { getTeamActivity } from "@/lib/admin/activity";
import { SECTIONS } from "@/lib/admin/roles";
import { TeamManager } from "@/components/admin/TeamManager";

export const dynamic = "force-dynamic";

/**
 * Who else can get in.
 *
 * Owner only, checked here as well as in the proxy — this is the screen that
 * hands out every other permission, so it is worth two locks.
 */
export default async function AdminTeam() {
  const session = await currentAdmin();
  if (!session) redirect("/admin-login");
  if (session.role !== "owner") redirect("/admin");

  const [result, activity] = await Promise.all([listTeam(), getTeamActivity()]);

  if (!result.ok) {
    return (
      <p className="rounded-xl border border-ink-15 px-4 py-3 text-[0.82rem] text-ink-50">
        Not set up yet — run <code>supabase/schemas/{result.missing}</code> in
        the Supabase SQL editor.
      </p>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-[1.3rem] font-semibold tracking-[-0.03em]">Team</h1>
      </div>

      <TeamManager team={result.data} sections={[...SECTIONS]} activity={activity} />
    </div>
  );
}
