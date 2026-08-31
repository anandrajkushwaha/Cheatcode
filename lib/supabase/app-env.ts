/**
 * Where the app's Supabase project lives.
 *
 * Its own module with no imports, so both the browser client and the server
 * client can read it. Anything that touches next/headers cannot be reached
 * from a Client Component, and anything that creates a browser client cannot
 * be reached from a route handler — the config has to sit outside both.
 *
 * The fallback matters: leave the APP_ vars unset and everything runs against
 * the website's existing Supabase project. Set them and the app's users live
 * somewhere else. Merging the two later is one variable, not a migration of
 * code.
 */
export const APP_SUPABASE_URL =
  process.env.NEXT_PUBLIC_APP_SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;

export const APP_SUPABASE_ANON =
  process.env.NEXT_PUBLIC_APP_SUPABASE_PUBLISHABLE_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

export const appAuthConfigured = Boolean(APP_SUPABASE_URL && APP_SUPABASE_ANON);
