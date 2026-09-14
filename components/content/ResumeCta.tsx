"use client";

import Link from "next/link";
import { useAuthStatus } from "@/components/site/AuthLinks";

/**
 * The builder, offered from inside a resume article.
 *
 * These guides are the top of the funnel and they were ending in a mentor
 * pitch. That is the right offer on an interview or a salary guide and the
 * wrong one here: somebody who has just read two thousand words on what a
 * fresher resume format should look like does not want to book a call, they
 * want to go and make the thing. The next click should be the product.
 *
 * ------------------------------------------------------------- the two states
 *
 * Signed in, it goes straight to `/app/resume`. Signed out, it goes to
 * `/signin?next=/app/resume`, so the account is made *on the way* to the page
 * they asked for and they land there rather than on a generic dashboard
 * wondering where the builder went. Both halves of the sign-in already carry
 * `next` through — Google via the callback's query, phone OTP via a push after
 * verification — so this works on either route in.
 *
 * ------------------------------------------------- why a client component here
 *
 * Only to know which of the two links to render. Blog posts are statically
 * generated and must stay that way, so the check runs in the browser, the same
 * way the header's does. Signed out is what the HTML says, which is what the
 * overwhelming majority of readers arriving from a search result are.
 *
 * Linking unconditionally to `/signin?next=…` would also have worked — that
 * page redirects a signed-in visitor onward — but it spends a round trip and a
 * flash of a sign-in screen on the people who are already customers.
 */
const TARGET = "/app/resume";
const SIGNUP = `/signin?next=${encodeURIComponent(TARGET)}`;

function useHref() {
  return useAuthStatus() === "in" ? TARGET : SIGNUP;
}

/**
 * A slim bar, above the article.
 *
 * At the top rather than only at the bottom because the completion rate on a
 * two-thousand-word guide is not one — most people read the first screen,
 * take what they came for and leave, and an offer they never scrolled to is
 * an offer that was not made. It is one line so it does not stand between
 * somebody and the answer they searched for.
 */
export function ResumeCtaBar() {
  const href = useHref();

  return (
    <div className="mt-8 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-ink-08 bg-ink-04 px-5 py-4">
      <p className="text-[0.9rem] leading-relaxed text-ink-70">
        Skip the formatting — build it on a template that is already ATS-safe.
      </p>
      <Link
        href={href}
        data-ev="cta_click"
        data-ev-location="article-resume-bar"
        data-ev-label="Build free resume"
        className="shrink-0 whitespace-nowrap rounded-full bg-ink px-5 py-2.5 text-[0.85rem] font-medium text-paper transition-transform duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] hover:scale-[1.03] active:scale-[0.97]"
      >
        Build free resume
      </Link>
    </div>
  );
}

/** The full block, where the mentor pitch used to sit on these articles. */
export function ResumeCtaBlock() {
  const href = useHref();

  return (
    <aside className="mt-14 rounded-3xl border border-ink-08 p-8">
      <p className="text-[0.72rem] uppercase tracking-[0.16em] text-ink-30">
        Now do it
      </p>
      <p className="mt-2.5 text-xl font-medium tracking-[-0.02em]">
        Reading about the format is the slow half.
      </p>
      <p className="mt-2.5 max-w-[52ch] text-[0.95rem] leading-relaxed text-ink-50">
        Sixty templates, every one of them laid out the way this guide
        describes. Pick one, type your details in, download the PDF. Free, and
        the download is not paywalled.
      </p>
      <Link
        href={href}
        data-ev="cta_click"
        data-ev-location="article-resume-block"
        data-ev-label="Build free resume"
        className="mt-6 inline-block rounded-full bg-ink px-5 py-2.5 text-[0.85rem] font-medium text-paper"
      >
        Build free resume
      </Link>
    </aside>
  );
}
