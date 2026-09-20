import "server-only";
import { cookies } from "next/headers";
import { ADMIN_COOKIE, readSession, type AdminSession } from "@/lib/admin/auth";
import { hasSection } from "@/lib/admin/roles";
import { liveSections } from "@/lib/admin/users";

/**
 * The check every admin API route and page starts with.
 *
 * Two passes, and the second is the one that matters. The cookie is checked
 * first because it is free; then, for a team member, the database is asked
 * what they may do *now*. The cookie's copy was written when they signed in
 * and can be twelve hours old, so without the second pass removing somebody's
 * access would not take effect until tomorrow — which is not what anybody
 * means by removing somebody's access.
 *
 * The owner skips the lookup: that account is environment variables and has
 * no row to read.
 */
export async function currentAdmin(): Promise<AdminSession | null> {
  const store = await cookies();
  const session = readSession(store.get(ADMIN_COOKIE)?.value);
  if (!session) return null;

  if (session.role === "owner") return session;

  // A team token with no row id is malformed; treat it as signed out.
  if (!session.uid) return null;

  const live = await liveSections(session.uid);
  if (live === null) return null; // deleted, or switched off

  return { ...session, sections: live };
}

/**
 * Require a named section. Returns the session, or a Response to return.
 *
 * Shaped this way rather than as a boolean so a route cannot carry on after a
 * failed check by accident — the only way past is to hold the session, and
 * the only way to hold it is to have passed.
 */
export async function requireAdmin(
  section?: string,
): Promise<{ ok: true; session: AdminSession } | { ok: false; response: Response }> {
  const session = await currentAdmin();

  if (!session) {
    return {
      ok: false,
      response: Response.json({ ok: false, error: "Not signed in" }, { status: 401 }),
    };
  }

  // No section named means owner-only. That is the default on purpose: a new
  // route that forgets to say anything is closed, not open.
  if (!section) {
    if (session.role !== "owner") {
      return {
        ok: false,
        response: Response.json(
          { ok: false, error: "Only the owner can do that." },
          { status: 403 },
        ),
      };
    }
    return { ok: true, session };
  }

  if (!hasSection(session.role, session.sections, section)) {
    // 403 rather than 404: they are signed in and this endpoint is real.
    // Pretending otherwise would leave somebody debugging a typo for an hour.
    return {
      ok: false,
      response: Response.json(
        { ok: false, error: "Your account does not have access to that." },
        { status: 403 },
      ),
    };
  }

  return { ok: true, session };
}
