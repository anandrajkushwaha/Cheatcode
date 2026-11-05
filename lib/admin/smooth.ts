/** Shared by the client charts (components/admin/charts.tsx) and the server ones (ui.tsx). */

/**
 * A soft, wave-like line through the points (Catmull–Rom, drawn as cubic
 * Béziers): every turn is rounded, the way the reference charts flow, rather
 * than flat runs and sharp knees. Control points are kept inside the chart
 * (`top`…`bottom`), so a day with zero never dips below the axis.
 */
export function smoothPath(pts: [number, number][], top = -Infinity, bottom = Infinity): string {
  const n = pts.length;
  if (n === 0) return "";
  if (n === 1) return `M${pts[0][0]},${pts[0][1]}`;
  const clamp = (v: number) => Math.min(bottom, Math.max(top, v));
  const f = (v: number) => v.toFixed(1);
  let d = `M${f(pts[0][0])},${f(pts[0][1])}`;
  for (let i = 0; i < n - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] ?? p2;
    const c1x = p1[0] + (p2[0] - p0[0]) / 6;
    const c1y = clamp(p1[1] + (p2[1] - p0[1]) / 6);
    const c2x = p2[0] - (p3[0] - p1[0]) / 6;
    const c2y = clamp(p2[1] - (p3[1] - p1[1]) / 6);
    d += ` C${f(c1x)},${f(c1y)} ${f(c2x)},${f(c2y)} ${f(p2[0])},${f(p2[1])}`;
  }
  return d;
}

