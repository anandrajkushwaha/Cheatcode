import "server-only";
import { createAppAdminClient } from "@/lib/supabase/app";
import { FEATURE_LABELS, type Feature } from "@/lib/app/ai-cost";

/**
 * What the admin dashboard reads.
 *
 * Every query here goes through the service key, because that is the point of
 * an admin screen: these are other people's rows. The admin cookie has already
 * been checked twice by the time anything in this file runs — once in the
 * proxy, once in the layout — and nothing here is reachable from the browser.
 *
 * ------------------------------------------------------------- the joins
 *
 * Supabase's PostgREST can embed a related row, but only across a declared
 * foreign key, and the two joins this screen needs are not that:
 *
 *   `ai_usage.session_id` is deliberately *not* a foreign key — sessions
 *   outlive the tables they point at, and a cascade there would delete
 *   accounting as a side effect of tidying a conversation.
 *
 *   `auth.users` is not in the exposed schema at all.
 *
 * So the sessions view is assembled in TypeScript from three cheap indexed
 * reads rather than one clever query. At the volumes this screen looks at —
 * a few hundred sessions in a window — that is a few milliseconds, and it
 * means the shape is readable and the failure of any one part degrades to a
 * blank column rather than an empty page.
 *
 * ---------------------------------------------------------- missing table
 *
 * Every read tolerates the table not existing. A deployment that has not run
 * 60_ai_usage.sql or 61_admin_tracking.sql should see a dashboard that says
 * so, not a stack trace — and the screen says which file to run.
 */

export type Missing = { ok: false; missing: string };

/** Rows that came back, or the name of the migration that has not been run. */
type Result<T> = { ok: true; data: T } | Missing;

function absent(message: string | undefined, file: string): Missing | null {
  if (!message) return null;
  return /does not exist|schema cache|relation .* does not exist/i.test(message)
    ? { ok: false as const, missing: file }
    : null;
}

/* ----------------------------------------------------------------- shapes */

export type FeatureRow = {
  feature: Feature | string;
  label: string;
  calls: number;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  /** How many rows had no rate, so the cost above is an understatement. */
  unpriced: number;
  users: number;
};

export type SessionRow = {
  sessionId: string | null;
  userId: string | null;
  email: string | null;
  startedAt: string;
  channel: string | null;
  calls: number;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  unpriced: number;
  models: string[];
  /** The résumé this conversation produced, if it produced one. */
  resume: {
    id: string;
    title: string;
    /** The public address, when sharing is switched on. Null otherwise. */
    shareId: string | null;
    isPublic: boolean;
    downloads: number;
    lastDownloadedAt: string | null;
  } | null;
};

export type Totals = {
  calls: number;
  sessions: number;
  people: number;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  unpriced: number;
  downloads: number;
  resumesShared: number;
};

type UsageRow = {
  user_id: string | null;
  session_id: string | null;
  feature: string;
  model: string;
  input_tokens: number | null;
  output_tokens: number | null;
  audio_input_tokens: number | null;
  audio_output_tokens: number | null;
  cost_usd: string | number | null;
  created_at: string;
};

const n = (v: unknown): number => {
  const x = typeof v === "string" ? Number.parseFloat(v) : typeof v === "number" ? v : 0;
  return Number.isFinite(x) ? x : 0;
};

/* ------------------------------------------------------------- the reads */

/**
 * Every spend row in the window.
 *
 * One read, then everything else on this screen is grouped from it in memory.
 * The alternative is four aggregate queries that can disagree with each other
 * about the same window, which is how a dashboard ends up showing a total that
 * is not the sum of its rows.
 *
 * Capped, and the cap is honest: past it the numbers would be a sample
 * presented as a total. The screen says when it has been hit.
 */
const CAP = 20_000;

export async function usageSince(days: number): Promise<Result<{ rows: UsageRow[]; capped: boolean }>> {
  const supabase = createAppAdminClient();
  if (!supabase) return { ok: false, missing: "SUPABASE_SECRET_KEY" };

  const from = new Date(Date.now() - days * 86_400_000).toISOString();
  const { data, error } = await supabase
    .from("ai_usage")
    .select(
      "user_id,session_id,feature,model,input_tokens,output_tokens,audio_input_tokens,audio_output_tokens,cost_usd,created_at",
    )
    .gte("created_at", from)
    .order("created_at", { ascending: false })
    .limit(CAP);

  const gone = absent(error?.message, "60_ai_usage.sql");
  if (gone) return gone;
  if (error) throw new Error(error.message);

  const rows = (data ?? []) as UsageRow[];
  return { ok: true, data: { rows, capped: rows.length >= CAP } };
}

/** Spend and volume per feature, biggest first. This is "what gets used". */
export function byFeature(rows: UsageRow[]): FeatureRow[] {
  const acc = new Map<string, FeatureRow & { userSet: Set<string> }>();

  for (const r of rows) {
    const key = r.feature || "unknown";
    let row = acc.get(key);
    if (!row) {
      row = {
        feature: key,
        label: FEATURE_LABELS[key as Feature] ?? key,
        calls: 0,
        inputTokens: 0,
        outputTokens: 0,
        costUsd: 0,
        unpriced: 0,
        users: 0,
        userSet: new Set<string>(),
      };
      acc.set(key, row);
    }
    row.calls += 1;
    row.inputTokens += n(r.input_tokens) + n(r.audio_input_tokens);
    row.outputTokens += n(r.output_tokens) + n(r.audio_output_tokens);
    if (r.cost_usd == null) row.unpriced += 1;
    else row.costUsd += n(r.cost_usd);
    if (r.user_id) row.userSet.add(r.user_id);
  }

  return [...acc.values()]
    .map(({ userSet, ...row }) => ({ ...row, users: userSet.size }))
    .sort((a, b) => b.calls - a.calls);
}

export function totals(rows: UsageRow[]): Omit<Totals, "downloads" | "resumesShared"> {
  const sessions = new Set<string>();
  const people = new Set<string>();
  let inputTokens = 0;
  let outputTokens = 0;
  let costUsd = 0;
  let unpriced = 0;

  for (const r of rows) {
    if (r.session_id) sessions.add(r.session_id);
    if (r.user_id) people.add(r.user_id);
    inputTokens += n(r.input_tokens) + n(r.audio_input_tokens);
    outputTokens += n(r.output_tokens) + n(r.audio_output_tokens);
    if (r.cost_usd == null) unpriced += 1;
    else costUsd += n(r.cost_usd);
  }

  return { calls: rows.length, sessions: sessions.size, people: people.size, inputTokens, outputTokens, costUsd, unpriced };
}

/**
 * One row per agent session: who, how much, what it cost, and what came out.
 *
 * "Session" here means a row of `agent_conversations`. Spend that carries no
 * session id — a résumé being parsed on upload, say — is real spend and is in
 * the feature table above, but it did not happen inside a conversation and
 * inventing one for it would be a lie in a table about conversations.
 */
export async function sessions(days: number, rows: UsageRow[]): Promise<SessionRow[]> {
  const supabase = createAppAdminClient();
  if (!supabase) return [];

  const from = new Date(Date.now() - days * 86_400_000).toISOString();

  const { data: convos } = await supabase
    .from("agent_conversations")
    .select("id,user_id,title,channel,started_at")
    .gte("started_at", from)
    .order("started_at", { ascending: false })
    .limit(500);

  const list = (convos ?? []) as {
    id: string;
    user_id: string;
    title: string | null;
    channel: string | null;
    started_at: string;
  }[];
  if (!list.length) return [];

  const ids = list.map((c) => c.id);
  const userIds = [...new Set(list.map((c) => c.user_id))];

  /**
   * The résumé each conversation produced, and who each user is.
   *
   * Both are best-effort. A deployment that has not run 61_admin_tracking.sql
   * has no `agent_conversation_id` column, and the right behaviour then is an
   * empty column with the rest of the row intact — not a failed page.
   */
  const [drafts, profiles] = await Promise.all([
    // `.then(r => r.data)` rather than a try/catch: PostgREST reports a
    // missing column in `error`, not by rejecting, so an unmigrated
    // deployment lands here as an empty list and the rest of the row survives.
    supabase
      .from("resume_drafts")
      .select("id,title,share_id,is_public,download_count,last_downloaded_at,agent_conversation_id")
      .in("agent_conversation_id", ids)
      .then((r) => r.data ?? []),
    supabase
      .from("profiles")
      .select("id,email")
      .in("id", userIds)
      .then((r) => r.data ?? []),
  ]);

  const draftBy = new Map<string, (typeof drafts)[number]>();
  for (const d of drafts as { agent_conversation_id: string }[]) {
    if (!draftBy.has(d.agent_conversation_id)) draftBy.set(d.agent_conversation_id, d as never);
  }

  const emailBy = new Map<string, string | null>();
  for (const p of profiles as { id: string; email: string | null }[]) emailBy.set(p.id, p.email);

  // Spend, bucketed by session once rather than filtered per row.
  const spend = new Map<string, UsageRow[]>();
  for (const r of rows) {
    if (!r.session_id) continue;
    const bucket = spend.get(r.session_id);
    if (bucket) bucket.push(r);
    else spend.set(r.session_id, [r]);
  }

  return list.map((c) => {
    const mine = spend.get(c.id) ?? [];
    const d = draftBy.get(c.id) as
      | {
          id: string;
          title: string | null;
          share_id: string | null;
          is_public: boolean;
          download_count: number | null;
          last_downloaded_at: string | null;
        }
      | undefined;

    return {
      sessionId: c.id,
      userId: c.user_id,
      email: emailBy.get(c.user_id) ?? null,
      startedAt: c.started_at,
      channel: c.channel,
      calls: mine.length,
      inputTokens: mine.reduce((t, r) => t + n(r.input_tokens) + n(r.audio_input_tokens), 0),
      outputTokens: mine.reduce((t, r) => t + n(r.output_tokens) + n(r.audio_output_tokens), 0),
      costUsd: mine.reduce((t, r) => t + (r.cost_usd == null ? 0 : n(r.cost_usd)), 0),
      unpriced: mine.filter((r) => r.cost_usd == null).length,
      models: [...new Set(mine.map((r) => r.model))],
      resume: d
        ? {
            id: d.id,
            title: d.title ?? "Resume",
            shareId: d.share_id,
            isPublic: Boolean(d.is_public),
            downloads: n(d.download_count),
            lastDownloadedAt: d.last_downloaded_at,
          }
        : null,
    };
  });
}

/** Downloads and shares across the whole product, not only inside sessions. */
export async function resumeTotals(): Promise<{ downloads: number; shared: number; missing?: string }> {
  const supabase = createAppAdminClient();
  if (!supabase) return { downloads: 0, shared: 0 };

  const { data, error } = await supabase
    .from("resume_drafts")
    .select("download_count,is_public")
    .limit(5000);

  const gone = absent(error?.message, "61_admin_tracking.sql");
  if (gone) return { downloads: 0, shared: 0, missing: gone.missing };
  if (error) return { downloads: 0, shared: 0 };

  const rows = (data ?? []) as { download_count: number | null; is_public: boolean }[];
  return {
    downloads: rows.reduce((t, r) => t + n(r.download_count), 0),
    shared: rows.filter((r) => r.is_public).length,
  };
}
