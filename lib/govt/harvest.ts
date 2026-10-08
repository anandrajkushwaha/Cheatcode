import "server-only";
import { launch } from "@/lib/app/pdf";

/**
 * Reading a recruitment board's page.
 *
 * Rendered in a real browser rather than fetched and parsed, and that is not
 * belt and braces. SSC's site serves metadata and nothing else — the notice
 * board is built by JavaScript after load, so an HTTP fetch returns a page
 * with no notices on it and no error to say why. Several of these boards are
 * built the same way.
 *
 * What comes back is deliberately dumb: every link on the page, with the text
 * somebody would click. No attempt to understand the markup, because ten
 * government sites have ten layouts and all of them are redesigned without
 * warning. Deciding which of these links is a recruitment notice is a
 * judgement, and it is made in classify.ts by something better at judgement
 * than a CSS selector.
 */

export type Harvested = {
  /** Every link worth considering, nearest the top of the page first. */
  links: { url: string; text: string }[];
  /** A fingerprint of those links, for skipping a page that has not changed. */
  hash: string;
  title: string;
};

/** Links that are never a notice, on every one of these sites. */
const NEVER = [
  /\/(login|signin|register|sitemap|privacy|disclaimer|accessibility|help|feedback|contact|rti|tender)\b/i,
  /^(mailto|tel|javascript):/i,
  /\.(jpg|jpeg|png|gif|svg|css|js|ico|woff2?)(\?|$)/i,
  /\b(facebook|twitter|x\.com|youtube|instagram|linkedin|whatsapp)\./i,
];

/** Boilerplate link text, whatever it points at. */
const NOISE =
  /^(home|back|next|previous|more|read more|click here|skip to main content|english|hindi|screen reader|a\+|a-|a)$/i;

export async function harvest(url: string, timeoutMs = 30_000): Promise<Harvested> {
  const browser = await launch();
  const page = await browser.newPage();

  try {
    // A descriptive agent, because this is a thing we are doing openly to a
    // public page and the owner of that page should be able to see who.
    await page.setUserAgent(
      "Mozilla/5.0 (compatible; CheatcodeBot/1.0; +https://cheatcodeapp.com/government-jobs)",
    );

    // `domcontentloaded` and then a settle, rather than `networkidle`: these
    // sites often hold a connection open for a ticker or an analytics beacon,
    // and networkidle waits for something that never comes.
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: timeoutMs });
    await page
      .waitForFunction("document.querySelectorAll('a').length > 20", { timeout: 8_000 })
      .catch(() => {
        // A page with twenty links is the usual sign the app has rendered.
        // Not every board has that many, so a timeout here is not a failure —
        // it just means we read whatever is there now.
      });

    const found = await page.evaluate(() => {
      const out: { url: string; text: string }[] = [];
      for (const a of Array.from(document.querySelectorAll("a[href]"))) {
        const href = (a as HTMLAnchorElement).href;
        const text = (a.textContent ?? "").replace(/\s+/g, " ").trim();
        if (href && text) out.push({ url: href, text });
      }
      return { links: out, title: document.title };
    });

    const seen = new Set<string>();
    const links = found.links
      .filter((l) => l.text.length >= 8 && l.text.length <= 300)
      .filter((l) => !NOISE.test(l.text))
      .filter((l) => !NEVER.some((re) => re.test(l.url)))
      .filter((l) => {
        // Same destination twice — an icon beside its own title — is one link.
        if (seen.has(l.url)) return false;
        seen.add(l.url);
        return true;
      })
      .slice(0, 120);

    return { links, title: found.title, hash: fingerprint(links) };
  } finally {
    await page.close().catch(() => {});
  }
}

/**
 * A fingerprint of what is on the page, not of the page.
 *
 * Taken over the links alone because these sites re-render a clock, a visitor
 * counter or a rotating banner on every request — hash the HTML and the page
 * has "changed" every single run, which turns the whole monitor into a
 * full-cost fetch-and-read of ten boards every hour, for nothing.
 */
function fingerprint(links: { url: string; text: string }[]): string {
  const joined = links.map((l) => `${l.url}|${l.text}`).join("\n");
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193;
  for (let i = 0; i < joined.length; i++) {
    const c = joined.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 0x01000193);
    h2 = Math.imul(h2 + c, 0x85ebca6b) ^ (h2 >>> 13);
  }
  return `${(h1 >>> 0).toString(16)}${(h2 >>> 0).toString(16)}`;
}
