import Link from "next/link";
import { ToolsMenu } from "@/components/site/ToolsMenu";
import { AuthLinks } from "@/components/site/AuthLinks";

/** Header for content pages. */
export function SiteHeader() {
  return (
    <header className="sticky top-0 z-50 border-b border-ink-08 bg-paper/85 backdrop-blur-xl backdrop-saturate-150">
      <nav
        className="container-page flex h-14 items-center justify-between gap-4"
        aria-label="Main"
      >
        <Link href="/" className="text-[0.95rem] font-semibold tracking-[-0.04em]">
          Cheatcode
        </Link>

        <ul className="hidden items-center gap-8 lg:flex">
          <li>
            <Link
              href="/blog"
              className="text-[0.8rem] text-ink-50 transition-colors hover:text-ink"
            >
              Guides
            </Link>
          </li>
          <li>
            <ToolsMenu />
          </li>
        </ul>

        <div className="flex items-center gap-2 sm:gap-3">
          {/* Same corner, same order, same breakpoint as the landing nav. */}
          <Link
            href="/become-a-mentor"
            data-ev="cta_click"
            data-ev-location="content-nav"
            data-ev-label="Become a mentor"
            className="hidden whitespace-nowrap text-[0.78rem] text-ink-50 transition-colors hover:text-ink sm:inline sm:rounded-full sm:border sm:border-ink-15 sm:px-4 sm:py-2 sm:text-[0.8rem] sm:text-ink sm:hover:border-ink-30"
          >
            Become a mentor
          </Link>
          <AuthLinks location="content-nav" />
        </div>
      </nav>
    </header>
  );
}
