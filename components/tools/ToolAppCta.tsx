"use client";

import Link from "next/link";
import { useAuthStatus } from "@/components/site/AuthLinks";

/**
 * Which side of the login a tool is being rendered on. The tools themselves
 * are identical either side; only the step after the answer differs.
 */
export type ToolContext = "public" | "app";

/**
 * The step out of a free tool and into the account.
 *
 * Both tools run on the public site without a login, and that stays true —
 * those two pages are the whole organic funnel and a crawler is never signed
 * in, so a wall in front of them would trade the traffic for the conversion it
 * was supposed to produce. The gate belongs *after* the answer, where there is
 * something new on the other side of it.
 *
 * ------------------------------------------------------------ the deep link
 *
 * Signed out, this goes to /signin carrying `next`, so somebody who came for
 * the ATS checker lands back on the ATS checker inside the app rather than on
 * the app's front door wondering where their score went. The whole chain
 * already honours that parameter — the sign-in page validates it, the form
 * pushes to it, and /auth/callback carries it through Google — so there is
 * nothing to add on the far end.
 *
 * Signed in, there is no reason to visit a sign-in page at all: the link goes
 * straight to the tool. /signin would in fact redirect them there itself, but
 * a button that says "Sign up" to somebody who already has an account is the
 * clearest way to tell them the page does not know who they are.
 *
 * The status check runs in the browser, deliberately: reading the session on
 * the server would make these pages dynamic and cost them the CDN. See
 * useAuthStatus for the full reasoning. "unknown" renders the signed-out
 * label, which is the common case here by a wide margin.
 */
export function ToolAppCta({
  appHref,
  location,
  label,
  signedInLabel = "Open in the app",
  className = "",
}: {
  /** Where this lands once there is a session. */
  appHref: string;
  /** For the analytics attribute the rest of the site already uses. */
  location: string;
  /** Shown to a signed-out visitor. */
  label: string;
  signedInLabel?: string;
  className?: string;
}) {
  const signedIn = useAuthStatus() === "in";
  const text = signedIn ? signedInLabel : label;

  return (
    <Link
      href={signedIn ? appHref : `/signin?next=${encodeURIComponent(appHref)}`}
      data-ev="tool_result_cta"
      data-ev-location={location}
      data-ev-label={text}
      className={
        "inline-flex items-center justify-center whitespace-nowrap rounded-full " +
        "bg-ink px-6 py-3 text-[0.9rem] font-medium text-paper transition-transform " +
        "duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] hover:scale-[1.03] active:scale-[0.97] " +
        className
      }
    >
      {text}
    </Link>
  );
}
