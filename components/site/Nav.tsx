"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AuthLinks } from "./AuthLinks";

/**
 * The header — Figma 165:4080.
 *
 * Solid white rather than the transparent bar that faded in on scroll: the
 * hero behind it is a photograph, and white type over a sunset is a contrast
 * problem that changes with every scroll position.
 *
 * Below `lg` the three links do not fit beside a 1.45rem wordmark and a pill,
 * so they move behind a hamburger. The panel is rendered in the flow under
 * the bar rather than as an overlay, which means it pushes the page down
 * instead of floating over the hero — no scroll locking, nothing to trap
 * focus in, and no way to end up with a menu open over content you cannot
 * reach.
 */
const LINKS = [
  { href: "/tools", label: "Free tools" },
  { href: "/insights", label: "Insights" },
  { href: "/blog", label: "Blogs" },
];

export function Nav() {
  const [open, setOpen] = useState(false);

  // A link tap inside the panel navigates but does not unmount this, so the
  // panel has to be told to close. Escape closes it too.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <header className="sticky top-0 z-50 bg-paper">
      <nav
        className="container-page flex h-[4.5rem] items-center justify-between gap-3 lg:grid lg:grid-cols-[1fr_auto_1fr]"
        aria-label="Main"
      >
        <Link
          href="/"
          onClick={() => setOpen(false)}
          className="shrink-0 font-display text-[1.35rem] font-medium tracking-[-0.025em] text-black sm:text-[1.5rem] lg:justify-self-start lg:text-[1.7rem]"
        >
          Cheatcode
        </Link>

        <ul className="hidden items-center gap-[10px] justify-self-center lg:flex">
          {LINKS.map((l) => (
            <li key={l.href}>
              <Link
                href={l.href}
                className="block px-5 py-[5px] font-display text-[1.01rem] tracking-[-0.025em] text-[#767676] transition-colors hover:text-ink"
              >
                {l.label}
              </Link>
            </li>
          ))}
        </ul>

        <div className="flex shrink-0 items-center gap-1 lg:justify-self-end">
          <AuthLinks location="nav" />
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-controls="site-menu"
            aria-label={open ? "Close menu" : "Open menu"}
            className="-mr-2 ml-1 grid size-10 shrink-0 place-items-center rounded-full text-ink transition-colors hover:bg-ink-04 lg:hidden"
          >
            <svg viewBox="0 0 24 24" className="size-[22px]" fill="none" aria-hidden="true">
              {open ? (
                <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
              ) : (
                <path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
              )}
            </svg>
          </button>
        </div>
      </nav>

      {/* Height, not display: an animatable property, so the panel opens and
          shuts rather than appearing. */}
      <div
        id="site-menu"
        className={`grid overflow-hidden border-ink-08 transition-[grid-template-rows,border-width] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] lg:hidden ${
          open ? "grid-rows-[1fr] border-b" : "grid-rows-[0fr] border-b-0"
        }`}
      >
        <div className="min-h-0">
          <ul className="container-page flex flex-col py-2">
            {LINKS.map((l) => (
              <li key={l.href}>
                <Link
                  href={l.href}
                  onClick={() => setOpen(false)}
                  className="block py-3 font-display text-[1.05rem] tracking-[-0.025em] text-ink"
                >
                  {l.label}
                </Link>
              </li>
            ))}
            <li className="min-[420px]:hidden">
              <Link
                href="/signin"
                onClick={() => setOpen(false)}
                data-ev="cta_click"
                data-ev-location="nav-menu"
                data-ev-label="Log in"
                className="block py-3 font-display text-[1.05rem] tracking-[-0.025em] text-ink"
              >
                Log in
              </Link>
            </li>
          </ul>
        </div>
      </div>
    </header>
  );
}
