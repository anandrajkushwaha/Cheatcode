import "server-only";

/**
 * Every row of a query, page by page.
 *
 * Supabase answers at most 1,000 rows per request whatever `.limit()` asks
 * for, so a dashboard that read a 7- or 28-day period in one request silently
 * saw only the first 1,000 rows — the oldest, when ordered by time — and lost
 * the most recent visits, sign-ins and ATS checks. `page(from, to)` builds the
 * query for one slice (ending in `.range(from, to)` on a stable order).
 */
export const PAGE = 1000;

export async function fetchAll<T>(
  page: (from: number, to: number) => PromiseLike<{ data: unknown[] | null; error: { message: string } | null }>,
  max = 50_000,
): Promise<{ rows: T[]; error: string | null; truncated: boolean }> {
  const rows: T[] = [];
  for (let from = 0; from < max; from += PAGE) {
    const { data, error } = await page(from, from + PAGE - 1);
    if (error) return { rows, error: error.message, truncated: false };
    rows.push(...((data ?? []) as T[]));
    if (!data || data.length < PAGE) return { rows, error: null, truncated: false };
  }
  return { rows, error: null, truncated: true };
}

/** The same, shaped like a single Supabase response ({ data, error }). */
export async function fetchAllResult<T>(
  page: (from: number, to: number) => PromiseLike<{ data: unknown[] | null; error: { message: string } | null }>,
  max = 50_000,
): Promise<{ data: T[]; error: { message: string } | null }> {
  const r = await fetchAll<T>(page, max);
  return { data: r.rows, error: r.error ? { message: r.error } : null };
}
