/**
 * Banner shapes and placements.
 *
 * Deliberately separate from lib/queries/admin.ts, which imports "server-only".
 * The banner manager is a client component and needs PLACEMENTS at runtime, so
 * pulling it from the query module would drag the server-only guard into the
 * browser bundle and fail the build.
 */

export type Placement = "in_article" | "sidebar" | "blog_list";

export const PLACEMENTS: { id: Placement; label: string; where: string }[] = [
  {
    id: "in_article",
    label: "Inside the article",
    where: "A block partway down the article, after the tool block. The reader is already committed by the time they reach it, which is why it tends to convert best.",
  },
  {
    id: "sidebar",
    label: "Article sidebar",
    where: "Beside the article on desktop, under the table of contents. On a phone it moves below the article.",
  },
  {
    id: "blog_list",
    label: "Blog listing",
    where: "On /blog, after the fourth article — where people are scanning rather than reading.",
  },
];

export type Banner = {
  id: string;
  name: string;
  placement: Placement;
  eyebrow: string | null;
  title: string;
  body: string | null;
  cta_label: string | null;
  cta_href: string | null;
  image_url: string | null;
  image_alt: string | null;
  theme: "dark" | "light";
  active: boolean;
  starts_at: string | null;
  ends_at: string | null;
  sort_order: number;
};

export type BannerStatRow = {
  id: string;
  name: string;
  placement: Placement;
  active: boolean;
  title: string;
  views: number;
  clicks: number;
  view_sessions: number;
  click_sessions: number;
  ctr: number;
};
