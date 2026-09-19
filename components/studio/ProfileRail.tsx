import Link from "next/link";
import { AvatarWithRing } from "@/components/studio/Avatar";
import { BookIcon, BriefcaseIcon, HomeIcon } from "@/components/studio/icons";

const LINKS = [
  { href: "/studio", label: "My home", Icon: HomeIcon, exact: true },
  { href: "/studio/jobs", label: "Jobs", Icon: BriefcaseIcon },
  { href: "/studio/blogs", label: "Blogs", Icon: BookIcon },
];

/**
 * The left rail: who you are, and how complete that is.
 *
 * The ring is drawn from profileStrength(), which weights what matching
 * actually needs — the resume and the target role are most of the score, a
 * notice period is five points — rather than counting filled boxes. A number
 * that moves when you fill in something useless teaches people to ignore it.
 *
 * `nextGap` is the one thing worth doing next, from profileGaps(), so the
 * button lands on the specific screen that closes it rather than dropping
 * somebody on a form to hunt for what is missing.
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
  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-ink-08 bg-paper px-5 py-6 text-center">
        <AvatarWithRing name={name} url={avatarUrl} percent={strength} />

        <p className="mt-3 text-[0.72rem] font-medium tabular-nums text-ink-30">
          {Math.round(strength)}% complete
        </p>

        <p className="mt-2 text-[0.95rem] font-semibold leading-snug tracking-[-0.01em] text-ink">
          {name}
        </p>

        {headline && (
          // Two lines is the ceiling. A long title used to run to four and
          // push the button out of the card's optical centre.
          <p className="mt-1.5 line-clamp-2 text-[0.8rem] leading-snug text-ink-50">
            {headline}
          </p>
        )}

        {nextGap ? (
          <Link
            href={nextGap.href}
            className="mt-5 inline-block rounded-full bg-sky-1 px-5 py-2 text-[0.85rem] font-medium text-paper transition-opacity hover:opacity-90"
          >
            {nextGap.label}
          </Link>
        ) : (
          <p className="mt-5 text-[0.8rem] text-ink-30">Profile complete.</p>
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
