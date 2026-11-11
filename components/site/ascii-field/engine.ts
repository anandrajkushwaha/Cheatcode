/**
 * Character-field interaction, framework-free.
 *
 *   - A city skyline made of letters fills the screen, in two halves. Their letters are
 *     fixed to the buildings (only a few re-roll now and then), so when the shapes
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

// The two halves of a city skyline: towers with setbacks, slanted roofs, antennas and
// windows punched out (even-odd fill). Generated once and frozen here so it never changes.
export const SHAPES: ShapeSet = {
  left:
    "M0 599.8L64 561.4V770H0Z M24.5 675.8h15v25h-15Z M73 662.49h84v107.51h-84Z M92.5 " +
    "692.49h15v25h-15Z M122.5 692.49h15v25h-15Z M86.4 633.5h57.1v29.9h-57.1Z M95.6 " +
    "604.6h38.8v29.9h-38.8Z M111 534.6h8v71h-8Z M166 531.4h56v238.6h-56Z M186.5 561.4h15v25h-15Z " +
    "M186.5 607.4h15v25h-15Z M186.5 653.4h15v25h-15Z M186.5 699.4h15v25h-15Z M205.2 476.4h7v56h-7Z " +
    "M240 516.5h56v253.5h-56Z M260.5 546.5h15v25h-15Z M260.5 592.5h15v25h-15Z M260.5 638.5h15v25h-15Z " +
    "M260.5 684.5h15v25h-15Z M256.8 498.5h22.4v19h-22.4Z M279.2 461.5h7v56h-7Z M305 " +
    "634.28h84v135.72h-84Z M324.5 664.28h15v25h-15Z M354.5 664.28h15v25h-15Z M318.4 " +
    "597.7h57.1v37.5h-57.1Z M327.6 561.2h38.8v37.5h-38.8Z M403 507L467 545.4V770H403Z M427.5 " +
    "575.4h15v25h-15Z M427.5 621.4h15v25h-15Z M427.5 667.4h15v25h-15Z M481 442.6h96v327.4h-96Z M506.5 " +
    "472.6h15v25h-15Z M536.5 472.6h15v25h-15Z M506.5 518.6h15v25h-15Z M536.5 518.6h15v25h-15Z M536.5 " +
    "564.6h15v25h-15Z M536.5 610.6h15v25h-15Z M506.5 656.6h15v25h-15Z M536.5 656.6h15v25h-15Z M506.5 " +
    "702.6h15v25h-15Z M536.5 702.6h15v25h-15Z M595 334.5h48v435.5h-48Z M611.5 364.5h15v25h-15Z M611.5 " +
    "410.5h15v25h-15Z M611.5 456.5h15v25h-15Z M611.5 502.5h15v25h-15Z M611.5 548.5h15v25h-15Z M611.5 " +
    "686.5h15v25h-15Z M652 409.9h72v360.1h-72Z M680.5 439.9h15v25h-15Z M680.5 485.9h15v25h-15Z M680.5 " +
    "531.9h15v25h-15Z M680.5 577.9h15v25h-15Z M680.5 623.9h15v25h-15Z M702.4 354.9h7v56h-7Z M742 " +
    "436.5L800 401.7V770H742Z M763.5 466.5h15v25h-15Z M763.5 512.5h15v25h-15Z M763.5 604.5h15v25h-15Z " +
    "M763.5 650.5h15v25h-15Z M763.5 696.5h15v25h-15Z",
  right:
    "M800 430.3h56v339.7h-56Z M820.5 460.3h15v25h-15Z M820.5 552.3h15v25h-15Z M820.5 598.3h15v25h-15Z " +
    "M820.5 644.3h15v25h-15Z M820.5 690.3h15v25h-15Z M865 302.9h96v467.1h-96Z M890.5 332.9h15v25h-15Z " +
    "M920.5 332.9h15v25h-15Z M890.5 378.9h15v25h-15Z M920.5 424.9h15v25h-15Z M890.5 470.9h15v25h-15Z " +
    "M920.5 470.9h15v25h-15Z M890.5 516.9h15v25h-15Z M920.5 516.9h15v25h-15Z M890.5 562.9h15v25h-15Z " +
    "M920.5 562.9h15v25h-15Z M920.5 608.9h15v25h-15Z M890.5 654.9h15v25h-15Z M920.5 654.9h15v25h-15Z " +
    "M890.5 700.9h15v25h-15Z M920.5 700.9h15v25h-15Z M970 332.9h48v437.1h-48Z M986.5 362.9h15v25h-15Z " +
    "M986.5 408.9h15v25h-15Z M986.5 454.9h15v25h-15Z M986.5 500.9h15v25h-15Z M986.5 546.9h15v25h-15Z " +
    "M986.5 684.9h15v25h-15Z M1003.6 277.9h7v56h-7Z M1027 570.71h96v199.29h-96Z M1052.5 " +
    "600.71h15v25h-15Z M1082.5 600.71h15v25h-15Z M1082.5 646.71h15v25h-15Z M1052.5 692.71h15v25h-15Z " +
    "M1042.4 463.4h65.3v108.3h-65.3Z M1137 413h96v357h-96Z M1162.5 443h15v25h-15Z M1192.5 " +
    "443h15v25h-15Z M1162.5 489h15v25h-15Z M1192.5 489h15v25h-15Z M1162.5 535h15v25h-15Z M1192.5 " +
    "535h15v25h-15Z M1162.5 581h15v25h-15Z M1192.5 581h15v25h-15Z M1162.5 627h15v25h-15Z M1192.5 " +
    "673h15v25h-15Z M1242 532L1298 498.4V770H1242Z M1262.5 562h15v25h-15Z M1262.5 608h15v25h-15Z " +
    "M1262.5 654h15v25h-15Z M1262.5 700h15v25h-15Z M1312 486.7h72v283.3h-72Z M1340.5 516.7h15v25h-15Z " +
    "M1340.5 608.7h15v25h-15Z M1340.5 654.7h15v25h-15Z M1340.5 700.7h15v25h-15Z M1333.6 " +
    "468.7h28.8v19h-28.8Z M1393 507.1L1465 550.3V770H1393Z M1421.5 626.3h15v25h-15Z M1421.5 " +
    "672.3h15v25h-15Z M1474 542.9L1546 586.1V770H1474Z M1502.5 616.1h15v25h-15Z M1564 " +
    "615.9h36v154.1h-36Z M1589.2 560.9h7v56h-7Z",
  // The centre mark: two interlocking pieces, traced from the supplied 98×185 PNG
  // and scaled to 400 frame units tall around CENTER.
  center:
    "M791 215 L881.8 266.9 L760.7 336.1 L760.7 472.3 L672.1 422.6 L672.1 284.2 Z " +
    "M793.1 355.5 L881.8 405.3 L881.8 543.6 L760.7 615 L674.2 560.9 L793.1 491.8 Z",
};

const FRAME_W = 1600;
const FRAME_H = 900;
/** Where the scaffold and the centre shape are centred, in the frame. */
const CENTER = { x: 778, y: 415, rx: 330, ry: 360 };

const CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
const BG = "#061411";
// Atlas tints around #63C0AA. 0–2 teal (dim → bright), 3 pale mint, 4 white, 5 scaffold.
const TINTS = ["#4fb09a", "#6fd0b9", "#a0eedb", "#dcfaf2", "#ffffff", "#3f7568"];
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
      g.addColorStop(0, `rgba(99,192,170,${0.4 * ptr.onS})`);
      g.addColorStop(0.35, `rgba(70,160,140,${0.18 * ptr.onS})`);
      g.addColorStop(1, "rgba(40,110,95,0)");
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
          a = cVal[i] * (0.88 + 0.12 * bright[i]);
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
            // Solid up top, thinning out only over the lowest part of each column.
            const low = smooth(0.55, 1, depth);
            const thin = sideBright[si] > low * 0.9 ? 1 : 0.3;
            a = side * sideFade * thin * (0.72 + 0.28 * sideBright[si]) * (1 - low * 0.45);
            if (!reduced && now >= sideSwap[si]) {
              sideGlyph[si] = rc();
              sideSwap[si] = now + 2500 + Math.random() * 9000;
            }
            gi = hot ? glyph[i] : sideGlyph[si];
            tint = hv > 0.55 ? T_WHITE : hv > 0.3 ? T_LAV : sideBright[si] > 0.82 ? 2 : sideBright[si] > 0.4 ? 1 : 0;
            if (now - born < 1400 && sideBorn[si] > intro - 0.08) tint = T_LAV; // decode shimmer
          } else if (scaffold[i] > 0) {
            // ---- scaffold around the centre
            a = scaffold[i] * scaff * 0.28 * intro + hv * 0.9 * (scaffold[i] > 0 ? 1 : 0);
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
