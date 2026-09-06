import "server-only";
import { createAppAdminClient } from "@/lib/supabase/app";
import { FEATURES, setRateOverrides, type Feature, type Rate } from "@/lib/app/ai-cost";

/**
 * Configuration that changes without a deploy.
 *
 * The whole point of a settings screen is that a switch in it does something.
 * A flag that only the settings screen reads is a lie with a toggle on it, so
 * the rule here is: nothing gets a flag until the code that would obey it is
 * written. Right now that is exactly one thing — which provider and model each
 * agentic feature uses — and it is read by `provider()` and `modelFor()` in
 * llm.ts, on the real path, on every call.
 *
 * ------------------------------------------------------------- the cache
 *
 * `provider()` is synchronous and is called inside the request path of every
 * model call. Making it async to read a row would ripple through every caller
 * and add a database round trip to each answer, to look up a value that
 * changes a few times a year.
 *
 * So flags are cached in the process for half a minute and refreshed in the
 * background when they go stale. The honest consequence, which the settings
 * screen says out loud: **a change takes up to thirty seconds to take effect**,
 * and on serverless each cold container fetches once. That is the trade — a
 * saved change is not instant, and no agent call pays for a lookup.
 *
 * When the table is missing or unreachable, everything falls back to the
 * environment variables that governed this before there was a settings screen.
 * A database problem must not take the agent down with it.
 */

/* ------------------------------------------------------------- the shape */

/** What one agentic feature is configured to run on. */
export type FeatureConfig = {
  /** Off means the feature refuses rather than falling back to another model. */
  enabled: boolean;
  /** Null means "whatever the environment says", which is the default. */
  provider: "openai" | "gemini" | "sarvam" | null;
  /** Null means the provider's own preferred model. */
  model: string | null;
};

export type Flags = {
  /** Keyed by the same feature names ai_usage groups spend by. */
  agent: Record<Feature, FeatureConfig>;
  /**
   * Corrections to the rate table, keyed by model name.
   *
   * Here rather than in code because a price is the one piece of configuration
   * that is *guaranteed* to change without anybody on this side noticing, and
   * because being wrong about it is silent: the dashboard keeps producing a
   * confident number. Twice now that number has been badly wrong for weeks.
   * A field on a screen closes that gap in the time it takes to read the
   * provider's pricing page.
   */
  rates: Record<string, Rate>;
};

const DEFAULT_CONFIG: FeatureConfig = { enabled: true, provider: null, model: null };

export function defaultFlags(): Flags {
  const agent = {} as Record<Feature, FeatureConfig>;
  for (const f of FEATURES) agent[f] = { ...DEFAULT_CONFIG };
  return { agent, rates: {} };
}

/* -------------------------------------------------------------- the gate */

const PROVIDERS = ["openai", "gemini", "sarvam"] as const;

/**
 * Rebuilt rather than validated, like every other blob in this codebase.
 *
 * These rows are written by a screen behind an admin cookie, which is a much
 * smaller threat than the open internet — but the values end up in a URL and
 * a request body sent to a paid API, and "the admin panel is trusted" is how a
 * typo becomes an outage nobody can explain.
 */
export function cleanFlags(raw: unknown): Flags {
  const out = defaultFlags();
  const rows = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const agent = rows.agent && typeof rows.agent === "object" ? (rows.agent as Record<string, unknown>) : {};

  for (const f of FEATURES) {
    const r = agent[f];
    if (!r || typeof r !== "object") continue;
    const row = r as Record<string, unknown>;
    out.agent[f] = {
      enabled: row.enabled !== false,
      provider: PROVIDERS.includes(row.provider as never) ? (row.provider as FeatureConfig["provider"]) : null,
      model: typeof row.model === "string" && row.model.trim() && row.model.length < 120
        ? row.model.trim()
        : null,
    };
  }

  out.rates = cleanRates(rows.rates);
  return out;
}

/** How many model names a deployment may carry a corrected price for. */
const MAX_RATES = 200;

/**
 * Money, rebuilt field by field.
 *
 * Every number here is multiplied by a token count and written into a column
 * people make decisions from, so the gate is deliberately unforgiving: finite,
 * non-negative, and small enough that a mistyped price cannot produce a
 * dashboard figure so large it hides everything else. A negative rate would be
 * a credit, which no provider offers and which would quietly cancel out real
 * spend elsewhere in the same sum.
 */
export function cleanRates(raw: unknown): Record<string, Rate> {
  const out: Record<string, Rate> = {};
  if (!raw || typeof raw !== "object") return out;

  const money = (v: unknown): number | undefined =>
    typeof v === "number" && Number.isFinite(v) && v >= 0 && v <= 100_000
      ? Math.round(v * 1e6) / 1e6
      : undefined;

  for (const [name, value] of Object.entries(raw as Record<string, unknown>)) {
    if (Object.keys(out).length >= MAX_RATES) break;
    // Names are compared lower-cased because `rateFor` looks them up that way;
    // checking the raw name here would let "GPT-X" and "gpt-x" both through and
    // leave which one wins down to object key order.
    const model = name.trim().toLowerCase();
    if (!model || model.length > 120 || out[model] || !value || typeof value !== "object") continue;

    const r = value as Record<string, unknown>;
    const rate: Rate = {
      ...(money(r.input) !== undefined ? { input: money(r.input) } : {}),
      ...(money(r.output) !== undefined ? { output: money(r.output) } : {}),
      ...(money(r.audioInput) !== undefined ? { audioInput: money(r.audioInput) } : {}),
      ...(money(r.audioOutput) !== undefined ? { audioOutput: money(r.audioOutput) } : {}),
      ...(money(r.perMinute) !== undefined ? { perMinute: money(r.perMinute) } : {}),
      currency: r.currency === "INR" ? "INR" : "USD",
    };

    // A row with a currency and no numbers prices nothing; keeping it would
    // shadow the code table's rate with an empty one.
    const priced =
      rate.input !== undefined ||
      rate.output !== undefined ||
      rate.audioInput !== undefined ||
      rate.audioOutput !== undefined ||
      rate.perMinute !== undefined;
    if (priced) out[model] = rate;
  }
  return out;
}

/* ------------------------------------------------------------ the cache */

/**
 * Five seconds, not thirty.
 *
 * Thirty was chosen when the only thing behind this was "which model", where a
 * slow rollout is merely untidy. It is the wrong number for a screen somebody
 * uses to move traffic off a model that is misbehaving right now, and it made
 * "did that save work?" a question you had to wait out.
 *
 * The cost of five is one indexed single-row read per container per five
 * seconds, and only when something is actually being served — `flags()` never
 * blocks on it and never triggers it on an idle process. At this product's
 * volume that is not a number worth optimising against being able to trust the
 * Save button.
 */
const TTL_MS = 5_000;
const KEY = "agent_models";

let cached: Flags = defaultFlags();
let loadedAt = 0;
let inFlight: Promise<void> | null = null;
let warned = false;

async function load(): Promise<void> {
  const supabase = createAppAdminClient();
  if (!supabase) {
    if (!warned) {
      warned = true;
      console.warn("flags: no service key, so the environment is the only configuration.");
    }
    loadedAt = Date.now();
    return;
  }

  const { data, error } = await supabase
    .from("feature_flags")
    .select("value,enabled")
    .eq("key", KEY)
    .limit(1);

  // A missing table means 61_admin_tracking.sql has not been run. That is a
  // deployment that has no settings screen yet, not a broken one.
  if (error) {
    if (!warned) {
      warned = true;
      console.warn("flags: could not read feature_flags —", error.message.slice(0, 120));
    }
    loadedAt = Date.now();
    return;
  }

  const row = (data ?? [])[0] as { value?: unknown; enabled?: boolean } | undefined;
  // The row's own `enabled` is the master switch for the whole group: off, and
  // every feature goes back to environment configuration rather than to off.
  apply(row && row.enabled !== false ? cleanFlags(row.value) : defaultFlags());
}

/**
 * Make a set of flags the live ones, everywhere they are read from.
 *
 * The corrected rates have to be handed to `ai-cost.ts` explicitly because
 * that module has no database import — it is on the client side of the build
 * as well — so this is the one seam that keeps the price table current.
 */
function apply(next: Flags): void {
  cached = next;
  loadedAt = Date.now();
  setRateOverrides(next.rates);
}

/**
 * The flags, right now, without waiting.
 *
 * Returns whatever was last loaded and kicks off a refresh if that is stale.
 * The first call in a cold process gets the defaults — which are "follow the
 * environment", the behaviour that existed before this file — and the call
 * after it gets the real values.
 */
export function flags(): Flags {
  if (Date.now() - loadedAt > TTL_MS && !inFlight) {
    inFlight = load()
      .catch(() => {})
      .finally(() => {
        inFlight = null;
      });
  }
  return cached;
}

/** The flags, having waited for them. For screens, not for the request path. */
export async function flagsNow(): Promise<Flags> {
  await load();
  return cached;
}

/** What one feature is configured to do. Never throws, never blocks. */
export function configFor(feature: Feature): FeatureConfig {
  return flags().agent[feature] ?? DEFAULT_CONFIG;
}

/* -------------------------------------------------------------- writing */

export async function saveFlags(next: Flags, note?: string): Promise<void> {
  const supabase = createAppAdminClient();
  if (!supabase) throw new Error("No service key, so settings cannot be saved.");

  const { error } = await supabase.from("feature_flags").upsert(
    {
      key: KEY,
      enabled: true,
      value: cleanFlags(next),
      updated_at: new Date().toISOString(),
      note: note?.slice(0, 500) ?? null,
    },
    { onConflict: "key" },
  );

  if (error) throw new Error(error.message);

  // Take effect in *this* process immediately. The other containers pick it
  // up when their own cache expires, which is what the screen tells the
  // person to expect.
  apply(cleanFlags(next));
}
