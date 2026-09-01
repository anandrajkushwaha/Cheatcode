"use client";

import { useEffect, useRef } from "react";

/**
 * The field the agent thinks inside.
 *
 * A grid of squares that dissolves downward into the page, drawn on a canvas
 * rather than in the DOM: at this pitch a 1440px screen is a few thousand
 * cells, and a few thousand elements that all change opacity every frame is a
 * layout the browser cannot afford. One canvas repaints in a single pass.
 *
 * It is not wallpaper. It carries three things the rest of the screen cannot:
 *
 *   - where the pointer is, so the surface answers before anything is typed;
 *   - a ring that leaves the orb every time a message goes out or an answer
 *     comes back, which is the only visible sign that something happened
 *     between pressing Ask and reading a reply;
 *   - how awake the agent is — listening quickens the shimmer and pulls more
 *     of the gold cells up out of the grey.
 *
 * Under prefers-reduced-motion it paints one still frame and stops. The grid
 * is part of the design; the movement is not, and the movement is the part
 * that hurts.
 */

/** Grid pitch and drawn square. The gap between them is the whole look. */
const STEP = 12;
const DOT = 5;

/** ~3% of the field, so gold reads as an accent rather than a colour scheme. */
const GOLD_CUT = 0.968;

/** Deterministic per-cell noise — the dissolve has to survive a resize. */
function hash(x: number, y: number): number {
  const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return n - Math.floor(n);
}

export function PixelField({
  energy,
  pulse,
  className,
}: {
  /** 0 idle, ~0.6 thinking, 1 listening. */
  energy: number;
  /** Increment to send a ring out from the orb. */
  pulse: number;
  className?: string;
}) {
  const ref = useRef<HTMLCanvasElement>(null);

  // Read by the animation loop, which must not restart when they change.
  const energyRef = useRef(energy);
  energyRef.current = energy;
  const pulseAt = useRef(0);

  useEffect(() => {
    if (pulse > 0) pulseAt.current = performance.now();
  }, [pulse]);

  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const ctx = cv.getContext("2d");
    if (!ctx) return;

    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    let w = 0;
    let h = 0;
    let cols = 0;
    let rows = 0;
    let raf = 0;
    let last = 0;

    const pointer = { x: 0, y: 0, on: false };

    const resize = () => {
      const r = cv.getBoundingClientRect();
      w = Math.max(1, Math.round(r.width));
      h = Math.max(1, Math.round(r.height));
      cv.width = Math.round(w * dpr);
      cv.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      cols = Math.ceil(w / STEP) + 1;
      rows = Math.ceil(h / STEP) + 1;
      if (still) paint(0);
    };

    function paint(now: number) {
      ctx!.clearRect(0, 0, w, h);

      const t = now / 1000;
      const e = energyRef.current;

      // The ring travels from roughly where the orb sits — a little above the
      // middle of the field, which is where the layout puts it at every width
      // we support.
      const ox = w / 2;
      const oy = h * 0.45;
      const age = (now - pulseAt.current) / 1000;
      const ringing = !still && pulseAt.current > 0 && age < 1.5;
      const ringR = age * 780;
      const ringFade = ringing ? 1 - age / 1.5 : 0;

      for (let cy = 0; cy < rows; cy++) {
        const y = cy * STEP;

        // The dissolve. Squared rather than linear so the top stays solid and
        // the bottom thins out fast — a straight ramp reads as a grey block.
        const density = Math.pow(1 - cy / rows, 1.7);
        if (density <= 0.004) continue;

        for (let cx = 0; cx < cols; cx++) {
          // One draw of the dice per cell decides whether it exists at all.
          // Comparing it against the row's density is what makes the edge
          // ragged instead of a straight line.
          const n = hash(cx, cy);
          if (n > density) continue;

          const x = cx * STEP;
          const phase = n * 62.83;
          const gold = hash(cx + 31, cy + 17) > GOLD_CUT;

          let a =
            (gold ? 0.2 : 0.115) *
            (0.55 + 0.45 * density) *
            (0.7 + 0.3 * Math.sin(t * (0.8 + e * 2.2) + phase));

          if (!still && pointer.on) {
            const dx = x - pointer.x;
            const dy = y - pointer.y;
            const d = Math.sqrt(dx * dx + dy * dy);
            if (d < 140) {
              const k = 1 - d / 140;
              a += 0.34 * k * k;
            }
          }

          if (ringing) {
            const d = Math.sqrt((x - ox) * (x - ox) + (y - oy) * (y - oy));
            const band = Math.abs(d - ringR);
            if (band < 80) a += 0.4 * (1 - band / 80) * ringFade;
          }

          if (a < 0.012) continue;
          ctx!.fillStyle = gold
            ? `rgba(226,146,44,${Math.min(a * 1.25, 0.8)})`
            : `rgba(17,19,22,${Math.min(a, 0.6)})`;
          ctx!.fillRect(x, y, DOT, DOT);
        }
      }
    }

    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      // 30fps. The shimmer is slow enough that 60 buys nothing and costs a
      // continuous repaint on somebody's laptop battery.
      if (now - last < 33) return;
      last = now;
      paint(now);
    };

    const onMove = (e: PointerEvent) => {
      const r = cv.getBoundingClientRect();
      pointer.x = e.clientX - r.left;
      pointer.y = e.clientY - r.top;
      pointer.on = true;
    };
    const onLeave = () => {
      pointer.on = false;
    };

    resize();
    window.addEventListener("resize", resize);

    if (!still) {
      window.addEventListener("pointermove", onMove, { passive: true });
      window.addEventListener("pointerleave", onLeave);
      raf = requestAnimationFrame(frame);
    }

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerleave", onLeave);
    };
  }, []);

  return (
    <canvas
      ref={ref}
      aria-hidden="true"
      className={`pointer-events-none absolute inset-x-0 top-0 h-[46vh] w-full ${className ?? ""}`}
      // The grid has no bottom edge — it is masked out before it reaches one.
      style={{
        maskImage: "linear-gradient(to bottom, #000 0%, #000 52%, transparent 100%)",
        WebkitMaskImage: "linear-gradient(to bottom, #000 0%, #000 52%, transparent 100%)",
      }}
    />
  );
}
