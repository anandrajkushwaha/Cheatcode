import { requireAdmin } from "@/lib/admin/guard";
import {
  createMember,
  updateMember,
  deleteMember,
  suggestPassword,
} from "@/lib/admin/users";
import { isSection } from "@/lib/admin/roles";

export const dynamic = "force-dynamic";

/**
 * Adding and removing people.
 *
 * Owner only — `requireAdmin()` with no section is owner-only by default, and
 * "team" is deliberately not a grantable section. Somebody who could edit the
 * team could grant themselves everything else, which would make every other
 * permission on this site decorative.
 */

const bad = (error: string, status = 400) => Response.json({ ok: false, error }, { status });

type Body = {
  action?: "create" | "update" | "delete" | "suggest";
  id?: string;
  username?: string;
  name?: string;
  password?: string;
  sections?: string[];
  isActive?: boolean;
};

export async function POST(request: Request) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return bad("Could not read that request.");
  }

  const sections = (body.sections ?? []).filter((s) => typeof s === "string" && isSection(s));

  switch (body.action) {
    case "suggest":
      return Response.json({ ok: true, password: suggestPassword() });

    case "create": {
      const created = await createMember({
        username: body.username ?? "",
        name: body.name ?? null,
        password: body.password ?? "",
        sections,
      });
      if (!created.ok) return bad(created.error, 400);
      return Response.json({ ok: true, id: created.id });
    }

    case "update": {
      if (!body.id) return bad("Which person?");
      const updated = await updateMember(body.id, {
        sections: body.sections ? sections : undefined,
        isActive: body.isActive,
        name: body.name,
        password: body.password || undefined,
      });
      if (!updated.ok) return bad(updated.error, 400);
      return Response.json({ ok: true });
    }

    case "delete": {
      if (!body.id) return bad("Which person?");
      const gone = await deleteMember(body.id);
      if (!gone) return bad("Could not remove them.", 502);
      return Response.json({ ok: true });
    }

    default:
      return bad("Unknown action.");
  }
}
