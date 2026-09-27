"use client";

import Image from "next/image";
import Link from "next/link";
import { useAuthStatus } from "./AuthLinks";

/**
 * The sign-up banner that sits over the top of the footer — Figma 183:4336.
 *
 * Its own client component purely so the rest of the footer can stay on the
 * server: those links are what a crawler reads at the bottom of every page,
 * and they should be in the HTML rather than waiting on hydration. Only this
 * card needs to know whether somebody is signed in, and it removes itself
 * when they are, which is the difference between the two footer designs.
 *
 * `unknown` counts as signed out so the common case paints immediately; a
 * signed-in visitor sees it disappear on the next frame, which is the same
 * trade the header already makes.
 *
 * Two crops, one per layout. The phone crop is its own export — a near square
 * with the sky left open at the top for the words — so it needs no wash at
 * all; the words sit straight on the photograph. The wide crop is pure
 * photograph edge to edge, so the blue block the design shows on its left is
 * the overlay's job there and only there.
 */
export function FooterBanner() {
  const status = useAuthStatus();
  if (status === "in") return null;

  return (
    <div className="relative z-10 mx-auto w-full max-w-[1242px] px-5">
      <div className="@container relative overflow-hidden rounded-[24px] bg-[#151515]">
        <div className="relative aspect-[494/484] sm:aspect-[1202/326]">
          <Image
            src="/home/footer-banner-mobile.webp"
            alt=""
            fill
            sizes="100vw"
            quality={90}
            className="object-cover sm:hidden"
          />
          <Image
            src="/home/footer-banner.webp"
            alt=""
            fill
            sizes="(min-width: 1242px) 1202px, 100vw"
            quality={90}
            className="hidden object-cover object-right sm:block"
          />

          {/* Wide crop only. It has to reach zero inside its own box: a
              gradient that stops part-way and then ends leaves a vertical
              seam exactly where the element does. */}
          <div
            aria-hidden="true"
            className="absolute inset-0 hidden sm:block"
            style={{
              background:
                "linear-gradient(to right, rgba(18,107,162,0.98) 0%, rgba(18,107,162,0.82) 40%, rgba(18,107,162,0.35) 70%, rgba(18,107,162,0) 100%)",
            }}
          />

          {/* Top of the frame on a phone, where the export leaves the sky
              clear; vertically centred on the left once the crop goes wide. */}
          <div className="absolute inset-x-0 top-0 flex flex-col px-[6.5cqw] pt-[7.5cqw] sm:inset-y-0 sm:right-auto sm:justify-center sm:px-0 sm:pl-[5.57cqw] sm:pt-0">
            <h2
              className="font-display font-medium text-white sm:max-w-[48.4cqw]"
              style={{ fontSize: "clamp(1.45rem, 3.328cqw, 2.5rem)", lineHeight: 1.18 }}
            >
              Stop guessing what everyone else already knows.
            </h2>
            <p
              className="mt-3 font-display text-white/95 sm:mt-[2.7cqw] sm:max-w-[38cqw]"
              style={{ fontSize: "clamp(0.92rem, 1.664cqw, 1.25rem)", lineHeight: 1.4 }}
            >
              One account. Resume builder, job search, mock interviews, and more. Start with
              your resume.
            </p>
            <Link
              href="/signin"
              data-ev="cta_click"
              data-ev-location="footer-banner"
              data-ev-label="Sign up free"
              className="mt-6 inline-flex w-fit items-center rounded-[4px] bg-white font-display font-medium tracking-[-0.025em] text-[#1e1e1e] transition-transform duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] hover:scale-[1.03] active:scale-[0.97] sm:mt-[3.1cqw]"
              style={{
                fontSize: "clamp(0.88rem, 1.345cqw, 1.01rem)",
                paddingInline: "clamp(1.1rem, 2cqw, 1.5rem)",
                paddingBlock: "clamp(0.55rem, 0.75cqw, 0.5625rem)",
              }}
            >
              Sign up free
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
