import Link from "next/link";
import { SITE } from "@/lib/seo/constants";
import { AuthLinks } from "./AuthLinks";

/**
 * The footer, which until now was a name, a tagline and an email address.
 *
 * That was survivable while the site was one scrolling page with a waitlist at
 * the bottom of it — there was nowhere else to go. It stops being survivable
 * the moment there is an app: somebody who reaches the end of a guide has
 * exactly two things they might want, the product and a way back into their
 * account, and finding neither is how a page ends in a browser's back button.
 */
const COLUMNS: { title: string; links: { href: string; label: string }[] }[] = [
  {
    title: "Product",
    links: [
      { href: "/app", label: "Open the app" },
      { href: "/app/resume/templates", label: "Resume templates" },
      { href: "/tools/resume-ats-checker", label: "ATS checker" },
      { href: "/tools/in-hand-salary-calculator", label: "Salary calculator" },
    ],
  },
  {
    title: "Learn",
    links: [
      { href: "/blog", label: "Guides" },
      { href: "/tools", label: "Free tools" },
    ],
  },
  {
    title: "Company",
    links: [
      { href: "/become-a-mentor", label: "Become a mentor" },
      { href: "mailto:hello@cheatcodeapp.com", label: "hello@cheatcodeapp.com" },
    ],
  },
];

/**
 * Legal sits next to the copyright rather than in a fourth column.
 * Nobody navigates to a refund policy from a menu — they go looking for it at
 * the very bottom of the page, which is exactly where this is.
 */
const LEGAL: { href: string; label: string }[] = [
  { href: "/privacy", label: "Privacy" },
  { href: "/terms", label: "Terms" },
  { href: "/refunds", label: "Refunds" },
];

export function Footer() {
  return (
    <footer className="border-t border-ink-08 py-14">
      <div className="container-page">
        <div className="flex flex-col gap-10 lg:flex-row lg:justify-between">
          <div className="max-w-[34ch]">
            <p className="text-[0.95rem] font-semibold tracking-[-0.04em]">
              {SITE.name}
            </p>
            <p className="mt-2 text-[0.85rem] leading-relaxed text-ink-50">
              Mentorship for people at the start of it all. Built in India.
            </p>
            {/*
              The same two buttons as the header, at the other end of the page.
              A person who has read to the bottom has spent more attention than
              one who bounced off the top, and asking them to scroll back up to
              find the way in wastes exactly that.
            */}
            <div className="mt-6 flex items-center gap-3">
              <AuthLinks location="footer" />
            </div>
          </div>

          <nav
            aria-label="Footer"
            className="grid grid-cols-2 gap-x-10 gap-y-8 sm:grid-cols-3 lg:gap-x-16"
          >
            {COLUMNS.map((col) => (
              <div key={col.title}>
                <p className="text-[0.8rem] font-medium">{col.title}</p>
                <ul className="mt-3 space-y-2.5">
                  {col.links.map((link) => (
                    <li key={link.href}>
                      <Link
                        href={link.href}
                        className="text-[0.85rem] text-ink-50 transition-colors hover:text-ink"
                      >
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>
        </div>

        <div className="mt-12 flex flex-col gap-4 border-t border-ink-08 pt-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[0.8rem] text-ink-30">
            © {new Date().getFullYear()} {SITE.name}. All rights reserved.
          </p>
          <ul className="flex flex-wrap items-center gap-x-5 gap-y-2">
            {LEGAL.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className="text-[0.8rem] text-ink-30 transition-colors hover:text-ink"
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </footer>
  );
}
