import Image from "next/image";
import Link from "next/link";
import { FooterBanner } from "./FooterBanner";

/**
 * The footer — Figma 183:4336 (signed out) and 183:4394 (signed in).
 *
 * One component for both: the only difference between the two frames is the
 * sign-up card over the top, and that removes itself once somebody has an
 * account. Everything below it is identical, and stays a server component so
 * the links are in the HTML a crawler reads at the foot of every page.
 *
 * The dark block runs the full width with the photograph inside a panel that
 * is rounded at the top, and the card overlaps the seam between them — which
 * is why the block is pulled up under the card rather than the card being
 * pushed down into it.
 */
type Group = { title: string; links: { href: string; label: string; external?: boolean }[] };

const GROUPS: Group[] = [
  {
    title: "Quick links",
    links: [
      // No About page exists yet; this is the homepage until there is one.
      { href: "/", label: "About Us" },
      { href: "/signin?next=/app/insights", label: "Insights" },
      { href: "/blog", label: "Blogs" },
      { href: "/signin?next=/app/upgrade", label: "Pricing" },
      { href: "/#faq", label: "FAQs" },
    ],
  },
  {
    title: "Features",
    links: [
      { href: "/signin?next=/app/resume", label: "AI Resume Builder" },
      { href: "/tools/resume-ats-checker", label: "ATS Resume Checker" },
      { href: "/signin?next=/app/interviews", label: "AI Mock Interview" },
      { href: "/signin?next=/app/resume", label: "Resume Templates" },
      { href: "/tools", label: "Career Tools" },
    ],
  },
];

const LEGAL = [
  { href: "/privacy", label: "Privacy" },
  { href: "/terms", label: "Terms" },
  { href: "/refunds", label: "Refunds" },
];

const EMAIL = "cheatcodeapp26@gmail.com";
const INSTAGRAM = "https://www.instagram.com/cheatcodeapp/";
const LINKEDIN = "https://www.linkedin.com/company/cheatcodeapp/";

const link = "text-[0.87rem] leading-[1.5] text-white/74 transition-colors hover:text-white";
const heading = "text-[1.1rem] font-bold leading-[1.5] text-white";

/**
 * @param banner  Whether the sign-up card may appear at all. Left on, it still
 *                hides itself for anybody signed in; turned off, it never
 *                renders — which is what the app's own pages want, where the
 *                visitor is signed in by definition.
 */
export function Footer({ banner = true }: { banner?: boolean } = {}) {
  return (
    <footer className="relative">
      {banner && <FooterBanner />}

      {/* The photograph starts at the very top of this block and the card
          straddles its edge — in the design there is no dark band between the
          two, and no rounded corner on the grass. The overlap is 97px against
          the 1435 frame, held in vw below `lg` so it tracks the card as that
          shrinks. */}
      <div
        className={`relative overflow-hidden bg-[#040404] ${
          banner ? "-mt-[6.8vw] lg:-mt-[97px]" : ""
        }`}
      >
        <Image
          src="/home/footer-bg.webp"
          alt=""
          fill
          sizes="100vw"
          className="object-cover object-center"
        />
        {/* Light touch: the grass is meant to read as grass. Just enough to
            stop the small type dissolving where the light catches it. */}
        <div aria-hidden="true" className="absolute inset-0 bg-[#040404]/30" />

        <div>
          <div>
            <div
              className={`relative mx-auto w-full max-w-[1200px] px-5 pb-8 ${
                banner ? "pt-[11.5vw] lg:pt-[153px]" : "pt-14 lg:pt-[58px]"
              }`}
            >
              <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_minmax(0,1.15fr)_minmax(0,1.2fr)] lg:gap-8">
                {/* ------------------------------------------------ brand */}
                <div>
                  <Link
                    href="/"
                    className="font-display text-[1.7rem] font-medium tracking-[-0.025em] text-white"
                  >
                    Cheatcode
                  </Link>
                  <p className="mt-6 max-w-[38ch] text-[0.84rem] leading-[1.7] text-white/74">
                    Cheatcode is built for the next generation of talent in India - giving you
                    smarter tools, practical insights, and the intelligence to build a better
                    resume, prepare for interviews, and make your next career move with
                    confidence.
                  </p>

                  <p className={`mt-8 ${heading}`}>Follow Us</p>
                  <div className="mt-3 flex items-center gap-4">
                    <a
                      href={INSTAGRAM}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label="Cheatcode on Instagram"
                      data-ev="outbound_click"
                      data-ev-location="footer"
                      data-ev-label="instagram"
                      className="text-white/74 transition-colors hover:text-white"
                    >
                      <svg viewBox="0 0 24 24" className="size-[19px]" fill="none" aria-hidden="true">
                        <rect x="3" y="3" width="18" height="18" rx="5" stroke="currentColor" strokeWidth="1.8" />
                        <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="1.8" />
                        <circle cx="17.2" cy="6.8" r="1.2" fill="currentColor" />
                      </svg>
                    </a>
                    <a
                      href={LINKEDIN}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label="Cheatcode on LinkedIn"
                      data-ev="outbound_click"
                      data-ev-location="footer"
                      data-ev-label="linkedin"
                      className="text-white/74 transition-colors hover:text-white"
                    >
                      <svg viewBox="0 0 24 24" className="size-[19px]" fill="currentColor" aria-hidden="true">
                        <path d="M4.98 3.5a2.5 2.5 0 11-.02 5 2.5 2.5 0 01.02-5zM3 9h4v12H3zM9.5 9h3.83v1.64h.05c.53-.95 1.84-1.95 3.78-1.95 4.04 0 4.79 2.5 4.79 5.76V21h-4v-5.66c0-1.35-.03-3.09-1.96-3.09-1.96 0-2.26 1.47-2.26 2.99V21h-4z" />
                      </svg>
                    </a>
                  </div>
                </div>

                {/* ------------------------------------------- link groups */}
                {GROUPS.map((g) => (
                  <nav key={g.title} aria-label={g.title}>
                    <p className={heading}>{g.title}</p>
                    <ul className="mt-5 space-y-4">
                      {g.links.map((l) => (
                        <li key={`${g.title}-${l.label}`}>
                          <Link href={l.href} className={link}>
                            {l.label}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </nav>
                ))}

                {/* ---------------------------------------------- contact */}
                <div>
                  <p className={heading}>Contact Us</p>
                  <p className="mt-5 flex gap-3 text-[0.84rem] leading-[1.55] text-white/80">
                    <svg viewBox="0 0 24 24" className="mt-[0.15rem] size-4 shrink-0" fill="none" aria-hidden="true">
                      <path
                        d="M12 21s7-5.6 7-11a7 7 0 10-14 0c0 5.4 7 11 7 11z"
                        stroke="currentColor"
                        strokeWidth="1.7"
                      />
                      <circle cx="12" cy="10" r="2.6" stroke="currentColor" strokeWidth="1.7" />
                    </svg>
                    <span>Smart Orchard, Sector 61 Gurugram, Haryana 22001</span>
                  </p>
                  <p className="mt-5 flex gap-3">
                    <svg viewBox="0 0 24 24" className="mt-[0.15rem] size-4 shrink-0 text-white/80" fill="none" aria-hidden="true">
                      <rect x="3" y="5" width="18" height="14" rx="2.5" stroke="currentColor" strokeWidth="1.7" />
                      <path d="M3.8 7l8.2 5.6L20.2 7" stroke="currentColor" strokeWidth="1.7" />
                    </svg>
                    <a
                      href={`mailto:${EMAIL}`}
                      data-ev="outbound_click"
                      data-ev-location="footer"
                      data-ev-label="email"
                      className="break-all text-[0.84rem] leading-[1.55] text-white/80 transition-colors hover:text-white"
                    >
                      {EMAIL}
                    </a>
                  </p>
                </div>
              </div>

              <div className="mt-14 border-t border-white/22 pt-6">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-[0.87rem] text-white/74">
                    © {new Date().getFullYear()} Cheatcode. All rights reserved.
                  </p>
                  <ul className="flex items-center gap-8 sm:gap-14">
                    {LEGAL.map((l) => (
                      <li key={l.href}>
                        <Link href={l.href} className={link}>
                          {l.label}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
