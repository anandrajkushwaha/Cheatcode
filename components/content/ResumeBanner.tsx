"use client";

import Link from "next/link";
import { useAuthStatus } from "@/components/site/AuthLinks";

/**
 * The sidebar banner: a piece of artwork with one thing to click.
 *
 * ------------------------------------------------------- why a picture at all
 *
 * The brief was "a proper banner, not a bit of UI", and the difference between
 * the two is not decoration — it is what the reader is being told. A bordered
 * card with a heading and a button is a *control*: it describes something and
 * asks you to go and look. This has to sell sixty résumé designs, and the only
 * honest way to sell a design is to show it. Three real templates, fanned and
 * bleeding off the bottom edge, say "there are a lot of these and they look
 * like this" before a word is read.
 *
 * The artwork is exactly that — `public/banner/resume-templates.webp` is three
 * of the actual templates (`navy-photo`, `rust-header`, `cream-photo`),
 * rendered by the real `DesignPage` with the real sample résumé, photographed
 * at 3× and trimmed. It is a screenshot of the product, not an illustration of
 * it, which means it cannot promise something the builder does not deliver.
 *
 * Forty kilobytes as WebP with an alpha channel, so it sits on the panel's own
 * colour rather than carrying a background of its own — and `loading="lazy"`,
 * because on a two-thousand-word guide this is below the fold on every phone.
 *
 * ------------------------------------------------------------- why not a card
 *
 * No border. A border is the thing that makes a block read as chrome. The
 * panel is a dark field with the artwork bleeding out of the top of it and a
 * single full-width button at the bottom; there is one clickable thing in it
 * and it is the size of a button in an ad, not a link in a menu.
 *
 * ---------------------------------------------------------------- the link
 *
 * Same rule as everywhere else on the site: `/app/resume` when there is a
 * session, `/signin?next=/app/resume` when there is not, so signing up lands
 * the person on the templates rather than on a dashboard. A client component
 * only for that choice — blog pages stay statically generated.
 */
const TARGET = "/app/resume";
const SIGNUP = `/signin?next=${encodeURIComponent(TARGET)}`;

export function ResumeBanner({
  location = "sidebar",
}: {
  /** Where this instance sits, for the analytics the rest of the site uses. */
  location?: string;
}) {
  const href = useAuthStatus() === "in" ? TARGET : SIGNUP;

  return (
    <aside
      data-ev-view="banner_view"
      data-ev-label="resume-templates"
      data-ev-location={location}
      className="relative overflow-hidden rounded-3xl bg-[#1a1c21] text-paper"
    >
      {/* A soft light behind the sheets, so they sit on something rather than
          floating on a flat rectangle. Pure CSS — one less request. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-44 bg-[radial-gradient(ellipse_70%_80%_at_50%_0%,rgba(255,255,255,0.14),transparent_70%)]"
      />

      {/* Full bleed. An inset picture reads as an image *inside a card*; one
          that runs to the edges reads as the banner's own artwork, which is
          the whole difference being asked for here. */}
      <div className="relative pt-6">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/banner/resume-templates.webp"
          alt="Three Cheatcode résumé templates"
          width={760}
          height={313}
          loading="lazy"
          decoding="async"
          className="w-full"
        />
      </div>

      <div className="relative px-6 pb-6 pt-5">
        <p className="text-[0.7rem] uppercase tracking-[0.16em] text-white/40">
          60 free templates
        </p>
        <p className="mt-2 text-[1.12rem] font-medium leading-snug tracking-[-0.02em]">
          Your resume, done before this tab closes.
        </p>
        <p className="mt-2 text-[0.85rem] leading-relaxed text-white/55">
          Pick a template, type your details in, download the PDF. No paywall on
          the download.
        </p>

        <Link
          href={href}
          data-ev="banner_click"
          data-ev-label="resume-templates"
          data-ev-location={location}
          className="mt-5 block rounded-full bg-paper px-5 py-3 text-center text-[0.88rem] font-semibold text-ink transition-transform duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] hover:scale-[1.03] active:scale-[0.97]"
        >
          Create your Resume
        </Link>
      </div>
    </aside>
  );
}
