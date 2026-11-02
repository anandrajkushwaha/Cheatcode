import { requireAdmin } from "@/lib/admin/guard";
import { getLive } from "@/lib/admin/live";

export const dynamic = "force-dynamic";

/** Visits active in the last few minutes, for the live count on Journeys. */
export async function GET() {
  const guard = await requireAdmin("dashboard");
  if (!guard.ok) return guard.response;
  const live = await getLive();
  return Response.json(live, { status: live.ok ? 200 : 500, headers: { "Cache-Control": "no-store" } });
}
