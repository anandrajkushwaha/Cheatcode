import { getSessionUser, createAppAdminClient } from "@/lib/supabase/app";

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

  let body: { role?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, error: "Could not read that." }, { status: 400 });
  }

  const role = (body.role ?? "").trim().replace(/\s+/g, " ").slice(0, 60);
  if (role.length < 2) {
    return Response.json({ ok: false, error: "Which role?" }, { status: 400 });
  }

  const db = createAppAdminClient();
  if (!db) return Response.json({ ok: false, error: "Not configured." }, { status: 503 });

  const { error } = await db.from("profiles").update({ interview_role: role }).eq("id", user.id);

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

  return Response.json({ ok: true, role });
}
