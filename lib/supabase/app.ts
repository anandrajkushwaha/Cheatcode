import "server-only";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { APP_SUPABASE_URL, APP_SUPABASE_ANON } from "./app-env";

export { appAuthConfigured } from "./app-env";

/**
 * Supabase clients for the logged-in product, server side.
 *
 * Deliberately separate from lib/supabase/public.ts, which serves the blog.
 * These clients carry a user session, and mixing that into the module the
 * public pages render with would make it far too easy to leak an
 * authenticated query into a cached page.
 */

/**
 * For Server Components, route handlers and server actions.
 *
 * The cookie writes are wrapped in try/catch on purpose: Server Components are
 * not allowed to set cookies, and Supabase refreshes the token on read. Without
 * the catch, any page that merely looks at the user would throw whenever a
 * token happened to be due for refresh. The proxy does the refreshing instead.
 */
export async function createAppServerClient() {
  if (!APP_SUPABASE_URL || !APP_SUPABASE_ANON) return null;
  const store = await cookies();

  return createServerClient(APP_SUPABASE_URL, APP_SUPABASE_ANON, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list) => {
        try {
          for (const { name, value, options } of list) store.set(name, value, options);
        } catch {
          /* read-only context — the proxy owns refreshes */
        }
      },
    },
  });
}

/**
 * Bypasses RLS entirely. Only for webhooks and server jobs that must write
 * columns the user is forbidden to touch — the subscription plan being the
 * whole reason this exists. Never import this into anything a browser reaches.
 */
export function createAppAdminClient() {
  const secret = process.env.APP_SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SECRET_KEY;
  if (!APP_SUPABASE_URL || !secret) return null;

  return createClient(APP_SUPABASE_URL, secret, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** The signed-in user, or null. Safe to call from any server context. */
export async function getSessionUser() {
  const supabase = await createAppServerClient();
  if (!supabase) return null;
  // getUser() revalidates against Supabase; getSession() trusts the cookie,
  // which a client could have tampered with.
  const { data } = await supabase.auth.getUser();
  return data.user ?? null;
}
