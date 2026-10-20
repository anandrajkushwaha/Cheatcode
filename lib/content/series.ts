import { groupForHub, packageLakhs } from "@/lib/content/hub-groups";

/**
 * Previous / next within a programmatic set, plus the way back to its hub.
 *
 * "← 14 LPA | 20 LPA →" on the in-hand pages, in package order; the same
 * inside each group of the resume-format, interview and PF/tax hubs, in
 * title order. Every page in a set is then linked from two of its siblings
 * as well as from the hub, and a reader can walk the set without going back.
 */

export type SeriesLink = { href: string; label: string };
export type Series = { prev: SeriesLink | null; next: SeriesLink | null; hub: SeriesLink; group: string };

function short(p: { slug: string; title: string }): string {
  const lakhs = packageLakhs(p.slug);
  if (lakhs !== null) return lakhs >= 100 ? `₹${lakhs / 100} crore` : `${lakhs} LPA`;
  return p.title;
}

export function seriesFor<T extends { slug: string; title: string }>(
  categorySlug: string,
  categoryName: string,
  posts: T[],
  currentSlug: string,
): Series | null {
  const groups = groupForHub(categorySlug, posts);
  if (!groups) return null;
  const gi = groups.findIndex((g) => g.posts.some((p) => p.slug === currentSlug));
  if (gi < 0) return null;
  const group = groups[gi];
  const inHand = group.posts.some((p) => packageLakhs(p.slug) !== null);
  const ordered = inHand ? group.posts : [...group.posts].sort((a, b) => a.title.localeCompare(b.title));
  if (ordered.length < 2) return null;
  const i = ordered.findIndex((p) => p.slug === currentSlug);
  const link = (p: T | undefined) => (p ? { href: `/blog/${p.slug}`, label: short(p) } : null);
  return {
    prev: link(ordered[i - 1]),
    next: link(ordered[i + 1]),
    group: group.title,
    hub: inHand
      ? { href: "/tools/in-hand-salary-calculator", label: "All in-hand salary guides" }
      : { href: `/blog/category/${categorySlug}#group-${gi + 1}`, label: `All ${categoryName}` },
  };
}
