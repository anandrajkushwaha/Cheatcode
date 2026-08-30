import Link from "next/link";

/* ------------------------------------------------------------------ format */

export const num = (n: number | null | undefined) =>
  n === null || n === undefined ? "—" : n.toLocaleString("en-IN");

export function duration(seconds: number | null | undefined) {
  if (!seconds || seconds < 1) return "—";
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return m === 0 ? `${s}s` : `${m}m ${s.toString().padStart(2, "0")}s`;
}

export function rupees(n: number | null | undefined) {
  if (n === null || n === undefined) return "—";
  if (n >= 1e5) return `₹${(n / 1e5).toFixed(1).replace(/\.0$/, "")} L`;
  return `₹${n.toLocaleString("en-IN")}`;
}

/* -------------------------------------------------------------------- shell */

/**
 * Every block on the dashboard is one of these, so the page reads as a set of
 * equal cards rather than a stack of loose headings at different weights.
 */
export function Panel({
  title,
  note,
  action,
  children,
  className = "",
}: {
  title: string;
  note?: string;
  action?: { label: string; href: string };
  children: React.ReactNode;
  className?: string;
}) {
  // min-w-0 matters: as a grid item this box defaults to min-width:auto, so a
  // long article title inside would push the whole page sideways rather than
  // truncating.
  return (
    <section className={`flex min-w-0 flex-col rounded-2xl border border-ink-08 p-6 ${className}`}>
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
      {note && <p className="mt-2 text-[0.78rem] leading-relaxed text-ink-30">{note}</p>}
      <div className="mt-5 flex-1">{children}</div>
    </section>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <p className="text-[0.85rem] leading-relaxed text-ink-30">{children}</p>;
}

/* --------------------------------------------------------------------- stat */

function Delta({ now, before }: { now: number; before: number }) {
  // No baseline means no claim. Showing "+100%" against zero is noise.
  if (!before) {
    return <span className="text-[0.75rem] text-ink-30">no previous period</span>;
  }
  const pct = Math.round(((now - before) / before) * 100);
  const flat = Math.abs(pct) < 1;
  return (
    <span className="inline-flex items-center gap-1.5 text-[0.75rem] text-ink-50">
      <span aria-hidden="true" className={flat ? "text-ink-30" : "text-ink"}>
        {flat ? "→" : pct > 0 ? "↑" : "↓"}
      </span>
      <span className="tabular-nums">
        {flat ? "flat" : `${Math.abs(pct)}%`}
      </span>
      <span className="text-ink-30">vs previous</span>
    </span>
  );
}

export function Stat({
  label,
  value,
  hint,
  now,
  before,
}: {
  label: string;
  value: string | number;
  hint?: string;
  now?: number;
  before?: number;
}) {
  return (
    <div className="rounded-2xl border border-ink-08 p-5">
      <p className="text-[0.7rem] uppercase tracking-[0.14em] text-ink-30">{label}</p>
      <p className="mt-3 text-[1.85rem] font-semibold leading-none tracking-[-0.04em] tabular-nums">
        {typeof value === "number" ? num(value) : value}
      </p>
      <div className="mt-2.5 min-h-[1.1rem]">
        {now !== undefined && before !== undefined ? (
          <Delta now={now} before={before} />
        ) : hint ? (
          <span className="text-[0.75rem] text-ink-30">{hint}</span>
        ) : null}
      </div>
    </div>
  );
}

/* ----------------------------------------------------------------- bar list */

export function BarList({
  rows,
  empty,
  unit,
}: {
  rows: { label: string; value: number; sub?: string; href?: string }[];
  empty: string;
  unit?: string;
}) {
  if (rows.length === 0) return <Empty>{empty}</Empty>;
  const max = Math.max(1, ...rows.map((r) => r.value));

  return (
    <ul className="space-y-2">
      {rows.map((r) => (
        <li key={r.label} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
          <span className="min-w-0">
            {/* The bar sits behind the label rather than beside it, so a long
                page path never squeezes the bar down to nothing. */}
            <span className="relative block overflow-hidden rounded-md px-2.5 py-1.5">
              <span
                aria-hidden="true"
                className="absolute inset-y-0 left-0 rounded-md bg-ink-08"
                style={{ width: `${(r.value / max) * 100}%` }}
              />
              <span className="relative block truncate text-[0.82rem]">
                {r.href ? (
                  <Link href={r.href} className="underline-offset-4 hover:underline">
                    {r.label}
                  </Link>
                ) : (
                  r.label
                )}
                {r.sub && <span className="ml-2 text-ink-30">{r.sub}</span>}
              </span>
            </span>
          </span>
          <span className="shrink-0 text-right text-[0.8rem] tabular-nums text-ink-50">
            {num(r.value)}
            {unit && <span className="ml-1 text-ink-30">{unit}</span>}
          </span>
        </li>
      ))}
    </ul>
  );
}

/* -------------------------------------------------------------------- chart */

type Point = { day: string; views: number; users: number };

/**
 * Views and unique people over time.
 *
 * Two series on one grid rather than two charts: the gap between them is the
 * reading, not either line alone. Views far above people means a few readers
 * going deep; the two lines converging means lots of visitors bouncing on one
 * page. A bar chart could not show that.
 */
export function TrendChart({ points }: { points: Point[] }) {
  if (points.length < 2) {
    return <Empty>Not enough days yet to draw a trend.</Empty>;
  }

  const W = 720;
  const H = 200;
  // The right pad has to clear half of the last date label, or it gets cut off
  // at the edge of the viewBox.
  const PAD = { top: 12, right: 22, bottom: 26, left: 34 };
  const iw = W - PAD.left - PAD.right;
  const ih = H - PAD.top - PAD.bottom;

  const peak = Math.max(1, ...points.map((p) => p.views));
  // Round the ceiling up to something a human reads as a round number.
  const step = Math.pow(10, Math.floor(Math.log10(peak))) / 2 || 1;
  const top = Math.ceil(peak / step) * step;

  const x = (i: number) => PAD.left + (i / (points.length - 1)) * iw;
  const y = (v: number) => PAD.top + ih - (v / top) * ih;

  const line = (key: "views" | "users") =>
    points.map((p, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(p[key]).toFixed(1)}`).join(" ");

  const area =
    `${line("views")} L${x(points.length - 1).toFixed(1)},${PAD.top + ih} ` +
    `L${x(0).toFixed(1)},${PAD.top + ih} Z`;

  const ticks = [0, top / 2, top];
  // At most eight date labels, however long the window is.
  const labelEvery = Math.max(1, Math.ceil(points.length / 8));

  return (
    <div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        role="img"
        aria-label="Page views and unique people per day"
      >
        {ticks.map((t) => (
          <g key={t}>
            <line
              x1={PAD.left}
              x2={W - PAD.right}
              y1={y(t)}
              y2={y(t)}
              stroke="var(--color-ink-08)"
              strokeWidth="1"
            />
            <text
              x={PAD.left - 7}
              y={y(t) + 3.5}
              textAnchor="end"
              className="fill-[var(--color-ink-30)] text-[9px] tabular-nums"
            >
              {Math.round(t)}
            </text>
          </g>
        ))}

        <path d={area} fill="var(--color-ink-04)" />
        <path d={line("views")} fill="none" stroke="var(--color-ink)" strokeWidth="1.75" />
        <path
          d={line("users")}
          fill="none"
          stroke="var(--color-ink-30)"
          strokeWidth="1.5"
          strokeDasharray="3 3"
        />

        {points.map((p, i) => (
          <g key={p.day}>
            <circle cx={x(i)} cy={y(p.views)} r="2.5" fill="var(--color-ink)" />
            {/* One string, not several children: React cannot hydrate an SVG
                <title> that the server rendered as multiple text nodes. */}
            <title>{`${p.day}: ${p.views} views · ${p.users} people`}</title>
            {i % labelEvery === 0 && (
              <text
                x={x(i)}
                y={H - 8}
                textAnchor="middle"
                className="fill-[var(--color-ink-30)] text-[9px]"
              >
                {p.day.slice(8)}/{p.day.slice(5, 7)}
              </text>
            )}
          </g>
        ))}
      </svg>

      <div className="mt-3 flex gap-5 text-[0.75rem] text-ink-50">
        <span className="inline-flex items-center gap-2">
          <span aria-hidden="true" className="h-0.5 w-5 rounded bg-ink" />
          Page views
        </span>
        <span className="inline-flex items-center gap-2">
          <span
            aria-hidden="true"
            className="h-0 w-5 border-t-2 border-dashed border-ink-30"
          />
          Unique people
        </span>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------- funnel */

export type FunnelStep = { label: string; value: number; note?: string };

/**
 * The reader-to-signup steps.
 *
 * The earlier version drew a bar under every step. The bars were the problem:
 * the steps are not strictly nested — you can see a CTA without opening a tool —
 * so bar lengths implied a funnel shape that does not exist, and told you
 * nothing a number could not. What is actually worth knowing is the drop
 * between one step and the next, so that is what this shows, in words.
 */
export function FunnelChart({ steps }: { steps: FunnelStep[] }) {
  const first = steps[0]?.value ?? 0;
  if (!first) return <Empty>No sessions recorded in this window yet.</Empty>;

  return (
    <ol className="divide-y divide-ink-08 border-t border-ink-08">
      {steps.map((s, i) => {
        const prev = i === 0 ? null : steps[i - 1].value;
        // Only a genuine subset of the step above can have a drop-off.
        const nested = prev !== null && prev > 0 && s.value <= prev;
        const dropped = nested ? prev! - s.value : null;
        const share = Math.round((s.value / first) * 100);

        return (
          <li key={s.label} className="flex flex-wrap items-baseline gap-x-4 gap-y-1 py-3">
            <span className="min-w-0 flex-1 text-[0.88rem]">
              {s.label}
              {s.note && <span className="ml-2 text-[0.75rem] text-ink-30">{s.note}</span>}
            </span>

            <span className="w-16 shrink-0 text-right text-[1.05rem] font-medium tabular-nums">
              {num(s.value)}
            </span>

            <span className="w-14 shrink-0 text-right text-[0.8rem] tabular-nums text-ink-50">
              {i === 0 ? "" : `${share}%`}
            </span>

            <span className="w-[11rem] shrink-0 text-right text-[0.78rem] text-ink-30">
              {dropped === null
                ? i === 0
                  ? "everyone"
                  : "not a subset of the step above"
                : dropped === 0
                  ? "no drop-off"
                  : `${num(dropped)} dropped off here`}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

/* --------------------------------------------------------------- donut-ish */

/**
 * A two-part split (new vs returning, mobile vs desktop). A single stacked bar
 * beats a pie here: it is readable at this size and stays legible in one colour.
 */
export function SplitBar({
  parts,
}: {
  parts: { label: string; value: number }[];
}) {
  const total = parts.reduce((a, p) => a + p.value, 0);
  if (!total) return <Empty>Nothing recorded yet.</Empty>;

  return (
    <div>
      <div className="flex h-3 overflow-hidden rounded-full">
        {parts.map((p, i) => (
          <div
            key={p.label}
            className={i === 0 ? "bg-ink" : i === 1 ? "bg-ink-30" : "bg-ink-15"}
            style={{ width: `${(p.value / total) * 100}%` }}
          />
        ))}
      </div>
      <ul className="mt-4 space-y-2">
        {parts.map((p, i) => (
          <li key={p.label} className="flex items-center gap-2.5 text-[0.82rem]">
            <span
              aria-hidden="true"
              className={`h-2.5 w-2.5 shrink-0 rounded-full ${
                i === 0 ? "bg-ink" : i === 1 ? "bg-ink-30" : "bg-ink-15"
              }`}
            />
            <span className="flex-1">{p.label}</span>
            <span className="tabular-nums text-ink-50">{num(p.value)}</span>
            <span className="w-10 text-right tabular-nums text-ink-30">
              {Math.round((p.value / total) * 100)}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
