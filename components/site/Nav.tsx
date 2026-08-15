"use client";

import { useEffect, useState } from "react";
import { ToolsMenu } from "./ToolsMenu";

const LINKS = [
  { href: "#how", label: "How it works" },
  { href: "#mentors", label: "Mentors" },
  { href: "/blog", label: "Guides" },
];

export function Nav() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-colors duration-300 ${
        scrolled
          ? "border-b border-ink-08 bg-paper/80 backdrop-blur-xl backdrop-saturate-150"
          : "border-b border-transparent"
      }`}
    >
      <nav
        className="container-page flex h-14 items-center justify-between gap-4"
        aria-label="Main"
      >
        <a
          href="#top"
          className="text-[0.95rem] font-semibold tracking-[-0.04em]"
        >
          Cheatcode
        </a>

        <ul className="hidden items-center gap-8 lg:flex">
          {LINKS.map((link) => (
            <li key={link.href}>
              <a
                href={link.href}
                className="text-[0.8rem] text-ink-50 transition-colors hover:text-ink"
              >
                {link.label}
              </a>
            </li>
          ))}
          <li>
            <ToolsMenu />
          </li>
        </ul>

        <div className="flex items-center gap-2 sm:gap-3">
          <a
            href="/become-a-mentor"
            data-ev="cta_click"
            data-ev-location="nav"
            data-ev-label="Become a mentor"
            className="whitespace-nowrap text-[0.78rem] text-ink-50 transition-colors hover:text-ink sm:rounded-full sm:border sm:border-ink-15 sm:px-4 sm:py-2 sm:text-[0.8rem] sm:text-ink sm:hover:border-ink-30"
          >
            Become a mentor
          </a>
          <a
            href="#waitlist"
            data-ev="cta_click"
            data-ev-location="nav"
            data-ev-label="Get early access"
            className="whitespace-nowrap rounded-full bg-ink px-3.5 py-2 text-[0.78rem] font-medium text-paper sm:px-4 sm:text-[0.8rem] transition-transform duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] hover:scale-[1.03] active:scale-[0.97]"
          >
            Get early access
          </a>
        </div>
      </nav>
    </header>
  );
}
