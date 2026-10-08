import "server-only";

/**
 * What a Postgres error from these tables actually means.
 *
 * Written because the first version of the panel got this wrong in the one
 * way that wastes somebody's evening: it tested the message for "does not
 * exist", which matches a missing *column* as readily as a missing table, and
 * then told the owner to run the migration he had just run. An error screen
 * that sends you to do the thing you already did is worse than no error
 * screen, because you believe it.
 *
 * So the two cases are separated by code, not by prose, and anything that
 * matches neither keeps its own text and its code — which is the only way the
 * next unfamiliar failure gets diagnosed in one message instead of five.
 */

export type GovtDbError =
  | { kind: "missing_table"; message: string }
  | { kind: "missing_column"; message: string; column: string | null }
  | { kind: "other"; message: string };

type Raw = { code?: string; message: string; details?: string | null; hint?: string | null };

export function classifyGovtError(error: Raw): GovtDbError {
  const code = error.code ?? "";
  const text = error.message ?? "";

  // 42P01: the relation is not there. PGRST205: PostgREST's schema cache has
  // never heard of it, which is what a brand-new table looks like for the
  // first few seconds, and what a table created in a *different* project
  // looks like forever.
  if (code === "42P01" || code === "PGRST205" || /relation .* does not exist/i.test(text)) {
    return {
      kind: "missing_table",
      message:
        "The government tables aren't in this database — run supabase/schemas/100_govt_notices.sql, " +
        "then 104 and 105, in the same Supabase project this deployment points at.",
    };
  }

  // 42703: the column is not there. PGRST204: it is there but PostgREST is
  // still serving a cached schema from before it was added — a one-line fix
  // that is impossible to guess, so it is spelled out.
  if (
    code === "42703" ||
    code === "PGRST204" ||
    /column .* does not exist/i.test(text) ||
    /could not find the '.*' column/i.test(text)
  ) {
    // "column govt_exams.source_id does not exist" and "Could not find the
    // 'posted_by' column of ...". The first pattern was greedy enough to
    // report the column as "d", which is its own small lesson about anchoring.
    const column =
      text.match(/column\s+(?:[\w$]+\.)*"?([\w$]+)"?/i)?.[1] ??
      text.match(/'([\w$]+)' column/i)?.[1] ??
      null;
    return {
      kind: "missing_column",
      message:
        `The tables are a version behind${column ? ` — "${column}" is missing` : ""}. Run ` +
        "supabase/schemas/105_govt_manual_posting.sql. If you have just run it, the API is still " +
        "serving a cached copy of the schema: run  notify pgrst, 'reload schema';  in the SQL editor.",
      column,
    };
  }

  return { kind: "other", message: code ? `${text} (${code})` : text };
}

/**
 * Insert, and insert again without `posted_by` if that column is not there.
 *
 * The provenance column is the nice-to-have; posting the notice is the job.
 * A panel that refuses to save because it cannot record a name would be
 * choosing bookkeeping over the thing the bookkeeping is about, so the row
 * goes in either way and the screen says the migration is outstanding.
 */
export async function insertTolerant<T>(
  insert: (row: Record<string, unknown>) => PromiseLike<{ data: unknown; error: { code?: string; message: string } | null }>,
  row: Record<string, unknown>,
): Promise<{ data: T | null; error: { code?: string; message: string } | null }> {
  const first = await insert(row);
  if (!first.error || classifyGovtError(first.error).kind !== "missing_column") {
    return { data: (first.data ?? null) as T | null, error: first.error };
  }

  const { posted_by: _dropped, ...rest } = row;
  const second = await insert(rest);
  return { data: (second.data ?? null) as T | null, error: second.error };
}
