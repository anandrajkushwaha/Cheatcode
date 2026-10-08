import Link from "next/link";

/**
 * How many notices a full page holds.
 *
 * One number, exported, because the page that slices the rows and the thing
 * that counts the pages have to agree — disagreeing by one is how a listing
 * ends with an unreachable last row.
 */
export const PER_PAGE = 20;

/**
 * Numbered pages, 1 2 3 4, the way these sites have always done it.
 *
 * Not "load more", and not infinite scroll. Somebody checking whether last
 * month's result is listed wants to get to page four and back again, and a
 * button that forgets where you were the moment you follow a link is the
 * wrong shape for a list people leave and return to. Numbers are also links,
 * so Google can walk the whole archive.
 *
 * The window never grows past seven slots however many pages there are:
 * first, last, the three around where you are, and an ellipsis for the gaps.
 */
export function Pager({
  base,
  page,
  pages,
}: {
  /** The page's own path, e.g. /government-jobs/latest-jobs */
  base: string;
  /** One-based. */
  page: number;
  pages: number;
}) {
  if (pages <= 1) return null;

  const href = (n: number) => (n === 1 ? base : `${base}?page=${n}`);
  const numbers = pageWindow(page, pages);

  return (
    <nav
      aria-label="Pages"
      className="mt-6 flex flex-wrap items-center justify-center gap-1.5 text-[0.84rem]"
    >
      {page > 1 && (
        <Link
          href={href(page - 1)}
          rel="prev"
          className="rounded-full border border-ink-15 px-3.5 py-1.5 text-ink-50 transition-colors hover:border-ink hover:text-ink"
        >
          Previous
        </Link>
      )}

      {numbers.map((n, i) =>
        n === null ? (
          <span key={`gap-${i}`} className="px-1 text-ink-30">
            …
          </span>
        ) : n === page ? (
          <span
            key={n}
            aria-current="page"
            className="rounded-full bg-ink px-3.5 py-1.5 font-medium text-paper"
          >
            {n}
          </span>
        ) : (
          <Link
            key={n}
            href={href(n)}
            className="rounded-full border border-ink-15 px-3.5 py-1.5 text-ink-50 transition-colors hover:border-ink hover:text-ink"
          >
            {n}
          </Link>
        ),
      )}

      {page < pages && (
        <Link
          href={href(page + 1)}
          rel="next"
          className="rounded-full border border-ink-15 px-3.5 py-1.5 text-ink-50 transition-colors hover:border-ink hover:text-ink"
        >
          Next
        </Link>
      )}
    </nav>
  );
}

/** Which numbers to draw. `null` is an ellipsis. */
function pageWindow(page: number, pages: number): (number | null)[] {
  if (pages <= 7) return Array.from({ length: pages }, (_, i) => i + 1);

  const out: (number | null)[] = [1];
  const from = Math.max(2, page - 1);
  const to = Math.min(pages - 1, page + 1);

  if (from > 2) out.push(null);
  for (let n = from; n <= to; n++) out.push(n);
  if (to < pages - 1) out.push(null);

  out.push(pages);
  return out;
}
