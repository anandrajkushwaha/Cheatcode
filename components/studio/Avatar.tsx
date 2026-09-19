/**
 * An avatar that cannot break.
 *
 * The trick, borrowed from ProfileCard because it is the right one: the
 * initials are painted first and the photo is laid over them. If the photo
 * fails — Google's CDN blocked, an expired URL, a profile with no picture —
 * nothing renders on top and the initials simply show through. No JavaScript,
 * no onError handler, no flash of a broken-image glyph.
 *
 * A plain img rather than next/image, also on purpose. next.config allowlists
 * our own Supabase storage and nothing else, so a Google avatar through the
 * optimiser is exactly the broken icon this replaces — and widening that
 * allowlist to every avatar host would turn our image endpoint into an open
 * proxy for one small picture's worth of gain.
 */

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function Avatar({
  name,
  url,
  size = 36,
  className = "",
}: {
  name: string;
  url: string | null;
  size?: number;
  className?: string;
}) {
  return (
    <span
      className={`relative grid shrink-0 place-items-center overflow-hidden rounded-full bg-ink ${className}`}
      style={{ width: size, height: size }}
    >
      <span
        className="font-semibold text-paper"
        style={{ fontSize: Math.max(11, Math.round(size * 0.36)) }}
      >
        {initials(name)}
      </span>
      {url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={url}
          alt=""
          referrerPolicy="no-referrer"
          className="absolute inset-0 h-full w-full object-cover"
        />
      )}
    </span>
  );
}

/**
 * The same avatar with the completeness ring around it.
 *
 * The percentage sits below the ring rather than on it. On the ring it landed
 * on top of the stroke it was describing, which is how the card read as
 * broken rather than as informative.
 */
export function AvatarWithRing({
  name,
  url,
  percent,
}: {
  name: string;
  url: string | null;
  percent: number;
}) {
  const p = Math.max(0, Math.min(100, Math.round(percent)));
  const r = 33;
  const c = 2 * Math.PI * r;

  return (
    <span className="relative inline-grid size-[78px] place-items-center">
      <svg
        width="78"
        height="78"
        viewBox="0 0 78 78"
        aria-hidden="true"
        className="absolute -rotate-90"
      >
        <defs>
          <linearGradient id="studio-strength" x1="0" y1="0" x2="1" y2="1">
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
            stroke="url(#studio-strength)"
            strokeWidth="3"
            strokeLinecap="round"
            strokeDasharray={`${(c * p) / 100} ${c}`}
          />
        )}
      </svg>

      <Avatar name={name} url={url} size={58} />
    </span>
  );
}
