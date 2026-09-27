import Link from "next/link";
import { AuthLinks } from "./AuthLinks";

/**
 * The header, as drawn in Figma (node 165:4080).
 *
 * Solid white rather than the transparent bar that faded in on scroll: the
 * hero behind it is now a photograph, and white type over a sunset is a
 * contrast problem that changes with every scroll position.
 *
 * Three links, centred. "Become a mentor" is not in the design and has been
 * taken out of the header — it still has its own page and a footer link.
 */
const LINKS = [
  { href: "/tools", label: "Free tools" },
  // There is no public insights index yet; the reader lives inside the app.
  { href: "/app/insights", label: "Insights" },
  { href: "/blog", label: "Blogs" },
];

export function Nav() {
  return (
    <header className="sticky top-0 z-50 bg-paper">
      <nav
        className="container-page grid h-[4.5rem] grid-cols-[1fr_auto_1fr] items-center gap-4"
        aria-label="Main"
      >
        <Link
          href="/"
          className="justify-self-start font-display text-[1.45rem] font-medium tracking-[-0.025em] text-black sm:text-[1.7rem]"
        >
          Cheatcode
        </Link>

        <ul className="hidden items-center gap-[10px] justify-self-center lg:flex">
          {LINKS.map((link) => (
            <li key={link.href}>
              <Link
                href={link.href}
                className="block px-5 py-[5px] font-display text-[1.01rem] tracking-[-0.025em] text-[#767676] transition-colors hover:text-ink"
              >
                {link.label}
              </Link>
            </li>
          ))}
        </ul>

        <div className="flex items-center gap-1 justify-self-end">
          <AuthLinks location="nav" />
        </div>
      </nav>
    </header>
  );
}
