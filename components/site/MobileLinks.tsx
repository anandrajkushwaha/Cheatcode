import Link from "next/link";

/**
 * The nav, for phones.
 *
 * The links in the header are hidden below `lg`, and there was no menu behind
 * them — so on a phone the only way to the free tools was the footer, three
 * screens down. Most of the traffic is phones, and most of it arrives from an
 * ad onto one page. A row of the four places worth going, scrolling sideways
 * under the header, is smaller than a hamburger and needs no tap to open.
 */
const LINKS = [
  { href: "/tools/resume-ats-checker", label: "ATS checker" },
  { href: "/tools/in-hand-salary-calculator", label: "Salary calculator" },
  { href: "/blog", label: "Guides" },
  { href: "/tools", label: "All free tools" },
];

export function MobileLinks() {
  return (
    <div className="border-b border-ink-08 bg-paper/85 lg:hidden">
      <div className="container-page flex gap-5 overflow-x-auto py-2.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {LINKS.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className="whitespace-nowrap py-1 text-[0.8rem] text-ink-50 transition-colors hover:text-ink"
          >
            {l.label}
          </Link>
        ))}
      </div>
    </div>
  );
}
