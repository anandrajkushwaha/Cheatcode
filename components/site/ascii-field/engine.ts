/**
 * Character-field interaction, framework-free.
 *
 *   - Two shapes made of letters sit on the left and right. Their letters are
 *     fixed to the shape (only a few re-roll now and then), so when the shapes
 *     slide apart on scroll the letters travel with them, snapped to the grid.
 *   - In the middle a faint scaffold of letters (every few cells) marks where
 *     the centre shape will be; as you scroll the shape builds in, cell by
 *     cell, each new cell flashing white and cooling to blue.
 *   - Around the pointer: a soft blue glow, letters turn white and bold, grow
 *     a little, get nudged off their baseline and re-scramble fast, and the
 *     scaffold lights up around it.
 *
 * Shapes are SVG path strings drawn in a 1600×900 design frame, which is
 * scaled to cover the viewport. Swap the paths in SHAPES to change them.
 */

export type ShapeSet = {
  /** Path data in the 1600×900 frame. */
  left: string;
  right: string;
  center: string;
};

// Traced from the reference's opening frame. The centre one is a placeholder.
export const SHAPES: ShapeSet = {
  left:
    "M0 427 C40 418 90 405 112 399 C135 386 150 375 160 371 C185 365 200 362 208 361 " +
    "C225 350 240 340 248 336 C262 328 274 323 282 322 L370 322 C392 326 410 331 422 334 " +
    "C450 341 465 345 480 348 C530 354 570 358 588 361 C610 365 625 368 632 371 " +
    "C655 395 665 410 672 419 C700 440 720 460 732 474 C722 500 710 518 700 530 " +
    "C708 540 712 548 712 555 C710 575 706 592 704 601 L544 601 C540 585 538 566 536 553 " +
    "C515 543 495 535 480 529 C450 520 420 511 400 506 C340 508 290 511 264 514 " +
    "C235 540 212 558 200 569 C185 582 170 593 160 601 C120 625 90 645 72 656 " +
    "C50 672 40 682 32 688 C20 692 10 694 0 695 Z",
  right:
    "M816 506 C840 498 865 490 880 486 C895 480 905 476 912 474 L992 474 C1030 470 1050 465 1064 462 " +
    "C1080 455 1095 446 1104 442 C1140 435 1165 430 1184 427 C1210 420 1235 414 1248 411 " +
    "C1300 402 1340 395 1360 391 C1368 382 1372 375 1376 371 C1395 366 1412 361 1424 359 " +
    "C1460 354 1480 350 1496 348 C1520 343 1540 338 1552 336 C1570 333 1590 329 1600 328 " +
    "L1600 561 L1392 561 C1340 558 1300 555 1280 553 C1250 560 1235 565 1224 569 " +
    "C1215 575 1205 580 1200 584 C1175 640 1150 690 1136 711 C1100 720 1060 725 1040 727 " +
    "L984 727 C981 690 978 650 976 632 C970 610 964 592 960 584 C930 565 900 543 880 529 " +
    "C850 529 830 529 816 529 Z",
  // Placeholder: a stepped arch. Replace with the real centre shape.
  center:
    "M640 230 L916 230 L916 600 L846 600 L846 420 L710 420 L710 600 L640 600 Z " +
    "M720 300 L836 300 L836 360 L720 360 Z",
};

const FRAME_W = 1600;
const FRAME_H = 900;
/** Where the scaffold and the centre shape are centred, in the frame. */
const CENTER = { x: 778, y: 415, rx: 330, ry: 360 };

const CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
const BG = "#05051a";
// Atlas tints. 0–2 blue (dim → bright), 3 lavender, 4 white, 5 scaffold grey.
const TINTS = ["#3033ee", "#4649ff", "#7072ff", "#b9bbff", "#ffffff", "#4a4d88"];
const T_LAV = 3, T_WHITE = 4, T_GREY = 5;

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const smooth = (a: number, b: number, v: number) => {
  const t = clamp01((v - a) / (b - a));
  return t * t * (3 - 2 * t);
};
const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const rc = () => (Math.random() * CHARS.length) | 0;

export type FieldOptions = {
  shapes?: Partial<ShapeSet>;
  /** Called every frame with the smoothed scroll progress 0..1. */
  onProgress?: (p: number) => void;
};

/**
 * Starts the field. `section` is the tall scroll container (progress is its
 * scroll through the viewport); `canvas` is inside a sticky full-screen box.
 * Returns a function that stops everything.
 */
export function createAsciiField(
  section: HTMLElement,
  canvas: HTMLCanvasElement,
  opts: FieldOptions = {},
): () => void {
  const shapes = { ...SHAPES, ...opts.shapes };
  const ctx = canvas.getContext("2d", { alpha: false })!;
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  let W = 0, H = 0, dpr = 1, CW = 7, CH = 12, cols = 0, rows = 0, n = 0;
  let scale = 1, ox = 0, oy = 0; // frame → screen

  // Side shapes: masks and letters in their own grid, so letters move with them.
  let leftM = new Float32Array(0), rightM = new Float32Array(0);
  let leftDepth = new Float32Array(0), rightDepth = new Float32Array(0);
  let sideGlyph = new Uint8Array(0); // shared, indexed by shape-local cell
  let sideBright = new Float32Array(0);
  let sideSwap = new Float32Array(0);
  let sideBorn = new Float32Array(0); // intro reveal threshold

  // Centre shape and scaffold, in screen cells.
  let centerM = new Float32Array(0);
  let order = new Float32Array(0); // build order 0..1
  let cVal = new Float32Array(0);
  let cFlash = new Float32Array(0);
  let scaffold = new Float32Array(0); // 0..1 scaffold weight per cell

  // Per screen cell.
  let glyph = new Uint8Array(0);
  let swapAt = new Float32Array(0);
  let heat = new Float32Array(0);
  let nudge = new Float32Array(0);
  let bright = new Float32Array(0);

  let atlas: HTMLCanvasElement | null = null;
  let gw = 0, gh = 0;

  function rasterise(path: string) {
    const m = document.createElement("canvas");
    m.width = cols;
    m.height = rows;
    const g = m.getContext("2d", { willReadFrequently: true })!;
    g.scale(1 / CW, 1 / CH);
    g.translate(ox, oy);
    g.scale(scale, scale);
    g.fillStyle = "#fff";
    g.fill(new Path2D(path), "evenodd");
    const d = g.getImageData(0, 0, cols, rows).data;
    const out = new Float32Array(n);
    for (let i = 0; i < n; i++) out[i] = d[i * 4 + 3] / 255;
    return out;
  }

  /** 0 at a column's top edge of the shape, 1 at its bottom: drives the fade-out downward. */
  function depthOf(mask: Float32Array) {
    const out = new Float32Array(n);
    for (let c = 0; c < cols; c++) {
      let top = -1, bot = -1;
      for (let r = 0; r < rows; r++) {
        if (mask[r * cols + c] > 0.3) {
          if (top < 0) top = r;
          bot = r;
        }
      }
      if (top < 0) continue;
      const span = Math.max(1, bot - top);
      for (let r = top; r <= bot; r++) out[r * cols + c] = (r - top) / span;
    }
    return out;
  }

  function buildAtlas() {
    gw = Math.ceil(CW * dpr * 1.6);
    gh = Math.ceil(CH * dpr * 1.6);
    const a = document.createElement("canvas");
    a.width = gw * CHARS.length;
    a.height = gh * TINTS.length;
    const g = a.getContext("2d")!;
    g.font = `700 ${Math.round(CH * 0.72 * dpr)}px ui-monospace, "SF Mono", Menlo, Consolas, monospace`;
    g.textAlign = "center";
    g.textBaseline = "middle";
    TINTS.forEach((tint, ti) => {
      g.fillStyle = tint;
      for (let ci = 0; ci < CHARS.length; ci++) g.fillText(CHARS[ci], ci * gw + gw / 2, ti * gh + gh / 2);
    });
    atlas = a;
  }

  function resize() {
    const r = canvas.getBoundingClientRect();
    W = r.width;
    H = r.height;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);

    scale = Math.max(W / FRAME_W, H / FRAME_H);
    ox = (W - FRAME_W * scale) / 2;
    oy = (H - FRAME_H * scale) / 2;
    // The reference packs ~216 columns across a laptop screen; keep that density, with a floor.
    CW = Math.max(6.5, 7.4 * scale);
    CH = CW * 1.7;
    cols = Math.ceil(W / CW);
    rows = Math.ceil(H / CH);
    n = cols * rows;

    leftM = rasterise(shapes.left);
    rightM = rasterise(shapes.right);
    centerM = rasterise(shapes.center);
    leftDepth = depthOf(leftM);
    rightDepth = depthOf(rightM);

    const fresh = () => new Float32Array(n) as Float32Array<ArrayBuffer>;
    sideGlyph = new Uint8Array(n);
    sideBright = fresh(); sideSwap = fresh(); sideBorn = fresh();
    glyph = new Uint8Array(n);
    swapAt = fresh(); heat = fresh(); nudge = fresh(); bright = fresh();
    cVal = fresh(); cFlash = fresh(); order = fresh(); scaffold = fresh();

    // Scaffold geometry and build order, from the centre ellipse.
    const cx = ox + CENTER.x * scale, cy = oy + CENTER.y * scale;
    const rx = CENTER.rx * scale, ry = CENTER.ry * scale;
    let cTop = Infinity, cBot = -Infinity;
    for (let i = 0; i < n; i++) if (centerM[i] > 0.3) {
      const r = (i / cols) | 0;
      if (r < cTop) cTop = r;
      if (r > cBot) cBot = r;
    }
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const i = r * cols + c;
        sideGlyph[i] = rc();
        glyph[i] = rc();
        sideBright[i] = Math.random();
        bright[i] = Math.random();
        sideSwap[i] = Math.random() * 6000;
        swapAt[i] = Math.random() * 6000;
        sideBorn[i] = Math.random();
        // Builds top to bottom, in ragged blocks rather than a clean wipe.
        const block = (((c / 3) | 0) * 7919 + ((r / 2) | 0) * 104729) % 1000 / 1000;
        const yN = cBot > cTop ? (r - cTop) / (cBot - cTop) : 0;
        order[i] = clamp01(yN * 0.6 + block * 0.3 + Math.random() * 0.1);
        if (c % 3 === 0 && r % 3 === 0) {
          const x = c * CW + CW / 2, y = r * CH + CH / 2;
          const e = Math.hypot((x - cx) / rx, (y - cy) / ry);
          scaffold[i] = Math.random() < 0.8 ? 1 - smooth(0.25, 1, e) : 0;
        }
      }
    }
    buildAtlas();
  }

  // ------------------------------------------------------------- input
  const ptr = { x: 0, y: 0, sx: 0, sy: 0, on: 0, onS: 0, seen: false };
  function onMove(e: PointerEvent) {
    const r = canvas.getBoundingClientRect();
    ptr.x = e.clientX - r.left;
    ptr.y = e.clientY - r.top;
    if (!ptr.seen) { ptr.sx = ptr.x; ptr.sy = ptr.y; ptr.seen = true; }
    ptr.on = ptr.y >= 0 && ptr.y <= r.height ? 1 : 0;
  }
  const onLeave = () => { ptr.on = 0; };

  // ------------------------------------------------------------- frame
  let raf = 0, running = false, last = 0, born = -1;
  let prog = 0, progS = 0;

  function draw(gi: number, tint: number, x: number, y: number, a: number, s: number) {
    const w = CW * 1.6 * s, h = CH * 1.6 * s;
    ctx.globalAlpha = a > 1 ? 1 : a;
    ctx.drawImage(atlas!, gi * gw, tint * gh, gw, gh, x - w / 2, y - h / 2, w, h);
  }

  function frame(now: number) {
    raf = requestAnimationFrame(frame);
    if (born < 0) born = now;
    const dt = Math.min(now - last, 50);
    last = now;
    const k = dt / 16.67;

    const sr = section.getBoundingClientRect();
    const span = sr.height - window.innerHeight;
    prog = span > 0 ? clamp01(-sr.top / span) : 0;
    progS += (prog - progS) * Math.min(1, 0.1 * k);
    const p = progS;
    opts.onProgress?.(p);

    // Timeline over the scroll.
    const part = easeInOut(clamp01(p / 0.6)); // sides slide out
    const sideFade = 1 - smooth(0.45, 0.62, p);
    const build = smooth(0.06, 0.6, p); // centre fills in
    const scaff = 0.55 + 0.45 * smooth(0, 0.25, p) - 0.75 * smooth(0.6, 0.9, p);
    const intro = reduced ? 1 : smooth(0, 1400, now - born); // letters decode in on load

    ptr.sx += (ptr.x - ptr.sx) * Math.min(1, 0.18 * k);
    ptr.sy += (ptr.y - ptr.sy) * Math.min(1, 0.18 * k);
    ptr.onS += (ptr.on - ptr.onS) * Math.min(1, 0.08 * k);

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.globalAlpha = 1;
    ctx.fillStyle = BG;
    ctx.fillRect(0, 0, W, H);

    const R = Math.max(110, 150 * scale); // pointer reach
    if (ptr.onS > 0.01) {
      const g = ctx.createRadialGradient(ptr.sx, ptr.sy, 0, ptr.sx, ptr.sy, R);
      g.addColorStop(0, `rgba(78,80,255,${0.42 * ptr.onS})`);
      g.addColorStop(0.35, `rgba(52,54,220,${0.2 * ptr.onS})`);
      g.addColorStop(1, "rgba(20,20,120,0)");
      ctx.fillStyle = g;
      ctx.fillRect(ptr.sx - R, ptr.sy - R, R * 2, R * 2);
    }
    if (!atlas) return;

    // Snap the slide to whole cells, like the reference.
    const shift = Math.round((part * W * 0.62) / CW);

    for (let r = 0; r < rows; r++) {
      const y = r * CH + CH / 2;
      for (let c = 0; c < cols; c++) {
        const i = r * cols + c;
        const x = c * CW + CW / 2;

        // ---- pointer heat
        let h = 0;
        if (ptr.onS > 0.01) {
          const dx = x - ptr.sx, dy = (y - ptr.sy) * 1.1;
          const d2 = dx * dx + dy * dy;
          if (d2 < R * R) {
            h = 1 - Math.sqrt(d2) / R;
            h = h * h * ptr.onS;
          }
        }
        heat[i] += (h - heat[i]) * Math.min(1, (h > heat[i] ? 0.35 : 0.08) * k);
        const hv = heat[i];
        const hot = hv > 0.12;

        // ---- screen-cell letter changes (centre + scaffold)
        if (!reduced && now >= swapAt[i]) {
          glyph[i] = rc();
          nudge[i] = hot ? (Math.random() - 0.5) * 2 : 0;
          swapAt[i] = now + (hot ? 50 + Math.random() * 90 : 2500 + Math.random() * 7000);
        }

        // ---- centre shape
        const want = centerM[i] > 0.35 && build > order[i] ? 1 : 0;
        if (want && cVal[i] < 0.02) cFlash[i] = 1;
        cVal[i] += (want - cVal[i]) * Math.min(1, (want ? 0.22 : 0.1) * k);
        cFlash[i] *= Math.pow(0.94, k);

        let a = 0, tint = 0, gi = glyph[i];

        if (cVal[i] > 0.02) {
          a = cVal[i] * (0.75 + 0.25 * bright[i]);
          const f = Math.max(cFlash[i], hv * 1.4);
          tint = f > 0.6 ? T_WHITE : f > 0.3 ? T_LAV : bright[i] > 0.75 ? 2 : 1;
        } else {
          // ---- side shapes (sampled at their shifted positions)
          const lc = c + shift, rcI = c - shift;
          let side = 0, si = -1, depth = 0;
          if (lc < cols && leftM[r * cols + lc] > 0.3) {
            si = r * cols + lc; side = leftM[si]; depth = leftDepth[si];
          } else if (rcI >= 0 && rightM[r * cols + rcI] > 0.3) {
            si = r * cols + rcI; side = rightM[si]; depth = rightDepth[si];
          }
          if (si >= 0 && sideFade > 0.01 && sideBorn[si] < intro) {
            // Fade and thin out toward each shape's lower edge.
            const thin = sideBright[si] > depth * 0.9 ? 1 : 0.3;
            a = side * sideFade * thin * (0.55 + 0.45 * sideBright[si]) * (1 - depth * 0.4);
            if (!reduced && now >= sideSwap[si]) {
              sideGlyph[si] = rc();
              sideSwap[si] = now + 2500 + Math.random() * 9000;
            }
            gi = hot ? glyph[i] : sideGlyph[si];
            tint = hv > 0.55 ? T_WHITE : hv > 0.3 ? T_LAV : sideBright[si] > 0.82 ? 2 : sideBright[si] > 0.4 ? 1 : 0;
            if (now - born < 1400 && sideBorn[si] > intro - 0.08) tint = T_LAV; // decode shimmer
          } else if (scaffold[i] > 0) {
            // ---- scaffold around the centre
            a = scaffold[i] * scaff * 0.2 * intro + hv * 0.9 * (scaffold[i] > 0 ? 1 : 0);
            tint = hv > 0.45 ? T_LAV : T_GREY;
          } else if (hv > 0.05 && c % 3 === 0 && r % 3 === 0) {
            // Pointer reveals the lattice in empty space too.
            a = hv * 0.7;
            tint = T_GREY;
          }
        }

        if (a < 0.015) continue;
        if (hv > 0.25 && a < hv) a = Math.min(1, a + hv * 0.5);
        const yy = y + nudge[i] * hv * CH * 0.45;
        draw(gi, tint, x, yy, a, 1 + hv * 0.28);
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
  const ro = new ResizeObserver(resize);
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
}
