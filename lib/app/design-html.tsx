import "server-only";
import { DesignPage, DESIGN_SHEET } from "@/components/app/DesignPage";
import { A4, type Design } from "@/lib/app/design";
import { GOOGLE_FONTS_HREF } from "@/lib/app/resume-style";

/**
 * The design as a standalone HTML document, for printing.
 *
 * The same `DesignPage` the editor draws with — that is the whole reason the
 * renderer is one component and not three. The complaint this answers is
 * "live preview aur download ke baad ka preview same nahi": they were two
 * different renderers before, so of course they disagreed about where a page
 * broke. Here there is one, and the PDF is a photograph of it.
 *
 * `@page { size: A4; margin: 0 }` with `preferCSSPageSize` means the sheet is
 * exactly the element: no printer margin is added around a page that already
 * has its own, and a full-bleed sidebar reaches the paper's edge instead of
 * stopping twelve millimetres short.
 */
export async function designHtml(design: Design, title: string): Promise<string> {
  /**
   * Imported here rather than at the top of the file.
   *
   * Next refuses a static `react-dom/server` import anywhere in a route's
   * module graph — it is nearly always a sign of a client component rendering
   * itself to a string. This one is the legitimate case: a server route
   * turning a page into HTML for a headless browser to print. A dynamic import
   * keeps it out of the static trace, and `server-only` above still guarantees
   * it can never end up in a bundle sent to anybody.
   */
  const { renderToStaticMarkup } = await import("react-dom/server");

  const pages = design.pages
    .map((p) => renderToStaticMarkup(<DesignPage page={p} />))
    .join("");

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<title>${escapeHtml(title)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="${GOOGLE_FONTS_HREF}">
<style>
  @page { size: ${A4.w}mm ${A4.h}mm; margin: 0; }
  html, body { margin: 0; padding: 0; background: #fff; }
  /* Each page is its own sheet. Breaking after every page but the last is
     what stops a trailing blank sheet, which a naive rule produces. */
  .dp-page { break-after: page; }
  .dp-page:last-child { break-after: auto; }
${DESIGN_SHEET}
</style>
</head>
<body>${pages}</body>
</html>`;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] ?? c,
  );
}

/**
 * A file name somebody will recognise in their Downloads folder.
 *
 * "Cheatcode.pdf" — which is what the print dialog produced, because it names
 * the file after the page's title — tells you nothing when there are four of
 * them. This names it after the résumé, with the characters a filesystem
 * objects to removed rather than replaced, so "Anand Raj — Design Manager"
 * stays readable.
 */
export function pdfFileName(title: string): string {
  const clean = title
    // Only what a filesystem actually refuses. Written out rather than as a
    // range: `[ -<]` looks tidy and quietly eats every digit, because it
    // spans 0x20 to 0x3C.
    .replace(/[<>:"/\\|?*]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
  return `${clean || "Resume"}.pdf`;
}
