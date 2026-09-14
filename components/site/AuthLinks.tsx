"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { appAuthConfigured } from "@/lib/supabase/app-env";
import { createAppBrowserClient } from "@/lib/supabase/app-client";

/**
 * The way in, in the corner of every page.
 *
 * One component rather than two copies, because there are two headers on this
 * site — the landing page's and the content pages' — and a sign-in button that
 * says something different depending on which page you are on is the kind of
 * inconsistency people read as two different products.
 *
 * ------------------------------------------------------ why the check is here
 *
 * Signed in, this should say "Open app"; signed out, "Log in" and "Sign up".
 * Knowing which requires reading a cookie, and reading a cookie on the server
 * makes a page dynamic — which for the blog, the tools and the landing page
 * means giving up the CDN and re-rendering every crawl. Those pages are the
 * whole acquisition funnel; making them dynamic to get a button right would be
 * paying in the currency the site is trying to earn.
 *
 * So the server always renders the signed-out state, and the browser corrects
 * it after hydration. The cost lands entirely on people who *are* signed in,
 * and it is one frame of "Log in" before it becomes "Open app". The cost of
 * the alternative lands on everybody, on every page, forever.
 *
 * `status` is deliberately three-valued. Rendering "Log in" while the check is
 * in flight and then swapping it is the flicker above; rendering nothing until
 * the answer arrives collapses the header's width and shifts the whole nav
 * sideways on first paint. So the signed-out buttons are what "unknown" looks
 * like — the common case is correct immediately, and only the signed-in case
 * changes.
 */
type Status = "unknown" | "in" | "out";

export function useAuthStatus(): Status {
  const [status, setStatus] = useState<Status>("unknown");

  useEffect(() => {
    if (!appAuthConfigured) {
      setStatus("out");
      return;
    }

    let alive = true;
    const supabase = createAppBrowserClient();

    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (alive) setStatus(data.session ? "in" : "out");
      })
      // A failed check is not a signed-in user. Falling back to "out" shows a
      // sign-in button, which is recoverable; showing "Open app" to somebody
      // with no session sends them to a redirect and back for no reason.
      .catch(() => alive && setStatus("out"));

    // Sign out in another tab should not leave this one offering "Open app".
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      if (alive) setStatus(session ? "in" : "out");
    });

    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  return status;
}

const SOLID =
  "whitespace-nowrap rounded-full bg-ink px-3.5 py-2 text-[0.78rem] font-medium text-paper " +
  "sm:px-4 sm:text-[0.8rem] transition-transform duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] " +
  "hover:scale-[1.03] active:scale-[0.97]";

const QUIET =
  "whitespace-nowrap text-[0.78rem] text-ink-50 transition-colors hover:text-ink sm:text-[0.8rem]";

/**
 * @param location  Where this instance sits, for the analytics attribute the
 *                  rest of the site already uses. A single "cta_click" event
 *                  with no location cannot tell you whether the nav or the
 *                  footer is doing the work.
 */
export function AuthLinks({ location }: { location: string }) {
  const status = useAuthStatus();

  if (status === "in") {
    return (
      <Link
        href="/app"
        data-ev="cta_click"
        data-ev-location={location}
        data-ev-label="Open app"
        className={SOLID}
      >
        Open app
      </Link>
    );
  }

  return (
    <>
      <Link
        href="/signin"
        data-ev="cta_click"
        data-ev-location={location}
        data-ev-label="Log in"
        className={QUIET}
      >
        Log in
      </Link>
      <Link
        href="/signin"
        data-ev="cta_click"
        data-ev-location={location}
        data-ev-label="Sign up"
        className={SOLID}
      >
        Sign up
      </Link>
    </>
  );
}

/**
 * The same door, as one large button, for the middle of a page.
 *
 * Signed in it says "Open app" rather than "Sign up free", because a person
 * who already has an account being invited to make one is the clearest way to
 * tell them the page has no idea who they are.
 */
export function AuthCta({
  location,
  label = "Sign up free",
  invert = false,
  className = "",
}: {
  location: string;
  label?: string;
  /** On a dark section. A prop rather than a class override, because two
   *  Tailwind utilities for the same property are resolved by stylesheet
   *  order, not by the order they appear in the string — "later wins" is a
   *  thing people believe about `class` and it is not true. */
  invert?: boolean;
  className?: string;
}) {
  const status = useAuthStatus();
  const signedIn = status === "in";

  return (
    <Link
      href={signedIn ? "/app" : "/signin"}
      data-ev="cta_click"
      data-ev-location={location}
      data-ev-label={signedIn ? "Open app" : label}
      className={
        "inline-flex items-center justify-center whitespace-nowrap rounded-full " +
        (invert ? "bg-paper text-ink " : "bg-ink text-paper ") +
        "px-6 py-3 text-[0.9rem] font-medium transition-transform duration-200 " +
        "ease-[cubic-bezier(0.16,1,0.3,1)] hover:scale-[1.03] active:scale-[0.97] " +
        className
      }
    >
      {signedIn ? "Open app" : label}
    </Link>
  );
}
