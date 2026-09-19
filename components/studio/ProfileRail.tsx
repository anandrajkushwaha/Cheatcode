import Link from "next/link";
import Image from "next/image";
import { BookIcon, BriefcaseIcon, HomeIcon } from "@/components/studio/icons";

const LINKS = [
  { href: "/studio", label: "My home", Icon: HomeIcon, exact: true },
  { href: "/studio/jobs", label: "Jobs", Icon: BriefcaseIcon },
  { href: "/studio/blogs", label: "Blogs", Icon: BookIcon },
];

/**
 * The left rail: who you are, and how complete that is.
 *
 * The ring is the honest version of the design's "95%". It is drawn from
 * profileStrength(), which weights what matching actually needs — the resume
 * and the target role are most of the score, a notice period is five points —
 * rather than counting filled boxes. A number that moves when you fill in
 * something useless teaches people the number is decoration.
 *
 * `nextGap` is the one thing worth doing next, taken from profileGaps(), so
 * "Complete profile" leads somewhere specific instead of dropping someone on
 * a form to hunt for what is missing.
 */
export function ProfileRail({
  name,
  headline,
  strength,
  nextGap,
  avatarUrl,
  pathname,
}: {
  name: string;
  headline: string | null;
  strength: number;
  nextGap: { label: string; href: string } | null;
  avatarUrl: string | null;
  pathname: string;
}) {
  const complete = strength >= 100;
  // 44px radius circle: circumference to drive the dash offset.
  const C = 2 * Math.PI * 34;

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-ink-08 bg-paper p-5 text-center">
        <div className="relative mx-auto size-[76px]">
          <svg viewBox="0 0 76 76" className="absolute inset-0 -rotate-90" aria-hidden>
            <circle cx="38" cy="38" r="34" fill="none" stroke="var(--color-ink-08)" strokeWidth="3" />
            <circle
              cx="38"
              cy="38"
              r="34"
              fill="none"
              stroke={complete ? "#16a34a" : "var(--color-sky-1)"}
              strokeWidth="3"
              strokeLinecap="round"
              strokeDasharray={C}
              strokeDashoffset={C * (1 - Math.min(100, Math.max(0, strength)) / 100)}
            />
          </svg>

          <span className="absolute inset-[7px] overflow-hidden rounded-full bg-ink-04">
            {avatarUrl ? (
              <Image src={avatarUrl} alt="" fill sizes="62px" className="object-cover" />
            ) : (
              <span className="flex size-full items-center justify-center text-[1.2rem] font-medium text-ink-50">
                {name.slice(0, 1).toUpperCase()}
              </span>
            )}
          </span>

          <span
            className={`absolute -bottom-1 left-1/2 -translate-x-1/2 rounded-full px-2 py-0.5 text-[0.65rem] font-semibold tabular-nums ${
              complete ? "bg-green-600 text-paper" : "bg-sky-1 text-paper"
            }`}
          >
            {strength}%
          </span>
        </div>

        <p className="mt-4 text-[0.95rem] font-semibold uppercase tracking-[0.02em] text-ink">
          {name}
        </p>
        {headline && (
          <p className="mt-1 text-[0.8rem] leading-snug text-ink-50">{headline}</p>
        )}

        {nextGap ? (
          <Link
            href={nextGap.href}
            className="mt-4 inline-block rounded-full bg-sky-1 px-5 py-2 text-[0.85rem] font-medium text-paper transition-opacity hover:opacity-90"
          >
            {nextGap.label}
          </Link>
        ) : (
          <p className="mt-4 text-[0.8rem] text-ink-30">Profile complete.</p>
        )}
      </section>

      <nav aria-label="Sections" className="rounded-2xl border border-ink-08 bg-paper p-2">
        <ul>
          {LINKS.map(({ href, label, Icon, exact }) => {
            const active = exact ? pathname === href : pathname.startsWith(href);
            return (
              <li key={href}>
                <Link
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={`flex items-center gap-3 rounded-xl px-4 py-2.5 text-[0.92rem] transition-colors ${
                    active ? "bg-ink-04 font-medium text-ink" : "text-ink-50 hover:text-ink"
                  }`}
                >
                  <Icon className="size-5 shrink-0" />
                  {label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
