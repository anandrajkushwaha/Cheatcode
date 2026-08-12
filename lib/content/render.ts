import type { TocItem } from "@/types/db";

/**
 * Adds `id` attributes to <h2>/<h3> so the table of contents can link to them.
 * IDs are derived from heading text the same way the TOC was built, so the two
 * always agree. A counter suffix guarantees uniqueness if two headings match.
 */
export function withHeadingIds(html: string, _toc: TocItem[] = []): string {
  const seen = new Map<string, number>();

  return html.replace(
    /<(h2|h3)([^>]*)>([\s\S]*?)<\/\1>/g,
    (match, tag: string, attrs: string, inner: string) => {
      if (/\sid=/.test(attrs)) return match;

      const text = inner.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
      const base =
        text
          .toLowerCase()
          .replace(/&[a-z]+;/g, " ")
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-+|-+$/g, "") || tag;

      const n = seen.get(base) ?? 0;
      seen.set(base, n + 1);
      const id = n === 0 ? base : `${base}-${n + 1}`;

      return `<${tag}${attrs} id="${id}">${inner}</${tag}>`;
    },
  );
}
