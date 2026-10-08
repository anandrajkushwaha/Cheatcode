import type { Metadata } from "next";
import { SITE } from "@/lib/seo/constants";

/**
 * `?page=` as a number, defensively.
 *
 * Anything that is not a sane page is page one rather than an error: these
 * URLs get shared, truncated and typed by hand, and a listing that 500s on
 * "?page=abc" is a listing that 500s for a crawler.
 */
export function pageFrom(sp: Record<string, string | string[] | undefined> | undefined): number {
  const raw = Array.isArray(sp?.page) ? sp?.page[0] : sp?.page;
  const n = Number(raw);
  return Number.isInteger(n) && n > 1 && n < 10_000 ? n : 1;
}

/**
 * The same page's metadata, for page two onwards.
 *
 * Each paginated page canonicalises to itself, not to page one. Pointing
 * them all at page one tells Google the other pages are duplicates, and it
 * then has no reason to crawl them — which would leave everything past the
 * newest twenty unindexed, on a site whose whole purpose is being found.
 */
export function pagedMetadata(base: Metadata, slug: string, page: number): Metadata {
  if (page <= 1) return base;

  const title = `${String(base.title ?? "")} — Page ${page}`;
  const url = `${SITE.url}/government-jobs/${slug}?page=${page}`;

  return {
    ...base,
    title,
    alternates: { canonical: url },
    openGraph: base.openGraph ? { ...base.openGraph, title, url } : undefined,
  };
}
