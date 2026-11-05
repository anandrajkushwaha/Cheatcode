"use client";

import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { smoothPath } from "@/lib/admin/smooth";

export { smoothPath };

/**
 * The Dashboard's charts, drawn as plain SVG — no chart library to load.
 *
 *   KpiCard      a number, its change against the period before, and a
 *                sparkline of the period
 *   MetricChart  one big area chart with a metric switch above it and a
 *                hover crosshair that reads out the exact day's value
 */

export const ACCENT = "#9be15d";
/** The line itself: a deep green that reads on the light lime fill. */
const LINE = "#3f8f1f";

const fmt = (n: number, money = false) =>
  money
    ? `₹${Math.round(n).toLocaleString("en-IN")}`
    : Math.round(n).toLocaleString("en-IN");

function change(
  now: number,
  before: number,
): { text: string; up: boolean | null } {
  if (before === 0)
    return now === 0
      ? { text: "no change", up: null }
      : { text: "new", up: true };
  const pct = Math.round(((now - before) / before) * 100);
  if (pct === 0) return { text: "0%", up: null };
  return { text: `${pct > 0 ? "+" : ""}${pct}%`, up: pct > 0 };
}

export function Sparkline({ series, className = "", dark = false }: { series: number[]; className?: string; dark?: boolean }) {
  const id = useId();
  const max = Math.max(1, ...series);
  const w = 100;
  const h = 32;
  const pts = series.map((v, i) => [series.length === 1 ? w : (i / (series.length - 1)) * w, h - (v / max) * (h - 4) - 2] as [number, number]);
  const line = smoothPath(pts, 1, h - 1);
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className={`h-8 w-full ${className}`} aria-hidden="true">
      <defs>
        <linearGradient id={id} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor={ACCENT} stopOpacity="0.45" />
          <stop offset="1" stopColor={ACCENT} stopOpacity="0" />
        </linearGradient>
      </defs>
      {pts.length > 1 && <path d={`${line} L${w},${h} L0,${h} Z`} fill={`url(#${id})`} />}
      <path d={line} fill="none" stroke={dark ? ACCENT : LINE} strokeWidth="1.5" vectorEffect="non-scaling-stroke" strokeLinecap="round" />
    </svg>
  );
}

export function KpiCard({
  label,
  now,
  before,
  series,
  money = false,
  hint,
  dark = false,
  beforeWord = "before",
}: {
  label: string;
  now: number;
  /** Leave out for "All time": no earlier period, so no change pill. */
  before?: number;
  series: number[];
  money?: boolean;
  hint?: string;
  dark?: boolean;
  /** How the comparison period reads: "yesterday", "the 7 days before". */
  beforeWord?: string;
}) {
  const c = before === undefined ? null : change(now, before);
  return (
    <div
      className={`flex min-w-0 flex-col justify-between rounded-[1.25rem] p-4 transition-shadow sm:p-5 hover:shadow-[0_12px_30px_-18px_rgba(0,0,0,0.25)] ${
        dark ? "bg-ink text-paper" : "bg-paper"
      }`}
    >
      <p
        className={`text-[0.8rem] leading-snug ${dark ? "text-paper/70" : "text-ink-50"}`}
      >
        {label}
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1">
        <p className="text-[1.9rem] font-semibold leading-none tracking-[-0.04em] tabular-nums">
          {fmt(now, money)}
        </p>
        {c && (
        <span
          className={`whitespace-nowrap rounded-full px-2 py-0.5 text-[0.7rem] font-medium tabular-nums ${
            c.up === null
              ? dark
                ? "bg-paper/10 text-paper/70"
                : "bg-ink-04 text-ink-50"
              : c.up
                ? "bg-[#e7f6ec] text-[#14532d]"
                : "bg-[#fdecec] text-[#9b1c1c]"
          }`}
        >
          {c.up === true ? "↑ " : c.up === false ? "↓ " : ""}
          {c.text}
        </span>
        )}
      </div>
      <p
        className={`mt-1.5 text-[0.72rem] ${dark ? "text-paper/50" : "text-ink-30"}`}
      >
        {hint ?? (before === undefined ? "\u00a0" : `vs ${fmt(before, money)} ${beforeWord}`)}
      </p>
      <Sparkline series={series} dark={dark} className="mt-3" />
    </div>
  );
}

/** `total`: the period's figure when it is not the sum of the buckets (unique visitors). */
export type Metric = {
  id: string;
  label: string;
  series: number[];
  money?: boolean;
  total?: number;
};

/** Animates between two arrays of the same length (0–1 values) over `ms`. */
function useTween(target: number[], ms = 420): number[] {
  const [shown, setShown] = useState(target);
  const from = useRef(target);
  const raf = useRef<number | null>(null);
  const key = target.join(",");
  useEffect(() => {
    const start = performance.now();
    const a = from.current.length === target.length ? from.current : target.map(() => 0);
    const step = (now: number) => {
      const p = Math.min(1, (now - start) / ms);
      const e = 1 - Math.pow(1 - p, 3);
      const next = target.map((v, i) => a[i] + (v - a[i]) * e);
      from.current = next;
      setShown(next);
      if (p < 1) raf.current = requestAnimationFrame(step);
    };
    raf.current = requestAnimationFrame(step);
    return () => {
      if (raf.current) cancelAnimationFrame(raf.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, ms]);
  return shown;
}

export function MetricChart({ labels, metrics }: { labels: string[]; metrics: Metric[] }) {
  const [active, setActive] = useState(metrics[0]?.id);
  const [hover, setHover] = useState<number | null>(null);
  const box = useRef<HTMLDivElement>(null);
  const id = useId();
  const m = metrics.find((x) => x.id === active) ?? metrics[0];
  const series = useMemo(() => m?.series ?? [], [m]);
  const max = useMemo(() => {
    const top = Math.max(1, ...series);
    // A round ceiling for the axis.
    const step = 10 ** Math.floor(Math.log10(top));
    return Math.ceil(top / step) * step;
  }, [series]);
  // The line glides from one metric to the next instead of jumping.
  const norm = useTween(useMemo(() => series.map((v) => v / max), [series, max]));

  const W = 1000;
  const H = 260;
  const x = (i: number) => (series.length <= 1 ? W / 2 : (i / (series.length - 1)) * W);
  const yN = (f: number) => H - f * (H - 16) - 4;
  const y = (v: number) => yN(v / max);
  const pts = norm.map((f, i) => [x(i), yN(f)] as [number, number]);
  const line = smoothPath(pts, 2, H - 2);
  const total = m?.total ?? series.reduce((a, b) => a + b, 0);

  // The metric switch's thumb slides to the chosen metric.
  const track = useRef<HTMLDivElement>(null);
  const [thumb, setThumb] = useState<{ x: number; w: number } | null>(null);
  useLayoutEffect(() => {
    const measure = () => {
      const el = track.current?.querySelector<HTMLElement>(`[data-metric="${active}"]`);
      if (el) setThumb({ x: el.offsetLeft, w: el.offsetWidth });
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [active]);

  function onMove(e: React.PointerEvent) {
    const r = box.current?.getBoundingClientRect();
    if (!r || series.length === 0) return;
    const f = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
    setHover(Math.round(f * (series.length - 1)));
  }

  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => Math.round(max * f));
  const labelEvery = Math.max(1, Math.ceil(labels.length / 8));
  // Phones get half as many dates, so they never overlap.
  const phoneEvery = Math.max(1, Math.ceil(labels.length / 4));

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[0.8rem] text-ink-50">{m?.label}</p>
          <p className="mt-1 text-[1.7rem] font-semibold leading-none tracking-[-0.04em] tabular-nums">
            {hover !== null ? fmt(series[hover] ?? 0, m?.money) : fmt(total, m?.money)}
            <span className="ml-2 text-[0.8rem] font-normal tracking-normal text-ink-30">
              {hover !== null ? labels[hover] : "in this period"}
            </span>
          </p>
        </div>
        <div ref={track} className="relative flex max-w-full overflow-x-auto rounded-full bg-ink-04 p-1 [scrollbar-width:none]">
          {thumb && (
            <span
              aria-hidden="true"
              className="absolute top-1 bottom-1 rounded-full bg-paper shadow-[0_1px_3px_rgba(0,0,0,0.12)] transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]"
              style={{ left: thumb.x, width: thumb.w }}
            />
          )}
          {metrics.map((x) => (
            <button
              key={x.id}
              type="button"
              data-metric={x.id}
              aria-pressed={x.id === active}
              onClick={() => setActive(x.id)}
              className={`relative z-10 shrink-0 whitespace-nowrap rounded-full px-3 py-1.5 text-[0.76rem] font-medium transition-colors duration-200 ${
                x.id === active ? "text-ink" : "text-ink-50 hover:text-ink"
              }`}
            >
              {x.label}
            </button>
          ))}
        </div>
      </div>

      <div className="relative mt-6 flex gap-3">
        <div className="flex h-[260px] w-10 shrink-0 flex-col justify-between py-[2px] text-right text-[0.66rem] tabular-nums text-ink-30">
          {[...ticks].reverse().map((t, i) => (
            <span key={i}>{m?.money ? `₹${t.toLocaleString("en-IN")}` : t.toLocaleString("en-IN")}</span>
          ))}
        </div>
        <div
          ref={box}
          className="relative h-[260px] flex-1 cursor-crosshair touch-none"
          onPointerMove={onMove}
          onPointerLeave={() => setHover(null)}
        >
          <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="absolute inset-0 h-full w-full" aria-hidden="true">
            <defs>
              <linearGradient id={id} x1="0" x2="0" y1="0" y2="1">
                <stop offset="0" stopColor={ACCENT} stopOpacity="0.5" />
                <stop offset="1" stopColor={ACCENT} stopOpacity="0.02" />
              </linearGradient>
            </defs>
            {ticks.map((t, i) => (
              <line key={i} x1="0" x2={W} y1={y(t)} y2={y(t)} stroke="#15161a" strokeOpacity="0.06" vectorEffect="non-scaling-stroke" />
            ))}
            {pts.length > 1 && <path d={`${line} L${W},${H} L0,${H} Z`} fill={`url(#${id})`} />}
            <path d={line} fill="none" stroke={LINE} strokeWidth="2.5" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
            {hover !== null && (
              <line x1={x(hover)} x2={x(hover)} y1="0" y2={H} stroke="#15161a" strokeOpacity="0.25" strokeDasharray="4 4" vectorEffect="non-scaling-stroke" />
            )}
          </svg>
          {hover !== null && (
            <>
              <span
                className="pointer-events-none absolute size-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-[2.5px] border-paper bg-[#3f8f1f] shadow-[0_2px_6px_rgba(0,0,0,0.25)] transition-[left,top] duration-150"
                style={{ left: `${(x(hover) / W) * 100}%`, top: `${(y(series[hover] ?? 0) / H) * 100}%` }}
              />
              <span
                className="pointer-events-none absolute -translate-x-1/2 -translate-y-[calc(100%+14px)] whitespace-nowrap rounded-xl border border-ink-08 bg-paper px-3 py-1.5 text-[0.8rem] text-ink-50 shadow-[0_8px_24px_-10px_rgba(0,0,0,0.25)] transition-[left,top] duration-150"
                style={{ left: `${(x(hover) / W) * 100}%`, top: `${(y(series[hover] ?? 0) / H) * 100}%` }}
              >
                <span className="font-semibold text-ink">{fmt(series[hover] ?? 0, m?.money)}</span> {labels[hover]}
              </span>
            </>
          )}
        </div>
      </div>
      <div className="relative ml-[3.25rem] mt-2 h-4 text-[0.66rem] text-ink-30">
        {labels.map((l, i) =>
          i % labelEvery === 0 || i === labels.length - 1 ? (
            <span
              key={l + i}
              className={`absolute -translate-x-1/2 whitespace-nowrap first:translate-x-0 last:-translate-x-full ${
                i % phoneEvery === 0 || i === labels.length - 1 ? "" : "hidden sm:block"
              }`}
              style={{ left: `${(x(i) / W) * 100}%` }}
            >
              {l}
            </span>
          ) : null,
        )}
      </div>
    </div>
  );
}
