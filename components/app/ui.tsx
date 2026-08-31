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
    <div className="rounded-2xl border border-dashed border-ink-15 p-7 text-center">
      <p className="text-[0.72rem] uppercase tracking-[0.16em] text-ink-30">On the paid plan</p>
      <p className="mx-auto mt-3 max-w-[46ch] text-[0.95rem] leading-relaxed">{feature}</p>
      <Link
        href="/app/upgrade"
        className="mt-6 inline-block rounded-full bg-ink px-5 py-2.5 text-[0.85rem] font-medium text-paper"
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
