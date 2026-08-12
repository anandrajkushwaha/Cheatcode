import Link from "next/link";

/** Header for content pages. Static — no client JS needed. */
export function SiteHeader() {
  return (
    <header className="sticky top-0 z-50 border-b border-ink-08 bg-paper/85 backdrop-blur-xl backdrop-saturate-150">
      <nav
        className="container-page flex h-14 items-center justify-between"
        aria-label="Main"
      >
        <Link href="/" className="text-[0.95rem] font-semibold tracking-[-0.04em]">
          Cheatcode
        </Link>

        <ul className="hidden items-center gap-8 md:flex">
          <li>
            <Link
              href="/blog"
              className="text-[0.8rem] text-ink-50 transition-colors hover:text-ink"
            >
              Guides
            </Link>
          </li>
          <li>
            <Link
              href="/tools/in-hand-salary-calculator"
              className="text-[0.8rem] text-ink-50 transition-colors hover:text-ink"
            >
              Salary calculator
            </Link>
          </li>
        </ul>

        <Link
          href="/#waitlist"
          className="rounded-full bg-ink px-4 py-2 text-[0.8rem] font-medium text-paper transition-transform duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] hover:scale-[1.03] active:scale-[0.97]"
        >
          Get early access
        </Link>
      </nav>
    </header>
  );
}
