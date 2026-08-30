/**
 * Turn whatever the editor produced into the constrained HTML the site renders.
 *
 * This is not a security nicety bolted on at the end — it is the contract. The
 * article template, the quality gate and the RSS feed all assume a small, known
 * set of tags. A contenteditable will happily emit <font>, <span style>, class
 * attributes from a Word paste, and <script> if someone pastes cleverly. Every
 * one of those either breaks the typography or is an XSS vector, because the
 * body is injected with dangerouslySetInnerHTML.
 *
 * The approach is allow-list only: anything not named here is dropped, and
 * unknown tags are unwrapped rather than deleted so the words survive.
 *
 * Runs on the server, on save. Never trust the client to have done it.
 */

const ALLOWED_TAGS = new Set([
  "p", "h2", "h3", "ul", "ol", "li", "table", "thead", "tbody", "tr", "th", "td",
  "strong", "em", "a", "blockquote", "br", "code", "figure", "figcaption", "img",
]);

/** Tags whose entire contents must go, not just the tag. */
const DROP_WITH_CONTENT = new Set(["script", "style", "iframe", "object", "embed", "noscript"]);

const ALLOWED_ATTRS: Record<string, Set<string>> = {
  a: new Set(["href", "title"]),
  img: new Set(["src", "alt", "width", "height", "loading"]),
};

/** Only these can appear in an href. javascript: and data: are the reason. */
function safeHref(value: string): string | null {
  const v = value.trim();
  if (/^(https?:\/\/|mailto:|tel:|\/|#)/i.test(v) && !/^javascript:/i.test(v)) {
    return v.replace(/"/g, "&quot;");
  }
  return null;
}

function safeSrc(value: string): string | null {
  const v = value.trim();
  if (/^https?:\/\//i.test(v) || v.startsWith("/")) return v.replace(/"/g, "&quot;");
  return null;
}

/**
 * A small tag-level rewriter. A full DOM parser would be nicer, but this runs
 * server-side in a route handler where there is no DOM, and pulling in a parser
 * for this is more dependency than the job needs.
 */
export function sanitiseHtml(input: string): string {
  let html = String(input ?? "");

  // 1. Remove dangerous elements together with everything inside them.
  for (const tag of DROP_WITH_CONTENT) {
    html = html.replace(new RegExp(`<${tag}\\b[\\s\\S]*?</${tag}>`, "gi"), "");
    html = html.replace(new RegExp(`<${tag}\\b[^>]*/?>`, "gi"), "");
  }

  // 2. HTML comments, including conditional comments from Word.
  html = html.replace(/<!--[\s\S]*?-->/g, "");

  // 3. Rewrite every remaining tag.
  html = html.replace(/<(\/?)([a-zA-Z][a-zA-Z0-9]*)\b([^>]*)>/g, (_m, close: string, rawName: string, attrs: string) => {
    const name = rawName.toLowerCase();

    // Common editor output mapped onto what the template styles.
    const mapped =
      name === "b" ? "strong"
      : name === "i" ? "em"
      : name === "div" ? "p"
      : name === "h1" ? "h2"          // the template renders its own h1
      : name === "h4" || name === "h5" || name === "h6" ? "h3"
      : name;

    if (!ALLOWED_TAGS.has(mapped)) return "";      // unwrap: keep the text
    if (close) return `</${mapped}>`;

    const allowed = ALLOWED_ATTRS[mapped];
    if (!allowed) return `<${mapped}>`;

    const kept: string[] = [];
    for (const m of attrs.matchAll(/([a-zA-Z-]+)\s*=\s*"([^"]*)"|([a-zA-Z-]+)\s*=\s*'([^']*)'/g)) {
      const key = (m[1] ?? m[3] ?? "").toLowerCase();
      const value = m[2] ?? m[4] ?? "";
      if (!allowed.has(key)) continue;

      if (key === "href") {
        const safe = safeHref(value);
        if (safe) kept.push(`href="${safe}"`);
      } else if (key === "src") {
        const safe = safeSrc(value);
        if (safe) kept.push(`src="${safe}"`);
      } else if (key === "width" || key === "height") {
        if (/^\d{1,4}$/.test(value)) kept.push(`${key}="${value}"`);
      } else {
        kept.push(`${key}="${value.replace(/"/g, "&quot;")}"`);
      }
    }

    if (mapped === "a" && !kept.some((k) => k.startsWith("href="))) return "";
    if (mapped === "img") {
      if (!kept.some((k) => k.startsWith("src="))) return "";
      if (!kept.some((k) => k.startsWith("alt="))) kept.push('alt=""');
      kept.push('loading="lazy"');
    }

    return `<${mapped}${kept.length ? " " + kept.join(" ") : ""}>`;
  });

  // 4. Balance the tags.
  //
  //    Dropping an opening tag — an <a> with a javascript: href, say — leaves
  //    its </a> behind, and a stray closing tag corrupts the rest of the
  //    document when React injects it. So walk the tokens with a stack:
  //    discard closers that match nothing, and close anything left open.
  html = balance(html);

  // 5. Wrap loose text in a paragraph.
  //
  //    A contenteditable will happily leave the first line you type as a bare
  //    text node at the top level. It looks fine in the editor and then has no
  //    paragraph styling at all on the site, running straight into the next
  //    heading. Anything sitting outside a block element gets a <p> here.
  html = wrapLooseText(html);

  // 6. Tidy up what the rewriting leaves behind.
  return html
    .replace(/<p>(\s|&nbsp;|<br>)*<\/p>/gi, "")
    .replace(/\s+/g, " ")
    .replace(/>\s+</g, "><")
    .trim();
}

const VOID_TAGS = new Set(["br", "img"]);

/** Opening one of these closes any of the listed tags still open. */
const IMPLICIT_CLOSE: Record<string, Set<string>> = {
  li: new Set(["li"]),
  td: new Set(["td", "th"]),
  th: new Set(["td", "th"]),
  tr: new Set(["td", "th", "tr"]),
  p: new Set(["p"]),
};

function balance(html: string): string {
  const stack: string[] = [];
  const out: string[] = [];
  const token = /<(\/?)([a-z0-9]+)((?:\s[^>]*)?)>/gi;

  let last = 0;
  for (const m of html.matchAll(token)) {
    out.push(html.slice(last, m.index));
    last = m.index + m[0].length;

    const closing = m[1] === "/";
    const name = m[2].toLowerCase();

    if (VOID_TAGS.has(name)) {
      if (!closing) out.push(m[0]);
      continue;
    }

    if (!closing) {
      // Tags that close the previous sibling implicitly. Browsers do this for
      // you; pasted markup often relies on it and would otherwise nest.
      const implicitlyCloses = IMPLICIT_CLOSE[name];
      while (implicitlyCloses && stack.length && implicitlyCloses.has(stack[stack.length - 1])) {
        out.push(`</${stack.pop()}>`);
      }
      stack.push(name);
      out.push(m[0]);
      continue;
    }

    const at = stack.lastIndexOf(name);
    if (at === -1) continue; // orphan closer — drop it

    // Close anything opened inside this element but never closed.
    for (let i = stack.length - 1; i > at; i--) out.push(`</${stack[i]}>`);
    out.push(`</${name}>`);
    stack.length = at;
  }
  out.push(html.slice(last));

  while (stack.length) out.push(`</${stack.pop()}>`);
  return out.join("");
}

/** Plain text, for word counts and excerpts. */
export function textOf(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

export function wordCount(html: string): number {
  return textOf(html).split(/\s+/).filter(Boolean).length;
}

/** Lowercase, hyphenated, safe in a URL. */
export function slugify(input: string): string {
  return String(input ?? "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

/** Block-level tags: anything not inside one of these needs a paragraph. */
const BLOCK_TAGS = new Set([
  "p", "h2", "h3", "ul", "ol", "li", "table", "thead", "tbody", "tr", "th", "td",
  "blockquote", "figure", "figcaption",
]);

function wrapLooseText(html: string): string {
  const out: string[] = [];
  let loose: string[] = [];
  let depth = 0;

  const flush = () => {
    const text = loose.join("").trim();
    loose = [];
    if (text && textOf(text)) out.push(`<p>${text}</p>`);
  };

  const token = /<(\/?)([a-z0-9]+)((?:\s[^>]*)?)>/gi;
  let last = 0;

  for (const m of html.matchAll(token)) {
    const between = html.slice(last, m.index);
    last = m.index + m[0].length;
    (depth === 0 ? loose : out).push(between);

    const closing = m[1] === "/";
    const name = m[2].toLowerCase();
    const isBlock = BLOCK_TAGS.has(name);

    if (isBlock && !closing) {
      if (depth === 0) flush();
      depth++;
      out.push(m[0]);
    } else if (isBlock && closing) {
      depth = Math.max(0, depth - 1);
      out.push(m[0]);
    } else {
      // An inline tag (or a void one) — part of whatever it sits in.
      (depth === 0 ? loose : out).push(m[0]);
    }
  }

  (depth === 0 ? loose : out).push(html.slice(last));
  flush();
  return out.join("");
}
