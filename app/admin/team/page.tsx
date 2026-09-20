import { redirect } from "next/navigation";
import { currentAdmin } from "@/lib/admin/guard";
import { listTeam } from "@/lib/admin/users";
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

  const result = await listTeam();

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
        <p className="mt-2 max-w-[70ch] text-[0.85rem] leading-relaxed text-ink-50">
          Make a login for somebody, tick what they can reach, and send them
          the username and password. They sign in at the same page you do and
          see only what you ticked — everything else is not just hidden, it is
          refused.
        </p>
        <p className="mt-2 max-w-[70ch] text-[0.85rem] leading-relaxed text-ink-50">
          Settings is not on the list. It assigns AI models and spending
          limits, so it stays with you.
        </p>
      </div>

      <TeamManager team={result.data} sections={[...SECTIONS]} />
    </div>
  );
}
