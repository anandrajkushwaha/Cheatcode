import "server-only";
import { createClient } from "@supabase/supabase-js";

/**
 * Supabase client using the SECRET key. Bypasses RLS entirely.
 *
 * Only import this from route handlers and server-side admin code.
 * The `server-only` import above makes the build fail if it ever reaches
 * a Client Component, so this cannot leak to the browser by accident.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) return null;

  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
