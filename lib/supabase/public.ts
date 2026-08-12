import "server-only";
import { createClient } from "@supabase/supabase-js";

/**
 * Supabase client using the PUBLISHABLE key (not the legacy `anon` key).
 * Every table it touches must be protected by RLS — this key is safe to
 * expose, so the database is the security boundary, not this file.
 *
 * Created per-request on purpose. Do not hoist to module scope.
 */
export function createPublicClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !key) return null;

  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
