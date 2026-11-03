import "server-only";
import { createHash } from "node:crypto";
import { createAppAdminClient } from "@/lib/supabase/app";

/**
 * Who may see an ATS score right now (119_ats_checks.sql).
 *
 *   paid     Pro, the owner, or the ₹49 ATS unlock: every check, always
 *   repeat   the same resume text already checked today: same result again
 *   free     nothing checked today by this person: today's free check
 *   locked   anything else: the score stays on the server
 *
 * "This person" is any of their account, the browser's visitor id, the
 * first-party device cookie, or the email / phone in the resume. Matching on
 * any one of them means clearing site data, or uploading a friend's resume
 * from the same browser, does not hand out a second free check. The IP is
 * deliberately not used: Indian mobile networks put thousands of people
 * behind one address, and a first-time visitor must never find their free
 * check already spent.
 */

export type Outcome = "free" | "repeat" | "paid" | "locked";

export type Who = {
  userId: string | null;
  visitor: string | null;
  device: string | null;
  email: string | null;
  phone: string | null;
};

export const hashText = (text: string) =>
  createHash("sha256").update(text.replace(/\s+/g, " ").trim().toLowerCase()).digest("hex");

/** Midnight in India, as a UTC timestamp — the free check renews then. */
export function istDayStart(now = new Date()): string {
  const IST = 5.5 * 3600_000;
  const local = new Date(now.getTime() + IST);
  local.setUTCHours(0, 0, 0, 0);
  return new Date(local.getTime() - IST).toISOString();
}

/** Today's checks by anybody who is this person, newest first. */
async function todaysChecks(who: Who): Promise<{ text_hash: string; outcome: Outcome }[]> {
  const db = createAppAdminClient();
  if (!db) return [];
  const ors: string[] = [];
  const q = (v: string) => `"${v.replace(/"/g, "")}"`;
  if (who.userId) ors.push(`user_id.eq.${who.userId}`);
  if (who.visitor) ors.push(`visitor.eq.${q(who.visitor)}`);
  if (who.device) ors.push(`device.eq.${q(who.device)}`);
  if (who.email) ors.push(`email.eq.${q(who.email)}`);
  if (who.phone) ors.push(`phone.eq.${q(who.phone)}`);
  if (!ors.length) return [];
  const { data } = await db
    .from("ats_checks")
    .select("text_hash,outcome")
    .gte("created_at", istDayStart())
    .neq("outcome", "locked")
    .or(ors.join(","))
    .order("created_at", { ascending: false })
    .limit(50);
  return (data ?? []) as { text_hash: string; outcome: Outcome }[];
}

export async function decide(who: Who, textHash: string, unlimited: boolean): Promise<Outcome> {
  if (unlimited) return "paid";
  const today = await todaysChecks(who);
  if (today.length === 0) return "free";
  if (today.some((c) => c.text_hash === textHash)) return "repeat";
  return "locked";
}

export async function record(who: Who, textHash: string, outcome: Outcome, score: number | null): Promise<void> {
  const db = createAppAdminClient();
  if (!db) return;
  await db.from("ats_checks").insert({
    user_id: who.userId,
    visitor: who.visitor,
    device: who.device,
    email: who.email,
    phone: who.phone,
    text_hash: textHash,
    score,
    outcome,
  });
}
