import { createAppServerClient, getSessionUser } from "@/lib/supabase/app";
import { readIntent, isEmpty, type Intent } from "@/lib/app/intent";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const bad = (error: string, status = 400) => Response.json({ ok: false, error }, { status });

/**
 * Best-effort throttle.
 *
 * Every call here costs money, and the button is one keystroke away from being
 * held down. This map lives in one server instance, so it will not stop a
 * determined person across regions — it stops the ordinary case, which is a
 * user or a loop hammering the same box. A real limit belongs in the database
 * once there is traffic worth counting.
 */
const lastCall = new Map<string, number>();
const MIN_GAP_MS = 2_500;

function tooSoon(userId: string): boolean {
  const now = Date.now();
  const prev = lastCall.get(userId);
  if (prev && now - prev < MIN_GAP_MS) return true;
  lastCall.set(userId, now);
  // Keep the map from growing forever on a long-lived instance.
  if (lastCall.size > 5_000) {
    for (const [k, t] of lastCall) if (now - t > 60_000) lastCall.delete(k);
  }
  return false;
}

/**
 * One sentence in, a saved profile out.
 *
 * Merging rather than replacing, on purpose. Somebody who types "also open to
 * Pune" a week later should end up with two cities, not one — and a model that
 * fails to mention a field must never be able to erase it. Only what the
 * sentence explicitly contained is written.
 */
export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return bad("Not signed in", 401);
  if (tooSoon(user.id)) return bad("One at a time — try again in a moment.", 429);

  const supabase = await createAppServerClient();
  if (!supabase) return bad("Accounts aren't configured on this deployment.", 503);

  let sentence = "";
  try {
    const body = (await request.json()) as { text?: unknown };
    sentence = typeof body.text === "string" ? body.text : "";
  } catch {
    return bad("Could not read that request.");
  }
  if (sentence.trim().length < 3) return bad("Tell me a little more than that.");

  const result = await readIntent(sentence);
  if (!result.ok) return bad(result.error, 502);

  const intent = result.intent;
  if (isEmpty(intent)) {
    return Response.json({
      ok: true,
      saved: {},
      echo: null,
      note: "I couldn't find a role, city or number in that. Try naming the job you want.",
    });
  }

  const { data: current } = await supabase
    .from("profiles")
    .select("target_roles,preferred_cities,onboarded_at")
    .eq("id", user.id)
    .maybeSingle();

  const patch = buildPatch(intent, {
    target_roles: (current?.target_roles as string[]) ?? [],
    preferred_cities: (current?.preferred_cities as string[]) ?? [],
  });

  if (!current?.onboarded_at) patch.onboarded_at = new Date().toISOString();

  const { error } = await supabase.from("profiles").update(patch).eq("id", user.id);
  if (error) return bad(error.message, 500);

  return Response.json({ ok: true, saved: patch, echo: intent.echo });
}

type Patch = {
  target_roles?: string[];
  preferred_cities?: string[];
  open_to_remote?: boolean;
  expected_ctc?: number;
  notice_period_days?: number;
  years_experience?: number;
  onboarded_at?: string;
};

/** Union for lists, overwrite for scalars, absent for anything unmentioned. */
function buildPatch(
  intent: Intent,
  current: { target_roles: string[]; preferred_cities: string[] },
): Patch {
  const patch: Patch = {};

  if (intent.target_roles.length) {
    patch.target_roles = union(current.target_roles, intent.target_roles, 10);
  }
  if (intent.preferred_cities.length) {
    patch.preferred_cities = union(current.preferred_cities, intent.preferred_cities, 12);
  }
  if (intent.open_to_remote !== null) patch.open_to_remote = intent.open_to_remote;
  if (intent.expected_ctc !== null) patch.expected_ctc = intent.expected_ctc;
  if (intent.notice_period_days !== null) patch.notice_period_days = intent.notice_period_days;
  if (intent.years_experience !== null) patch.years_experience = intent.years_experience;

  return patch;
}

function union(existing: string[], incoming: string[], cap: number): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  // Incoming first: the thing just said is the thing most on their mind.
  for (const v of [...incoming, ...existing]) {
    const k = v.trim().toLowerCase();
    if (!k || seen.has(k)) continue;
    seen.add(k);
    out.push(v.trim());
    if (out.length >= cap) break;
  }
  return out;
}
