import { getSessionUser, createAppAdminClient } from "@/lib/supabase/app";
import { checkRole } from "@/lib/app/role-check";

export const dynamic = "force-dynamic";

/**
 * Set the role mock interviews are pitched at.
 *
 * Writes `profiles.interview_role` and nothing else — deliberately not
 * target_roles, which drives the job feed. Practising for a role somebody is
 * curious about should not silently re-point the jobs they are shown.
 */
export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return Response.json({ ok: false, error: "Sign in first." }, { status: 401 });

  let body: { role?: string; years?: number | null };
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, error: "Could not read that." }, { status: 400 });
  }

  const role = (body.role ?? "").trim().replace(/\s+/g, " ").slice(0, 60);
  if (role.length < 2) {
    return Response.json({ ok: false, error: "Which role?" }, { status: 400 });
  }

  /**
   * Shape, blocklist, then the model. See lib/app/role-check.ts.
   *
   * On the server rather than only in the box: this string becomes part of
   * the prompt that writes four questions and a model answer, so a crafted
   * POST would put it there whatever the screen refused.
   */
  const verdict = await checkRole(role, user.id);
  if (!verdict.ok) {
    return Response.json({ ok: false, error: verdict.error, blocked: true }, { status: 422 });
  }

  const db = createAppAdminClient();
  if (!db) return Response.json({ ok: false, error: "Not configured." }, { status: 503 });

  /**
   * Experience goes to `years_experience`, the column that already exists,
   * rather than a second one beside it.
   *
   * That is the opposite of the decision made for the role, and for the same
   * reason: how many years somebody has worked is a fact about them, true
   * everywhere in the product, so two copies of it would be two copies to
   * disagree. Which role they are *practising* is a preference local to this
   * screen, which is why that one is separate from target_roles.
   */
  const patch: Record<string, unknown> = { interview_role: role };
  if (typeof body.years === "number" && Number.isFinite(body.years)) {
    patch.years_experience = Math.max(0, Math.min(40, Math.round(body.years)));
  }

  // .select() so a write that matched no row is distinguishable from one
  // that worked. Without it a missing profile returned ok, the screen
  // refreshed, and the picker came back with no explanation.
  const { data, error } = await db
    .from("profiles")
    .update(patch)
    .eq("id", user.id)
    .select("id")
    .maybeSingle();

  if (error) {
    const absent = /column .*interview_role.* does not exist/i.test(error.message);
    return Response.json(
      {
        ok: false,
        error: absent
          ? "Run supabase/schemas/82_interview_role.sql first."
          : "Could not save that.",
      },
      { status: 502 },
    );
  }

  if (!data) {
    return Response.json(
      { ok: false, error: "Your profile could not be found. Reload the page and try again." },
      { status: 404 },
    );
  }

  return Response.json({ ok: true, role });
}
