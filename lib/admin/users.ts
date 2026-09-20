import "server-only";
import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { isSection } from "@/lib/admin/roles";

/**
 * Team logins, stored in the database.
 *
 * The owner is not in here — that account is environment variables, so it
 * still works when the database does not. Everyone else is a row, which is
 * what lets the owner add and remove people from a screen.
 */

export type TeamMember = {
  id: string;
  username: string;
  name: string | null;
  sections: string[];
  isActive: boolean;
  createdAt: string;
  lastLoginAt: string | null;
};

const MISSING = "85_admin_users.sql";
const N = 16384; // scrypt cost. ~50ms here, which is the point.

/* ------------------------------------------------------------- passwords */

function hash(password: string, salt: string): string {
  return scryptSync(password, salt, 64, { N }).toString("hex");
}

function newSalt(): string {
  return randomBytes(16).toString("hex");
}

/**
 * Compare in constant time.
 *
 * Buffers of different lengths would throw from timingSafeEqual, so the
 * length is checked first — and a mismatch still does a compare, so the
 * failure takes the same time whichever way it failed.
 */
function sameHash(a: string, b: string): boolean {
  const ab = Buffer.from(a, "hex");
  const bb = Buffer.from(b, "hex");
  if (ab.length !== bb.length) {
    timingSafeEqual(ab, ab);
    return false;
  }
  return timingSafeEqual(ab, bb);
}

export function cleanUsername(raw: string): string {
  return raw.trim().toLowerCase().replace(/\s+/g, "");
}

/** The rules a password must pass to be set. Shown on the screen, too. */
export function passwordProblem(password: string): string | null {
  if (password.length < 10) return "Use at least 10 characters.";
  if (!/[a-z]/i.test(password) || !/[0-9]/.test(password)) {
    return "Mix letters and numbers.";
  }
  return null;
}

/* ---------------------------------------------------------------- lookup */

/**
 * Check a username and password against the team table.
 *
 * Returns null for every kind of failure — no such user, wrong password,
 * deactivated — so the caller cannot accidentally tell them apart and then
 * accidentally tell the person trying.
 */
export async function verifyTeamLogin(
  username: string,
  password: string,
): Promise<{ id: string; sections: string[] } | null> {
  const db = createAdminClient();
  if (!db) return null;

  const { data, error } = await db
    .from("admin_users")
    .select("id, password_hash, password_salt, sections, is_active")
    .eq("username", cleanUsername(username))
    .maybeSingle();

  if (error || !data) return null;

  const row = data as {
    id: string;
    password_hash: string;
    password_salt: string;
    sections: string[] | null;
    is_active: boolean;
  };

  if (!row.is_active) return null;
  if (!sameHash(hash(password, row.password_salt), row.password_hash)) return null;

  await db
    .from("admin_users")
    .update({ last_login_at: new Date().toISOString() })
    .eq("id", row.id);

  return { id: row.id, sections: (row.sections ?? []).filter(isSection) };
}

/**
 * The live permissions for a signed-in team member.
 *
 * This is the authoritative answer, and the reason it exists at all: the
 * cookie carries a copy of the sections from when they signed in, which is
 * fast but up to twelve hours out of date. Taking a section away, or
 * switching somebody off, has to take effect now rather than tomorrow — so
 * every page render and every write re-reads this.
 *
 * Null means the account is gone or switched off, and the caller signs them
 * out.
 */
export async function liveSections(id: string): Promise<string[] | null> {
  const db = createAdminClient();
  if (!db) return null;

  const { data, error } = await db
    .from("admin_users")
    .select("sections, is_active")
    .eq("id", id)
    .maybeSingle();

  if (error || !data) return null;
  const row = data as { sections: string[] | null; is_active: boolean };
  if (!row.is_active) return null;

  return (row.sections ?? []).filter(isSection);
}

/* ----------------------------------------------------------------- admin */

export async function listTeam(): Promise<
  { ok: true; data: TeamMember[] } | { ok: false; missing: string }
> {
  const db = createAdminClient();
  if (!db) return { ok: false, missing: MISSING };

  const { data, error } = await db
    .from("admin_users")
    .select("id, username, name, sections, is_active, created_at, last_login_at")
    .order("created_at", { ascending: true });

  if (error) return { ok: false, missing: MISSING };

  return {
    ok: true,
    data: ((data ?? []) as Record<string, unknown>[]).map((r) => ({
      id: String(r.id),
      username: String(r.username ?? ""),
      name: (r.name as string | null) ?? null,
      sections: ((r.sections as string[] | null) ?? []).filter(isSection),
      isActive: Boolean(r.is_active),
      createdAt: String(r.created_at ?? ""),
      lastLoginAt: (r.last_login_at as string | null) ?? null,
    })),
  };
}

export async function createMember(opts: {
  username: string;
  name: string | null;
  password: string;
  sections: string[];
}): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const db = createAdminClient();
  if (!db) return { ok: false, error: `Run supabase/schemas/${MISSING} first.` };

  const username = cleanUsername(opts.username);
  if (username.length < 3) return { ok: false, error: "That username is too short." };

  const problem = passwordProblem(opts.password);
  if (problem) return { ok: false, error: problem };

  // The owner's own username must stay unique across both systems, or a team
  // row could shadow it at the login screen.
  if (username === cleanUsername(process.env.ADMIN_USERNAME ?? "")) {
    return { ok: false, error: "That is your own username." };
  }

  const salt = newSalt();

  const { data, error } = await db
    .from("admin_users")
    .insert({
      username,
      name: opts.name?.trim() || null,
      password_hash: hash(opts.password, salt),
      password_salt: salt,
      sections: opts.sections.filter(isSection),
    })
    .select("id")
    .single();

  if (error) {
    const taken = /duplicate key|unique/i.test(error.message);
    return { ok: false, error: taken ? "That username is taken." : error.message };
  }

  return { ok: true, id: (data as { id: string }).id };
}

export async function updateMember(
  id: string,
  patch: { sections?: string[]; isActive?: boolean; name?: string | null; password?: string },
): Promise<{ ok: true } | { ok: false; error: string }> {
  const db = createAdminClient();
  if (!db) return { ok: false, error: "Not configured." };

  const fields: Record<string, unknown> = {};
  if (patch.sections) fields.sections = patch.sections.filter(isSection);
  if (typeof patch.isActive === "boolean") fields.is_active = patch.isActive;
  if (patch.name !== undefined) fields.name = patch.name?.trim() || null;

  if (patch.password) {
    const problem = passwordProblem(patch.password);
    if (problem) return { ok: false, error: problem };
    const salt = newSalt();
    fields.password_salt = salt;
    fields.password_hash = hash(patch.password, salt);
  }

  if (Object.keys(fields).length === 0) return { ok: true };

  const { error } = await db.from("admin_users").update(fields).eq("id", id);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function deleteMember(id: string): Promise<boolean> {
  const db = createAdminClient();
  if (!db) return false;
  const { error } = await db.from("admin_users").delete().eq("id", id);
  return !error;
}

/** A password worth suggesting: long, random, and readable down a phone. */
export function suggestPassword(): string {
  const alphabet = "abcdefghijkmnopqrstuvwxyz23456789";
  const bytes = randomBytes(18);
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
}
