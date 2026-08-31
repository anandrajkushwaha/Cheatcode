import Link from "next/link";
import type { Profile, Resume } from "@/lib/app/account";

/**
 * The left rail's identity card.
 *
 * Everything a job site puts here is answering one question — "does this thing
 * know who I am yet?" — so the completeness number belongs on the face, not in
 * a bar underneath it. The ring reads at a glance; the two stats below it are
 * the only numbers we can honestly show today, and both are links, because a
 * number you cannot act on is decoration.
 */
export function ProfileCard({
  profile,
  resume,
  strength,
  nextStep,
}: {
  profile: Profile | null;
  resume: Resume | null;
  strength: number;
  nextStep: string | null;
}) {
  // Null, not a placeholder: a nameless account must not end up with the
  // initials of the words "Your profile" stamped on its avatar.
  const realName = profile?.full_name?.trim() || null;
  const name = realName ?? "Your profile";
  const subtitle =
    profile?.headline?.trim() ||
    [profile?.current_title ?? resume?.latest_title, profile?.current_company ?? resume?.latest_company]
      .filter(Boolean)
      .join(" @ ") ||
    "Add a headline";

  return (
    <div className="overflow-hidden rounded-2xl border border-ink-08 bg-paper">
      {/* ------------------------------------------------------------ face */}
      <div className="cc-tint px-5 pb-5 pt-6 text-center">
        <Avatar name={realName} url={profile?.avatar_url ?? null} percent={strength} />

        <p className="mt-3.5 truncate text-[0.98rem] font-semibold tracking-[-0.02em]">{name}</p>
        <p className="mt-1 line-clamp-2 text-[0.82rem] leading-relaxed text-ink-50">{subtitle}</p>

        {/* Only once they have actually filled something in. "Updated 3d ago"
            on an empty profile is noise pretending to be information. */}
        {profile?.onboarded_at && profile.updated_at && (
          <p className="mt-1.5 text-[0.74rem] text-ink-30">Updated {ago(profile.updated_at)}</p>
        )}

        <Link
          href="/app/profile"
          className="mt-4 block rounded-full bg-ink py-2.5 text-[0.84rem] font-medium text-paper transition-transform hover:scale-[1.015] active:scale-[0.99]"
        >
          {strength >= 85 ? "Edit profile" : "Complete profile"}
        </Link>

        {nextStep && strength < 85 && (
          <p className="mt-2.5 text-[0.74rem] leading-relaxed text-ink-50">Next: {nextStep}</p>
        )}
      </div>

      {/* ----------------------------------------------------------- stats */}
      <div className="grid grid-cols-2 divide-x divide-ink-08 border-y border-ink-08">
        <StatCell
          href="/app/resume"
          label="ATS score"
          value={resume?.ats_score ?? null}
          empty="Add resume"
        />
        <StatCell
          href="/app/resume"
          label="Skills read"
          value={resume?.skills?.length ? resume.skills.length : null}
          empty="—"
        />
      </div>

      {/* ------------------------------------------------------------- nav */}
      <nav className="p-2">
        {NAV.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-[0.88rem] text-ink-70 transition-colors hover:bg-ink-04 hover:text-ink"
          >
            <span className="text-ink-30">{item.icon}</span>
            <span className="flex-1">{item.label}</span>
            <Chevron />
          </Link>
        ))}
      </nav>
    </div>
  );
}

/* ----------------------------------------------------------------- avatar */

/**
 * Avatar inside a completeness ring.
 *
 * The ring is a gradient rather than flat ink because a plain dark arc on a
 * pale track looks like a loading spinner frozen mid-spin. It runs deep
 * blue out to pale sky, so it reads as one lit edge — dark enough at the
 * start that the meter is still legible against the wash behind it.
 * Gold stays off limits here — that colour is spoken for by the paid plan.
 */
function Avatar({ name, url, percent }: { name: string | null; url: string | null; percent: number }) {
  const p = Math.max(0, Math.min(100, Math.round(percent)));
  const r = 33;
  const c = 2 * Math.PI * r;

  return (
    <span className="relative inline-grid h-[78px] w-[78px] place-items-center">
      <svg width="78" height="78" viewBox="0 0 78 78" aria-hidden="true" className="absolute -rotate-90">
        <defs>
          <linearGradient id="strength" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="var(--color-sky-4)" />
            <stop offset="52%" stopColor="var(--color-sky-1)" />
            <stop offset="100%" stopColor="var(--color-sky-2)" />
          </linearGradient>
        </defs>
        <circle cx="39" cy="39" r={r} fill="none" stroke="var(--color-ink-08)" strokeWidth="3" />
        {/* At zero a round cap would still paint a dot, which reads as 1%. */}
        {p > 0 && (
          <circle
            cx="39"
            cy="39"
            r={r}
            fill="none"
            stroke="url(#strength)"
            strokeWidth="3"
            strokeLinecap="round"
            strokeDasharray={`${(c * p) / 100} ${c}`}
          />
        )}
      </svg>

      {/* Initials sit underneath and the photo covers them. If Google's CDN is
          blocked or the URL has expired the image simply fails to paint and
          the initials show through — a fallback with no JavaScript and no
          flash of the wrong thing. */}
      <span className="relative grid h-[58px] w-[58px] place-items-center overflow-hidden rounded-full bg-ink">
        <span className="text-[1.1rem] font-semibold text-paper">
          {name ? initials(name) : <IconPerson />}
        </span>
        {url && (
          // A plain img on purpose: one small avatar from a third-party CDN,
          // which the image optimiser would need whitelisted for no gain.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={url}
            alt=""
            referrerPolicy="no-referrer"
            className="absolute inset-0 h-full w-full object-cover"
          />
        )}
      </span>

      <span className="absolute -bottom-1 rounded-full border border-ink-08 bg-paper px-2 py-0.5 text-[0.68rem] font-semibold tabular-nums shadow-[0_1px_2px_rgb(0_0_0/0.05)]">
        {p}%
      </span>
    </span>
  );
}

/* ------------------------------------------------------------------ stats */

function StatCell({
  href,
  label,
  value,
  empty,
}: {
  href: string;
  label: string;
  value: number | null;
  empty: string;
}) {
  return (
    <Link href={href} className="group px-4 py-3.5 transition-colors hover:bg-ink-04">
      <p className="text-[0.7rem] uppercase tracking-[0.12em] text-ink-30">{label}</p>
      <p className="mt-1 text-[1.15rem] font-semibold leading-none tabular-nums">
        {value ?? <span className="text-[0.8rem] font-normal text-ink-30">{empty}</span>}
      </p>
    </Link>
  );
}

/* -------------------------------------------------------------------- bits */

const NAV = [
  { href: "/app/resume", label: "Resume", icon: <IconDoc /> },
  { href: "/app/jobs", label: "Jobs", icon: <IconBriefcase /> },
  { href: "/app/agent", label: "Agent", icon: <IconSpark /> },
  { href: "/app/profile", label: "Preferences", icon: <IconSliders /> },
];

function initials(name: string): string {
  const parts = name.split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  return (
    (parts[0][0] ?? "") + (parts.length > 1 ? (parts[parts.length - 1][0] ?? "") : "")
  ).toUpperCase();
}

/** Shown when we do not know the name yet. Better than a guessed letter. */
function IconPerson() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="8.6" r="3.6" {...stroke} />
      <path d="M4.8 20a7.2 7.2 0 0 1 14.4 0" {...stroke} />
    </svg>
  );
}

/** "3 days ago" beats a date nobody converts in their head. */
function ago(iso: string): string {
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return "recently";
  const mins = Math.floor((Date.now() - then) / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(then).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

const stroke = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.5,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

function IconDoc() {
  return (
    <svg width="17" height="17" viewBox="0 0 20 20" aria-hidden="true">
      <path d="M5 2.75h6.5L16 7.25v10a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-13.5a1 1 0 0 1 1-1Z" {...stroke} />
      <path d="M11.25 2.9v4.35H15.6M7 11.5h6M7 14.5h4" {...stroke} />
    </svg>
  );
}

function IconBriefcase() {
  return (
    <svg width="17" height="17" viewBox="0 0 20 20" aria-hidden="true">
      <rect x="2.75" y="6.25" width="14.5" height="10.5" rx="1.6" {...stroke} />
      <path d="M7.25 6.25V4.9a1.4 1.4 0 0 1 1.4-1.4h2.7a1.4 1.4 0 0 1 1.4 1.4v1.35M2.75 10.5h14.5" {...stroke} />
    </svg>
  );
}

function IconSpark() {
  return (
    <svg width="17" height="17" viewBox="0 0 20 20" aria-hidden="true">
      <path d="M10 2.6c.9 4 2.5 5.6 6.5 6.5-4 .9-5.6 2.5-6.5 6.5-.9-4-2.5-5.6-6.5-6.5 4-.9 5.6-2.5 6.5-6.5Z" {...stroke} />
      <path d="M15.6 14.2c.35 1.5.95 2.1 2.4 2.45-1.45.35-2.05.95-2.4 2.45-.35-1.5-.95-2.1-2.4-2.45 1.45-.35 2.05-.95 2.4-2.45Z" {...stroke} />
    </svg>
  );
}

function IconSliders() {
  return (
    <svg width="17" height="17" viewBox="0 0 20 20" aria-hidden="true">
      <path d="M3 6h9M15.5 6H17M3 14h3M9.5 14H17" {...stroke} />
      <circle cx="13.6" cy="6" r="2.1" {...stroke} />
      <circle cx="7.6" cy="14" r="2.1" {...stroke} />
    </svg>
  );
}

function Chevron() {
  return (
    <svg width="14" height="14" viewBox="0 0 20 20" aria-hidden="true" className="text-ink-15">
      <path d="M7.75 4.5 13 10l-5.25 5.5" {...stroke} />
    </svg>
  );
}
