import "server-only";
import type { Resume } from "@/lib/app/resume-schema";
import type { Presentation } from "@/lib/app/resume-style";
import { GOOGLE_FONTS_HREF, fontStack } from "@/lib/app/resume-style";
import { buildBlocks } from "@/lib/app/flow/blocks";
import { flowTheme } from "@/lib/app/flow/theme";
import { A4_H, A4_W, planPages } from "@/lib/app/flow/layout";
import { FlowPages, FlowProbe } from "@/components/app/flow/FlowPages";
import { htmlToPdfMeasured } from "@/lib/app/pdf";

/**
 * The résumé the builder shows, as a PDF.
 *
 * One renderer, printed twice. `FlowPages` is the same component the editor
 * paints the preview with, and the heights it is paginated from are measured
 * in the very browser doing the printing — so the file somebody downloads
 * breaks its pages in exactly the places they watched it break on screen.
 * The old download went through the canvas design instead, which is why it
 * came out as a different document from the one that was edited.
 */
export async function flowPdf(input: {
  resume: Resume;
  templateId: string | null;
  styles: Presentation;
  photo: string | null;
  title: string;
}): Promise<Uint8Array> {
  /**
   * Imported here rather than at the top of the file.
   *
   * Next refuses a static `react-dom/server` import anywhere in a route's
   * module graph — it is nearly always a client component rendering itself
   * to a string. This is the legitimate case, and `server-only` above still
   * guarantees none of it can reach a browser bundle.
   */
  const { renderToStaticMarkup } = await import("react-dom/server");

  const d = input.styles.doc ?? {};
  const theme = flowTheme(input.templateId, {
    accent: d.accent,
    font: fontStack(d.font),
    scale: d.scale,
    density: d.density,
  });
  const blocks = buildBlocks(input.resume, theme, { photo: input.photo });

  const shell = (body: string, extra = "") => `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<title>${escapeHtml(input.title)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="${GOOGLE_FONTS_HREF}">
<style>
  @page { size: ${A4_W}mm ${A4_H}mm; margin: 0; }
  html, body { margin: 0; padding: 0; background: #fff; }
  * { box-sizing: border-box; }
  h2, p { margin: 0; }
${extra}
</style>
</head>
<body>${body}</body>
</html>`;

  return htmlToPdfMeasured(
    shell(renderToStaticMarkup(<FlowProbe blocks={blocks} theme={theme} />)),
    (heights) =>
      shell(
        renderToStaticMarkup(
          <FlowPages blocks={blocks} plan={planPages(blocks, heights, theme)} theme={theme} />,
        ),
        /* The sheets are stacked with air between them on screen. On paper
           the air is the page break, and the last sheet must not ask for one
           or the file ends with a blank page. `!important` because the gap is
           an inline style on the component both renderers share. */
        `  body > div { gap: 0 !important; }
  [data-page] { break-after: page; }
  [data-page]:last-child { break-after: auto; }`,
      ),
  );
}

const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!,
  );
