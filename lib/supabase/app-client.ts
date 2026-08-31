import { createBrowserClient } from "@supabase/ssr";
import { APP_SUPABASE_URL, APP_SUPABASE_ANON } from "./app-env";

/**
 * The Supabase client for Client Components.
 *
 * Session lives in cookies, shared with the server, so a page rendered on the
 * server and a component hydrated in the browser see the same user.
 */
export function createAppBrowserClient() {
  if (!APP_SUPABASE_URL || !APP_SUPABASE_ANON) {
    throw new Error(
      "Supabase is not configured for the app. Set NEXT_PUBLIC_APP_SUPABASE_URL and " +
        "NEXT_PUBLIC_APP_SUPABASE_PUBLISHABLE_KEY.",
    );
  }
  return createBrowserClient(APP_SUPABASE_URL, APP_SUPABASE_ANON);
}
