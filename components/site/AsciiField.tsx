"use client";

import { useEffect, useRef, type ReactNode } from "react";

/**
 * A field of monospace characters on a dark navy canvas.
 *
 *   - A thick ribbon of letters drifts across the screen like a slow wave,
 *     with strands dripping off its lower edge.
 *   - Around the pointer a soft blue glow lights up: letters there turn
 *     white, grow a little and re-scramble fast, and a sparse lattice of
 *     faint letters appears in the empty space around it.
 *   - As the section scrolls, the ribbon gathers into the Cheatcode mark
 *     (the "C" and its square), and whatever is passed as `children` fades in.
 *
 * Everything is drawn on one 2D canvas. Glyphs are pre-rendered once into an
 * atlas per colour, so a frame is a few thousand `drawImage` calls rather
 * than `fillText`s; each cell eases toward its target brightness, which is
 * what makes it feel smooth instead of flickery.
 */

const CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
const BG = "#05051a";
// Tints, dim → bright. The last one is the grey of the lattice around the pointer.
const TINTS = ["#2a2ce6", "#5254ff", "#b4b6ff", "#ffffff", "#3c3f72"];
const LATTICE = 4;

// The mark from app/icon.svg, in its 92×92 viewBox.
const MARK_ARC =
  "M68.7008 63.8998C65.6499 67.3626 61.7456 69.9664 57.3762 71.4522C53.0069 72.938 48.3247 73.2541 43.7953 72.3691C39.2659 71.484 35.0471 69.4287 31.5584 66.4074C28.0697 63.3862 25.4327 59.5042 23.9097 55.1477C22.3867 50.7912 22.0307 46.1119 22.8771 41.5751C23.7235 37.0383 25.7428 32.8021 28.7342 29.2878C31.7256 25.7735 35.5849 23.1035 39.9283 21.5434C44.2717 19.9833 48.9478 19.5874 53.4916 20.3951";

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const smoothstep = (a: number, b: number, v: number) => {
  const t = clamp01((v - a) / (b - a));
  return t * t * (3 - 2 * t);
};
const randChar = () => (Math.random() * CHARS.length) | 0;

type Props = {
  /** Shown over the canvas, fading in as the mark forms. */
  children?: ReactNode;
  /** Shown over the canvas at the start, fading out as you scroll. */
  intro?: ReactNode;
  /** Section height in viewport heights; the extra over 1 is the scroll used for the morph. */
  scrollLength?: number;
};

export function AsciiField({ children, intro, scrollLength = 2.4 }: Props) {
  const sectionRef = useRef<HTMLElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const section = sectionRef.current!;
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d", { alpha: false })!;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    // ------------------------------------------------------------ geometry
    let W = 0, H = 0, dpr = 1;
    let CW = 16, CH = 18; // cell size in CSS px
    let cols = 0, rows = 0, n = 0;

    let val = new Float32Array(0); // current brightness 0..1
    let heat = new Float32Array(0); // current pointer heat 0..1
    let jitter = new Float32Array(0); // stable per-cell random: edge dither
    let bright = new Float32Array(0); // stable per-cell random: base brightness
    let nextSwap = new Float32Array(0); // time of next character change
    let scrambleUntil = new Float32Array(0);
    let glyph = new Uint8Array(0);
    let logo = new Float32Array(0); // mark coverage per cell
    let drip = new Float32Array(0); // per-column strand length, in rows

    let atlas: HTMLCanvasElement | null = null;

    function buildAtlas() {
      const a = document.createElement("canvas");
      const gw = Math.ceil(CW * dpr), gh = Math.ceil(CH * dpr);
      a.width = gw * CHARS.length;
      a.height = gh * TINTS.length;
      const g = a.getContext("2d")!;
      const fs = Math.round((CW < 14 ? 10 : 12) * dpr);
      g.font = `700 ${fs}px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace`;
      g.textAlign = "center";
      g.textBaseline = "middle";
      TINTS.forEach((tint, ti) => {
        g.fillStyle = tint;
        for (let ci = 0; ci < CHARS.length; ci++) {
          g.fillText(CHARS[ci], ci * gw + gw / 2, ti * gh + gh / 2 + dpr * 0.5);
        }
      });
      atlas = a;
    }

    function buildLogoMask() {
      // Rasterise the mark at one pixel per cell; the anti-aliasing gives soft edges.
      const m = document.createElement("canvas");
      m.width = cols;
      m.height = rows;
      const g = m.getContext("2d", { willReadFrequently: true })!;
      g.scale(1 / CW, 1 / CH);
      const size = Math.min(H * 0.62, W * 0.78); // height of the mark in px
      const s = size / 53; // the mark's ink spans ~53 units of the viewBox
      g.translate(W / 2, H * 0.5);
      g.scale(s, s);
      g.translate(-45.8, -46.4);
      g.lineWidth = 12.76;
      g.strokeStyle = "#fff";
      g.fillStyle = "#fff";
      g.stroke(new Path2D(MARK_ARC));
      g.fillRect(40.92, 37.39, 16.86, 16.86);
      const data = g.getImageData(0, 0, cols, rows).data;
      logo = new Float32Array(n);
      for (let i = 0; i < n; i++) logo[i] = data[i * 4 + 3] / 255;
    }

    function resize() {
      const r = canvas.getBoundingClientRect();
      W = r.width;
      H = r.height;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      const small = W < 640;
      CW = small ? 11 : 16;
      CH = small ? 13 : 18;
      canvas.width = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);
      cols = Math.ceil(W / CW);
      rows = Math.ceil(H / CH);
      n = cols * rows;

      val = new Float32Array(n);
      heat = new Float32Array(n);
      jitter = new Float32Array(n);
      bright = new Float32Array(n);
      nextSwap = new Float32Array(n);
      scrambleUntil = new Float32Array(n);
      glyph = new Uint8Array(n);
      for (let i = 0; i < n; i++) {
        jitter[i] = Math.random();
        bright[i] = Math.random();
        glyph[i] = randChar();
        nextSwap[i] = Math.random() * 4000;
      }
      drip = new Float32Array(cols);
      for (let c = 0; c < cols; c++) {
        drip[c] = Math.random() < 0.3 ? 2 + Math.random() * 9 : Math.random() * 1.5;
      }
      buildAtlas();
      buildLogoMask();
    }

    // ------------------------------------------------------------ input
    const ptr = { x: -9999, y: -9999, sx: -9999, sy: -9999, on: 0, onS: 0 };
    function onMove(e: PointerEvent) {
      const r = canvas.getBoundingClientRect();
      ptr.x = e.clientX - r.left;
      ptr.y = e.clientY - r.top;
      if (ptr.sx < -9000) { ptr.sx = ptr.x; ptr.sy = ptr.y; }
      ptr.on = ptr.y >= 0 && ptr.y <= r.height ? 1 : 0;
    }
    function onLeave() { ptr.on = 0; }

    // ------------------------------------------------------------ frame
    let progress = 0, progressS = 0;
    let raf = 0, running = false, last = performance.now(), clock = 0;

    function readScroll() {
      const r = section.getBoundingClientRect();
      const span = r.height - window.innerHeight;
      progress = span > 0 ? clamp01(-r.top / span) : 0;
    }

    function frame(now: number) {
      raf = requestAnimationFrame(frame);
      const dt = Math.min(now - last, 50);
      last = now;
      if (!reduced) clock += dt / 1000;
      const k = dt / 16.67; // frame-rate independent easing

      readScroll();
      progressS += (progress - progressS) * Math.min(1, 0.09 * k);
      // The ribbon holds for the first stretch, then gathers into the mark.
      const p = smoothstep(0.08, 0.72, progressS);
      section.style.setProperty("--p", progressS.toFixed(4));

      ptr.sx += (ptr.x - ptr.sx) * Math.min(1, 0.16 * k);
      ptr.sy += (ptr.y - ptr.sy) * Math.min(1, 0.16 * k);
      ptr.onS += (ptr.on - ptr.onS) * Math.min(1, 0.08 * k);

      // ---- background + glow
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.globalAlpha = 1;
      ctx.fillStyle = BG;
      ctx.fillRect(0, 0, W, H);

      const R = Math.max(170, Math.min(W, H) * 0.3); // pointer influence radius
      if (ptr.onS > 0.01) {
        const g = ctx.createRadialGradient(ptr.sx, ptr.sy, 0, ptr.sx, ptr.sy, R * 0.75);
        g.addColorStop(0, `rgba(70,72,255,${0.38 * ptr.onS})`);
        g.addColorStop(0.45, `rgba(40,42,200,${0.14 * ptr.onS})`);
        g.addColorStop(1, "rgba(20,20,120,0)");
        ctx.fillStyle = g;
        ctx.fillRect(ptr.sx - R, ptr.sy - R, R * 2, R * 2);
      }

      if (!atlas) return;
      const gw = Math.ceil(CW * dpr), gh = Math.ceil(CH * dpr);
      const TAU = Math.PI * 2;
      const t = clock;
      const wAmt = 1 - p;

      for (let c = 0; c < cols; c++) {
        const x = c * CW + CW / 2;
        const u = x / W;

        // Ribbon: a centre line and a thickness, both slowly travelling.
        const yc =
          H * 0.6 +
          H * 0.1 * Math.sin(TAU * u * 1.05 - t * 0.32) +
          H * 0.045 * Math.sin(TAU * u * 2.4 + t * 0.47 + 1.3);
        const ht = H * (0.06 + 0.06 * (0.5 + 0.5 * Math.sin(TAU * u * 1.7 - t * 0.25 + 0.6)));
        const bottom = yc + ht;
        const dr = drip[c] * (0.6 + 0.4 * Math.sin(t * 0.6 + c * 0.37));

        for (let r = 0; r < rows; r++) {
          const i = r * cols + c;
          const y = r * CH + CH / 2;

          // ---- target from the shapes
          let wave = 1 - smoothstep(0.7, 1.05, Math.abs(y - yc) / ht);
          if (y > bottom && dr > 0) {
            const dy = (y - bottom) / CH;
            if (dy < dr) wave = Math.max(wave, (1 - dy / dr) * 0.85);
          }
          const shape = wave * wAmt + logo[i] * p;
          // Dither the edges: a cell lights only once the shape clears its own threshold.
          let target = shape > 0.12 + jitter[i] * 0.4 ? shape * (0.55 + 0.45 * bright[i]) : 0;

          // ---- pointer
          let h = 0;
          if (ptr.onS > 0.01) {
            const dx = x - ptr.sx, dy = y - ptr.sy;
            const d = Math.sqrt(dx * dx + dy * dy);
            if (d < R) {
              h = 1 - d / R;
              h = h * h * ptr.onS;
            }
          }
          heat[i] += (h - heat[i]) * Math.min(1, 0.2 * k);
          const hv = heat[i];
          if (target > 0) target = Math.min(1, target + hv * 0.6);

          // ---- ease brightness; rising cells start a short scramble
          const prev = val[i];
          val[i] += (target - prev) * Math.min(1, (target > prev ? 0.14 : 0.06) * k);
          if (prev < 0.05 && val[i] >= 0.05) scrambleUntil[i] = now + 250 + Math.random() * 500;

          // ---- character changes
          if (!reduced && now >= nextSwap[i]) {
            glyph[i] = randChar();
            const scrambling = now < scrambleUntil[i];
            nextSwap[i] =
              now +
              (scrambling || hv > 0.15
                ? 40 + Math.random() * 70
                : val[i] > 0.05
                  ? 900 + Math.random() * 5000
                  : 2000 + Math.random() * 8000);
          }

          // ---- what to draw
          let a = val[i];
          let tint: number;
          if (a > 0.02) {
            tint = hv > 0.5 ? 3 : hv > 0.22 ? 2 : bright[i] > 0.72 ? 1 : 0;
          } else {
            // Empty space: a very faint field, plus a sparse lattice near the pointer.
            const lattice = (c & 1) === 0 && r % 3 === 0 ? hv * 0.9 : 0;
            const faint = jitter[i] < 0.18 ? 0.045 : 0;
            a = Math.max(lattice, faint);
            if (a < 0.02) continue;
            tint = lattice > faint ? LATTICE : 0;
          }

          const s = 1 + hv * 0.3;
          const w = CW * s, hh = CH * s;
          ctx.globalAlpha = a > 1 ? 1 : a;
          ctx.drawImage(atlas, glyph[i] * gw, tint * gh, gw, gh, x - w / 2, y - hh / 2, w, hh);
        }
      }
      ctx.globalAlpha = 1;
    }

    function start() {
      if (running) return;
      running = true;
      last = performance.now();
      raf = requestAnimationFrame(frame);
    }
    function stop() {
      running = false;
      cancelAnimationFrame(raf);
    }

    resize();
    const ro = new ResizeObserver(() => resize());
    ro.observe(canvas);
    const io = new IntersectionObserver(([e]) => (e.isIntersecting ? start() : stop()));
    io.observe(section);
    const onVis = () => (document.hidden ? stop() : start());
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("pointerdown", onMove, { passive: true });
    document.documentElement.addEventListener("pointerleave", onLeave);

    return () => {
      stop();
      ro.disconnect();
      io.disconnect();
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerdown", onMove);
      document.documentElement.removeEventListener("pointerleave", onLeave);
    };
  }, []);

  return (
    <section
      ref={sectionRef}
      className="relative bg-[#05051a]"
      style={{ height: `${scrollLength * 100}svh` }}
    >
      <div className="sticky top-0 h-svh w-full overflow-hidden">
        <canvas ref={canvasRef} aria-hidden className="absolute inset-0 h-full w-full" />
        {intro ? (
          <div
            className="pointer-events-none absolute inset-x-0 top-[18%] flex justify-center px-5 text-center"
            style={{ opacity: "calc(1 - var(--p, 0) * 6)" }}
          >
            {intro}
          </div>
        ) : null}
        {children ? (
          <div
            className="absolute inset-x-0 bottom-[6%] flex justify-center px-5"
            style={{
              opacity: "clamp(0, (var(--p, 0) - 0.7) * 5, 1)",
              transform: "translateY(calc((1 - clamp(0, (var(--p, 0) - 0.7) * 5, 1)) * 16px))",
            }}
          >
            {children}
          </div>
        ) : null}
      </div>
    </section>
  );
}
