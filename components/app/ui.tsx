import Link from "next/link";

/* ------------------------------------------------------------------ shell */

export function Card({
  title,
  note,
  action,
  children,
  className = "",
}: {
  title?: string;
  note?: string;
  action?: { label: string; href: string };
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`flex min-w-0 flex-col rounded-2xl border border-ink-08 p-6 ${className}`}>
      {title && (
        <div className="flex items-baseline justify-between gap-4">
          <h2 className="text-[0.72rem] font-medium uppercase tracking-[0.16em] text-ink-30">
            {title}
          </h2>
          {action && (
            <Link
              href={action.href}
              className="shrink-0 text-[0.75rem] text-ink-30 underline-offset-4 hover:text-ink hover:underline"
            >
              {action.label}
            </Link>
          )}
        </div>
      )}
      {note && <p className="mt-2 text-[0.8rem] leading-relaxed text-ink-30">{note}</p>}
      <div className={title ? "mt-5 flex-1" : "flex-1"}>{children}</div>
    </section>
  );
}

export function Stat({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div className="rounded-2xl border border-ink-08 p-5">
      <p className="text-[0.7rem] uppercase tracking-[0.14em] text-ink-30">{label}</p>
      <p className="mt-3 text-[1.85rem] font-semibold leading-none tracking-[-0.04em] tabular-nums">
        {value}
      </p>
      {hint && <p className="mt-2.5 text-[0.75rem] text-ink-30">{hint}</p>}
    </div>
  );
}

/* --------------------------------------------------------------- paywall */

/**
 * The gate every paid feature sits behind.
 *
 * Written now, while there is nothing to sell, because retrofitting a paywall
 * is how you end up with three different half-checks in three files. A feature
 * either renders or it explains what it costs — one component, one decision.
 *
 * This is presentation only. It hides a panel; it does not protect anything.
 * The server has to check the plan again before spending money on a Gemini
 * call, because a determined person can always render the page without it.
 */
export function PaidOnly({
  paid,
  feature,
  children,
}: {
  paid: boolean;
  feature: string;
  children: React.ReactNode;
}) {
  if (paid) return <>{children}</>;

  return (
    <div className="cc-premium-surface rounded-2xl border p-7 text-center">
      <p className="text-[0.72rem] uppercase tracking-[0.16em] text-paper/60">On the paid plan</p>
      <p className="mx-auto mt-3 max-w-[46ch] text-[0.95rem] leading-relaxed text-paper">{feature}</p>
      <Link
        href="/app/upgrade"
        className="mt-6 inline-block rounded-full bg-paper px-5 py-2.5 text-[0.85rem] font-semibold text-ink transition-transform hover:scale-[1.02]"
      >
        See the plan
      </Link>
    </div>
  );
}

/* ------------------------------------------------------------------ bits */

export function Empty({ children }: { children: React.ReactNode }) {
  return <p className="text-[0.88rem] leading-relaxed text-ink-30">{children}</p>;
}

export function ScoreRing({ score }: { score: number }) {
  const r = 34;
  const c = 2 * Math.PI * r;
  const filled = Math.max(0, Math.min(100, score)) / 100;

  return (
    <span className="relative inline-flex h-[86px] w-[86px] items-center justify-center">
      <svg width="86" height="86" viewBox="0 0 86 86" aria-hidden="true" className="-rotate-90">
        <circle cx="43" cy="43" r={r} fill="none" stroke="var(--color-ink-08)" strokeWidth="7" />
        <circle
          cx="43" cy="43" r={r} fill="none"
          stroke="var(--color-ink)" strokeWidth="7" strokeLinecap="round"
          strokeDasharray={`${c * filled} ${c}`}
        />
      </svg>
      <span className="absolute text-[1.3rem] font-semibold tabular-nums">{score}</span>
    </span>
  );
}

export function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-block rounded-full border border-ink-15 px-2.5 py-1 text-[0.75rem] text-ink-50">
      {children}
    </span>
  );
}

/* ------------------------------------------------------- loading surfaces */

/**
 * A block that is deliberately empty.
 *
 * Used in one place only: where real content is going to land. Shimmer that
 * never resolves is a lie told with animation, so every group of these carries
 * a label saying what it is waiting for and roughly when.
 */
export function Shimmer({ className = "" }: { className?: string }) {
  return <span className={`cc-shimmer block rounded-md ${className}`} aria-hidden="true" />;
}

/**
 * The shape a matched job will take, drawn before there are any.
 *
 * Worth building now rather than later: it fixes the card's proportions while
 * the columns are still cheap to move, and it shows the user what the page is
 * going to become instead of an apologetic paragraph.
 */
export function JobCardSkeleton({ delay = 0 }: { delay?: number }) {
  return (
    <div
      className="cc-rise rounded-2xl border border-ink-08 p-5"
      style={{ "--d": `${delay}ms` } as React.CSSProperties}
    >
      <div className="flex items-start gap-3.5">
        <Shimmer className="h-9 w-9 shrink-0 rounded-lg" />
        <div className="min-w-0 flex-1 space-y-2">
          <Shimmer className="h-3.5 w-[62%]" />
          <Shimmer className="h-3 w-[40%]" />
        </div>
        <Shimmer className="h-6 w-11 shrink-0 rounded-full" />
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <Shimmer className="h-5 w-16 rounded-full" />
        <Shimmer className="h-5 w-24 rounded-full" />
        <Shimmer className="h-5 w-14 rounded-full" />
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- headings */

export function SectionHead({
  title,
  note,
  action,
}: {
  title: string;
  note?: string;
  action?: { label: string; href: string };
}) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <div className="min-w-0">
        <h2 className="text-[1.02rem] font-semibold tracking-[-0.02em]">{title}</h2>
        {note && <p className="mt-1 text-[0.8rem] text-ink-30">{note}</p>}
      </div>
      {action && (
        <Link
          href={action.href}
          className="shrink-0 text-[0.8rem] text-ink-50 underline-offset-4 hover:text-ink hover:underline"
        >
          {action.label}
        </Link>
      )}
    </div>
  );
}

/** A quiet "not yet" marker. Says when, so it isn't a shrug. */
export function Soon({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-ink-15 px-2.5 py-1 text-[0.7rem] uppercase tracking-[0.12em] text-ink-30">
      <span className="h-1 w-1 rounded-full bg-ink-30" />
      {children}
    </span>
  );
}

/* ------------------------------------------------------------- completeness */

/**
 * Profile strength as a bar rather than a ring.
 *
 * A ring next to the ATS ring would make two circles compete for the same
 * glance, and these two numbers mean completely different things: one is a
 * verdict on a document, this is how much we know about a person.
 */
export function StrengthBar({ percent, label }: { percent: number; label: string }) {
  const p = Math.max(0, Math.min(100, Math.round(percent)));
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-[0.78rem] text-ink-50">{label}</span>
        <span className="text-[0.95rem] font-semibold tabular-nums">{p}%</span>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-ink-08">
        <div
          className="h-full rounded-full bg-ink transition-[width] duration-700 ease-out"
          style={{ width: `${p}%` }}
        />
      </div>
    </div>
  );
}
