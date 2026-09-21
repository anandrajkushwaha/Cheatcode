import "server-only";

/**
 * Reading news feeds, with no dependency.
 *
 * RSS 2.0 and Atom are both small, regular XML, and every field used here is
 * a flat element inside an <item> or <entry>. A regex reader is enough, it
 * cannot pull in a parser with its own bugs, and when a feed is malformed the
 * worst outcome is that feed contributing nothing tonight.
 */

export type FeedItem = {
  title: string;
  url: string;
  /** Plain text, trimmed. Often just a sentence, sometimes nothing. */
  description: string;
  /** Who published it — the feed's own name, or the <source> Google adds. */
  sourceName: string;
  publishedAt: string | null;
};

const TIMEOUT_MS = 15_000;
const UA = "Mozilla/5.0 (compatible; CheatcodeInsights/1.0; +https://cheatcodeapp.com)";

export async function readFeed(
  url: string,
  fallbackName: string,
): Promise<{ ok: true; items: FeedItem[] } | { ok: false; error: string }> {
  let xml: string;
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": UA, Accept: "application/rss+xml, application/atom+xml, text/xml, */*" },
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store",
    });
    if (!res.ok) return { ok: false, error: `Feed returned ${res.status}` };
    xml = await res.text();
  } catch (e) {
    const timedOut = e instanceof Error && e.name === "TimeoutError";
    return { ok: false, error: timedOut ? "Timed out" : "Could not reach the feed" };
  }

  const blocks = [
    ...xml.matchAll(/<item\b[\s\S]*?<\/item>/gi),
    ...xml.matchAll(/<entry\b[\s\S]*?<\/entry>/gi),
  ].map((m) => m[0]);

  if (blocks.length === 0) return { ok: false, error: "No items in the feed" };

  const items: FeedItem[] = [];
  for (const b of blocks) {
    const title = clean(tag(b, "title"));
    const link = clean(tag(b, "link")) || (b.match(/<link\b[^>]*href="([^"]+)"/i)?.[1] ?? "");
    if (!title || !/^https?:\/\//i.test(link)) continue;

    // Google News puts the outlet in <source> and appends " - Outlet" to the
    // headline. Both are handled so the title we judge is the headline alone.
    const source = clean(tag(b, "source"));
    const headline =
      source && title.endsWith(` - ${source}`) ? title.slice(0, -(source.length + 3)) : title;

    items.push({
      title: headline.slice(0, 300),
      url: link.trim(),
      description: clean(tag(b, "description") || tag(b, "summary") || tag(b, "content")).slice(0, 1500),
      sourceName: (source || fallbackName).slice(0, 80),
      publishedAt: date(tag(b, "pubDate") || tag(b, "published") || tag(b, "updated")),
    });
  }
  return { ok: true, items };
}

/**
 * A little more to write from than the feed gives.
 *
 * Many feeds carry a headline and nothing else, and a summary written from a
 * headline alone is a summary made up. So the article page is read once for
 * its own description and opening paragraphs — used only as the facts the
 * summary may draw on, never stored. A page that will not load, or is a
 * JavaScript shell (Google News links are), just returns nothing extra.
 */
export async function readArticle(url: string): Promise<string> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": UA, Accept: "text/html" },
      signal: AbortSignal.timeout(8_000),
      redirect: "follow",
      cache: "no-store",
    });
    if (!res.ok) return "";
    const html = (await res.text()).slice(0, 400_000);

    const meta =
      html.match(/<meta[^>]+(?:property|name)=["'](?:og:description|description)["'][^>]+content=["']([^"']+)["']/i)?.[1] ??
      html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["'](?:og:description|description)["']/i)?.[1] ??
      "";

    const paras = [...html.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)]
      .map((m) => clean(m[1]))
      .filter((t) => t.length > 60)
      .slice(0, 8)
      .join("\n");

    return [clean(meta), paras].filter(Boolean).join("\n").slice(0, 3000);
  } catch {
    return "";
  }
}

/* ------------------------------------------------------------------ util */

function tag(block: string, name: string): string {
  const m = block.match(new RegExp(`<${name}\\b[^>]*>([\\s\\S]*?)<\\/${name}>`, "i"));
  return m?.[1] ?? "";
}

/** CDATA, tags and entities out; whitespace collapsed. */
function clean(s: string): string {
  return s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;|&#8217;|&rsquo;|&#8216;|&lsquo;/gi, "'")
    .replace(/&#8220;|&#8221;|&ldquo;|&rdquo;/gi, '"')
    .replace(/&#8211;|&ndash;/gi, "–")
    .replace(/&#8212;|&mdash;/gi, "—")
    .replace(/&#\d+;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function date(s: string): string | null {
  const t = clean(s);
  if (!t) return null;
  const d = new Date(t);
  if (Number.isNaN(d.getTime())) return null;
  // A date in the future is a feed bug, not news from tomorrow.
  if (d.getTime() > Date.now() + 86_400_000) return null;
  return d.toISOString();
}
