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
 */
export function FooterBanner() {
  const status = useAuthStatus();
  if (status === "in") return null;

  return (
    <div className="relative z-10 mx-auto w-full max-w-[1242px] px-5">
      <div className="@container relative overflow-hidden rounded-[24px] bg-[#151515]">
        <div className="relative aspect-[1202/326] min-h-[19rem] sm:min-h-0">
          <Image
            src="/home/footer-banner.webp"
            alt=""
            fill
            sizes="(min-width: 1242px) 1202px, 100vw"
            className="object-cover object-right"
          />
          {/* Reads across the photograph so the type stays legible over sky. */}
          <div
            aria-hidden="true"
            className="absolute inset-y-0 left-0 w-full sm:w-[58%]"
            style={{
              background:
                "linear-gradient(to right, #126ba2 0%, rgba(18,107,162,0.92) 45%, rgba(18,107,162,0) 100%)",
            }}
          />

          <div className="absolute inset-y-0 left-0 flex flex-col justify-center px-6 sm:px-0 sm:pl-[5.57cqw]">
            <h2
              className="max-w-[48.4cqw] font-display font-medium text-white max-sm:max-w-none"
              style={{ fontSize: "clamp(1.5rem, 3.328cqw, 2.5rem)", lineHeight: 1.18 }}
            >
              Stop guessing what everyone else already knows.
            </h2>
            <p
              className="mt-4 max-w-[38cqw] font-display text-white max-sm:max-w-none sm:mt-[2.7cqw]"
              style={{ fontSize: "clamp(0.95rem, 1.664cqw, 1.25rem)", lineHeight: 1.35 }}
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
