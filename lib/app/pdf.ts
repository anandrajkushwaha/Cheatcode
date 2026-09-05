import "server-only";
import puppeteer, { type Browser } from "puppeteer-core";

/**
 * A PDF, printed by a real browser.
 *
 * The alternative was a PDF library driven from our own model, and it is the
 * wrong answer for a document like this one: it would be a second renderer,
 * and the first thing a second renderer does is disagree with the first about
 * where a line wraps. The complaint that started this — the download not
 * matching the preview — *was* that disagreement. One renderer, photographed
 * by the same engine that drew it, cannot drift.
 *
 * ------------------------------------------------------------ the binary
 *
 * Two ways to find Chrome, tried in order:
 *
 *   CHROME_PATH — a browser already on the machine. This is how it runs
 *   locally and on any host with one installed, and it costs nothing.
 *
 *   @sparticuz/chromium-min — a build small enough to ship to a serverless
 *   function, with the heavy part fetched from CHROMIUM_PACK_URL on first use
 *   and cached in /tmp for the life of the container. The URL is configuration
 *   rather than a constant because it has to match the package version, and a
 *   mismatch is a confusing crash rather than a clear one.
 *
 * If neither is available this throws, and the caller falls back to the print
 * dialog. A download button that fails silently is worse than one that admits
 * it cannot do the clever version today.
 */

let shared: Browser | null = null;

async function launch(): Promise<Browser> {
  // A warm container gets the browser it already started. Chrome takes several
  // seconds to boot, and on a page somebody presses twice that is the whole
  // difference between fast and broken.
  if (shared?.connected) return shared;

  const local = process.env.CHROME_PATH;
  if (local) {
    shared = await puppeteer.launch({
      executablePath: local,
      headless: true,
      args: ["--no-sandbox", "--disable-dev-shm-usage", "--font-render-hinting=none"],
    });
    return shared;
  }

  const chromium = (await import("@sparticuz/chromium-min")).default;
  const pack = process.env.CHROMIUM_PACK_URL;
  const executablePath = await chromium.executablePath(pack);
  if (!executablePath) {
    throw new Error("No Chrome available to print with.");
  }

  shared = await puppeteer.launch({
    executablePath,
    args: chromium.args,
    defaultViewport: { width: 1200, height: 1700 },
    headless: true,
  });
  return shared;
}

export async function htmlToPdf(html: string): Promise<Uint8Array> {
  const browser = await launch();
  const page = await browser.newPage();
  try {
    await page.setContent(html, { waitUntil: "load", timeout: 25_000 });

    /**
     * Wait for the fonts, not just for the page.
     *
     * `load` means the stylesheet arrived; it does not mean the faces it
     * points at have been decoded and applied. Printing a beat too early
     * silently produces the fallback font, every line wraps somewhere else,
     * and the PDF is a different document from the one on screen. Five seconds
     * is a ceiling, not a wait — it resolves as soon as the fonts are ready.
     */
    await page.evaluate(
      () =>
        Promise.race([
          document.fonts.ready,
          new Promise((resolve) => setTimeout(resolve, 5000)),
        ]),
    );

    return await page.pdf({
      printBackground: true,
      // The document already states its own page size and margins; letting
      // Puppeteer impose A4 on top adds a second margin and shrinks
      // everything by a few per cent.
      preferCSSPageSize: true,
      timeout: 25_000,
    });
  } finally {
    // The page closes, the browser stays. Closing the browser would throw away
    // the several seconds it took to start, on every single download.
    await page.close().catch(() => {});
  }
}
