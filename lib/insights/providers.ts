import "server-only";

/**
 * Reading a feed, without adding a parser to the bundle.
 *
 * An XML library would be the obvious call and it is the wrong one here. The
 * shapes this has to survive are RSS 2.0 and Atom, both of which put the four
 * fields we want in predictable places, and the alternative is a dependency
 * in the server bundle for a job that runs once a day. So this extracts what
 * it needs and ignores everything else.
 *
 * The honest limitation, written down rather than discovered later: this is
 * not a general XML parser. It will not cope with a feed that nests an <item>
 * inside an <item>, and it takes the first match for each field rather than
 * resolving namespaces properly. Every feed in insight_sources is checked
 * against it once when it is added, and a feed that parses to zero items
 * records that on its source row instead of failing quietly.
 */

export type FeedItem = {
  externalId: string;
  title: string;
  summary: string | null;
  url: string;
  imageUrl: string | null;
  publishedAt: string | null;
};

export type FetchFeedResult =
  | { ok: true; items: FeedItem[] }
  | { ok: false; error: string };

/** A feed that has not answered in this long is not going to. */
const TIMEOUT_MS = 15_000;

/** Enough for a panel and a list page; the rest of the feed is history. */
const MAX_ITEMS = 40;

/** Long enough to be worth reading, short enough to stay an excerpt. */
const SUMMARY_CHARS = 220;

/* ------------------------------------------------------------- text bits */

function stripCdata(value: string): string {
  return value.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1");
}

const NAMED: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  hellip: "…",
  rsquo: "’",
  lsquo: "‘",
  ldquo: "“",
  rdquo: "”",
  ndash: "–",
  mdash: "—",
};

function decodeEntities(value: string): string {
  return value
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) =>
      String.fromCodePoint(parseInt(hex, 16)),
    )
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(Number(dec)))
    .replace(/&([a-z]+);/gi, (whole, name: string) => NAMED[name.toLowerCase()] ?? whole);
}

function stripTags(value: string): string {
  return value.replace(/<[^>]*>/g, " ");
}

/**
 * Decode, strip, decode.
 *
 * The repeat is not belt-and-braces, it is the whole trick. RSS tends to wrap
 * HTML in CDATA, where stripping tags first works fine. Atom escapes it
 * instead — the body arrives as &lt;p&gt;… — so a strip-then-decode order
 * finds no tags to remove, decodes the escapes afterwards, and leaves literal
 * <p> tags sitting in the excerpt. Decoding first turns those escapes back
 * into real tags so the strip can see them; the second decode then handles
 * entities that were inside the text all along, like &mdash;.
 *
 * Over-decoding a doubly-escaped string is possible and harmless: the result
 * is rendered as text by React, never as markup, so the worst case is a
 * stray angle bracket in an excerpt rather than anything executable.
 */
function tidy(value: string): string {
  const decoded = decodeEntities(stripCdata(value));
  return decodeEntities(stripTags(decoded)).replace(/\s+/g, " ").trim();
}

function truncate(value: string, max: number): string {
  if (value.length <= max) return value;
  // Cut on a word boundary so the excerpt does not end mid-word.
  const cut = value.slice(0, max);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
}

/** First occurrence of <name>...</name>, namespace prefix tolerated. */
function tagContent(block: string, name: string): string | null {
  const re = new RegExp(
    `<(?:[a-z0-9]+:)?${name}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/(?:[a-z0-9]+:)?${name}>`,
    "i",
  );
  return re.exec(block)?.[1] ?? null;
}

/** An attribute off the first matching self-closing or opening tag. */
function tagAttr(block: string, name: string, attr: string): string | null {
  const re = new RegExp(`<(?:[a-z0-9]+:)?${name}\\s[^>]*${attr}=["']([^"']+)["']`, "i");
  return re.exec(block)?.[1] ?? null;
}

/* ------------------------------------------------------------ one entry */

function linkOf(block: string): string | null {
  // RSS puts the URL inside <link>. Atom puts it on a href attribute, and may
  // carry several — the one we want is the alternate, which is also the
  // default when rel is absent.
  const plain = tagContent(block, "link");
  if (plain) {
    const text = tidy(plain);
    if (/^https?:\/\//i.test(text)) return text;
  }

  const alternate =
    /<(?:[a-z0-9]+:)?link\s[^>]*rel=["']alternate["'][^>]*href=["']([^"']+)["']/i.exec(block)?.[1] ??
    /<(?:[a-z0-9]+:)?link\s[^>]*href=["']([^"']+)["'][^>]*rel=["']alternate["']/i.exec(block)?.[1] ??
    tagAttr(block, "link", "href");

  return alternate ? decodeEntities(alternate) : null;
}

function imageOf(block: string): string | null {
  const candidate =
    tagAttr(block, "enclosure", "url") ??
    tagAttr(block, "content", "url") ??
    tagAttr(block, "thumbnail", "url") ??
    // Some feeds only ever put the image inside the HTML description.
    /<img[^>]+src=["']([^"']+)["']/i.exec(stripCdata(block))?.[1] ??
    null;

  if (!candidate) return null;
  const url = decodeEntities(candidate);
  return /^https?:\/\//i.test(url) ? url : null;
}

function dateOf(block: string): string | null {
  const raw =
    tagContent(block, "pubDate") ??
    tagContent(block, "published") ??
    tagContent(block, "updated") ??
    tagContent(block, "date");
  if (!raw) return null;

  const parsed = new Date(tidy(raw));
  // An unparseable date is better as nothing than as 1970, which would sort
  // the item to the bottom forever.
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function parseEntry(block: string): FeedItem | null {
  const title = tagContent(block, "title");
  const url = linkOf(block);
  if (!title || !url) return null;

  const cleanTitle = truncate(tidy(title), 180);
  if (!cleanTitle) return null;

  const body =
    tagContent(block, "description") ??
    tagContent(block, "summary") ??
    tagContent(block, "encoded") ??
    tagContent(block, "content");

  const summary = body ? truncate(tidy(body), SUMMARY_CHARS) : null;

  const guid = tagContent(block, "guid") ?? tagContent(block, "id");

  return {
    externalId: (guid ? tidy(guid) : url).slice(0, 400),
    title: cleanTitle,
    summary: summary || null,
    url,
    imageUrl: imageOf(block),
    publishedAt: dateOf(block),
  };
}

/* --------------------------------------------------------------- fetch */

export async function fetchFeed(feedUrl: string): Promise<FetchFeedResult> {
  let res: Response;

  try {
    res = await fetch(feedUrl, {
      headers: {
        Accept: "application/rss+xml, application/atom+xml, application/xml, text/xml, */*",
        // Named honestly. A publisher who wants to block us should be able to.
        "User-Agent": "cheatcodeapp.com insights reader",
      },
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store",
    });
  } catch (e) {
    const timedOut = e instanceof Error && e.name === "TimeoutError";
    return { ok: false, error: timedOut ? "Timed out" : "Could not reach the feed" };
  }

  if (res.status === 404) return { ok: false, error: "Feed not found — check the URL" };
  if (res.status === 429) return { ok: false, error: "Rate limited" };
  if (!res.ok) return { ok: false, error: `Feed returned ${res.status}` };

  let xml: string;
  try {
    xml = await res.text();
  } catch {
    return { ok: false, error: "Feed body could not be read" };
  }

  const items = parseFeedXml(xml);

  if (items.length === 0) {
    return {
      ok: false,
      error: "No usable items — is this an RSS or Atom feed?",
    };
  }

  return { ok: true, items };
}

/**
 * XML in, items out — and nothing else.
 *
 * Split from fetchFeed so the parsing can be exercised against saved feed
 * samples without a network call. Transport fails in ways a test cannot
 * usefully reproduce; parsing fails in ways it absolutely can.
 */
export function parseFeedXml(xml: string): FeedItem[] {
  const blocks = [
    ...xml.matchAll(/<(?:[a-z0-9]+:)?item(?:\s[^>]*)?>([\s\S]*?)<\/(?:[a-z0-9]+:)?item>/gi),
    ...xml.matchAll(/<(?:[a-z0-9]+:)?entry(?:\s[^>]*)?>([\s\S]*?)<\/(?:[a-z0-9]+:)?entry>/gi),
  ];

  const items: FeedItem[] = [];
  const seen = new Set<string>();

  for (const match of blocks) {
    const item = parseEntry(match[1]);
    if (!item || seen.has(item.externalId)) continue;
    seen.add(item.externalId);
    items.push(item);
    if (items.length >= MAX_ITEMS) break;
  }

  return items;
}
