import "server-only";
import { llmJson } from "@/lib/app/llm";
import { CANONICAL_CITIES } from "@/lib/geo/cities";

/**
 * Turn one typed sentence into the fields matching needs.
 *
 * This is the text rehearsal of the voice agent. Somebody who types "backend
 * roles in Bangalore or remote, around 18 LPA, 60 days notice" has just given
 * us five columns, and asking them to fill five form fields instead is how you
 * lose them on the first screen. The voice agent will do exactly this later
 * from speech; keeping the extraction in one module means it will not be
 * written twice and drift.
 *
 * The model's answer is advisory. Nothing here is written to the profile until
 * it has been clamped, and anything the sentence did not mention comes back
 * null so an existing value is never overwritten by a guess.
 */

/**
 * An override for this one call, if you want intent reading on a different
 * model from the conversation. Unset is the normal case: whichever provider
 * is configured picks its own model.
 */
const MODEL = process.env.INTENT_MODEL ?? process.env.GEMINI_INTENT_MODEL ?? null;

/** Long enough for a rambling sentence, short enough that nobody pastes a resume in. */
const MAX_CHARS = 600;


export type Intent = {
  target_roles: string[];
  preferred_cities: string[];
  open_to_remote: boolean | null;
  expected_ctc: number | null;
  notice_period_days: number | null;
  years_experience: number | null;
  /** What the model thinks it heard, for the confirmation line. */
  echo: string | null;
};

const SCHEMA = {
  type: "object",
  properties: {
    target_roles: { type: "array", items: { type: "string" } },
    preferred_cities: { type: "array", items: { type: "string" } },
    open_to_remote: { type: "boolean", nullable: true },
    expected_ctc: { type: "number", nullable: true },
    notice_period_days: { type: "number", nullable: true },
    years_experience: { type: "number", nullable: true },
    echo: { type: "string", nullable: true },
  },
} as const;

const INSTRUCTIONS = `You read one sentence from an Indian job seeker and pull out what they want.

Only record what the sentence actually says. If something is not mentioned, return null for it
or an empty array. Never infer, never fill gaps, never be helpful by guessing — a wrong value
here silently removes jobs from someone's results.

target_roles: job titles as they are advertised in India. Expand shorthand ("SDE" ->
"Software Development Engineer", "BE" -> "Backend Engineer", "PM" -> "Product Manager").
At most 5, most wanted first. A field ("design", "marketing") is not a role — turn it into
the obvious title only if the sentence makes the level clear, otherwise leave it out.

preferred_cities: map to exactly one of these spellings, and drop anything that does not map:
${CANONICAL_CITIES.join(", ")}.
Bangalore/Blr -> Bengaluru. Delhi, NCR, New Delhi, Faridabad, Ghaziabad -> Delhi NCR.
Bombay -> Mumbai. Calcutta -> Kolkata. Madras -> Chennai.
"Anywhere" or "any location" is not a city — return an empty array.

open_to_remote: true only if remote, WFH or work-from-home is asked for. false only if the
sentence rules it out ("only office", "no remote"). Otherwise null.

expected_ctc: rupees per year as a plain number. "18 LPA" and "18 lakhs" -> 1800000.
"1.2 crore" -> 12000000. "50k per month" -> 600000. Never a range: take the lower number.

notice_period_days: "2 months" -> 60, "immediate" or "immediately available" -> 0,
"serving notice" with no length -> null.

years_experience: total full-time experience in years, one decimal. "fresher" -> 0.

echo: one short clause, under 12 words, in plain English, saying what you understood.
No greeting, no punctuation at the end. Example: "backend roles in Bengaluru, open to remote".
If the sentence contained nothing usable, return null.`;

type Ok = { ok: true; intent: Intent };
type Fail = { ok: false; error: string };

export async function readIntent(sentence: string): Promise<Ok | Fail> {
  const clean = sentence.trim().slice(0, MAX_CHARS);
  if (clean.length < 3) return { ok: false, error: "Tell me a little more than that." };

  const result = await llmJson({
    system: INSTRUCTIONS,
    user: clean,
    schema: SCHEMA,
    name: "job_intent",
    pin: MODEL,
    temperature: 0,
    // The answer is six short fields. A cap keeps a runaway generation from
    // becoming a bill.
    maxTokens: 400,
    // Someone is watching a cursor blink. Fifteen seconds is already long.
    timeoutMs: 15_000,
  });

  if (!result.ok) return { ok: false, error: result.error };
  return { ok: true, intent: coerce(result.data) };
}

/* ----------------------------------------------------------------- shaping */

const text = (v: unknown, max: number): string | null => {
  if (typeof v !== "string") return null;
  const s = v.trim();
  return s && s.toLowerCase() !== "null" ? s.slice(0, max) : null;
};

const bool = (v: unknown): boolean | null => (typeof v === "boolean" ? v : null);

/**
 * Numbers get bounds, not just types. A model that reads "18 LPA" as 18 would
 * otherwise store an expected salary of eighteen rupees, and every job would
 * look affordable.
 */
const bounded = (v: unknown, min: number, max: number, dp = 0): number | null => {
  if (typeof v !== "number" || !Number.isFinite(v)) return null;
  if (v < min || v > max) return null;
  const f = 10 ** dp;
  return Math.round(v * f) / f;
};

function coerce(input: unknown): Intent {
  const d = (input ?? {}) as Record<string, unknown>;

  const roles: string[] = [];
  const seen = new Set<string>();
  for (const item of Array.isArray(d.target_roles) ? d.target_roles : []) {
    const s = text(item, 60);
    if (!s || s.length < 2) continue;
    const k = s.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    roles.push(s);
    if (roles.length >= 5) break;
  }

  // Membership, not trust: whatever the model returns, only a city we can
  // actually match against survives.
  const cities: string[] = [];
  for (const item of Array.isArray(d.preferred_cities) ? d.preferred_cities : []) {
    const s = text(item, 40);
    if (!s) continue;
    const hit = CANONICAL_CITIES.find((c) => c.toLowerCase() === s.toLowerCase());
    if (hit && !cities.includes(hit)) cities.push(hit);
  }

  return {
    target_roles: roles,
    preferred_cities: cities,
    open_to_remote: bool(d.open_to_remote),
    // ₹60k to ₹20 crore. Outside that, the sentence was misread.
    expected_ctc: bounded(d.expected_ctc, 60_000, 200_000_000),
    notice_period_days: bounded(d.notice_period_days, 0, 365),
    years_experience: bounded(d.years_experience, 0, 50, 1),
    echo: text(d.echo, 90),
  };
}

/** Did the sentence actually contain anything worth saving? */
export function isEmpty(i: Intent): boolean {
  return (
    i.target_roles.length === 0 &&
    i.preferred_cities.length === 0 &&
    i.open_to_remote === null &&
    i.expected_ctc === null &&
    i.notice_period_days === null &&
    i.years_experience === null
  );
}
