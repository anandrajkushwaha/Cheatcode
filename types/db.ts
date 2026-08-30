export type PostType = "editorial" | "programmatic" | "practical";
export type PostStatus = "queued" | "drafting" | "published" | "failed" | "archived";
export type QueueStatus = "pending" | "claimed" | "done" | "failed" | "skipped";

export type Category = {
  id: string;
  slug: string;
  name: string;
  short_name: string | null;
  description: string | null;
  seo_title: string | null;
  seo_description: string | null;
  intro_html: string | null;
  sort_order: number;
};

export type Author = {
  id: string;
  slug: string;
  name: string;
  role_title: string | null;
  bio: string | null;
  avatar_url: string | null;
  linkedin_url: string | null;
};

export type TocItem = { id: string; text: string };
export type FaqItem = { q: string; a: string };

export type Post = {
  cover_image?: string | null;
  cover_alt?: string | null;
  origin?: string | null;
  id: string;
  slug: string;
  post_type: PostType;
  status: PostStatus;
  title: string;
  h1: string | null;
  excerpt: string;
  content_html: string;
  toc: TocItem[];
  published_at: string;
  updated_at: string;
  seo_title: string;
  seo_description: string;
  focus_keyword: string;
  secondary_keywords: string[];
  canonical_url: string | null;
  noindex: boolean;
  faq: FaqItem[];
  entity_type: string | null;
  entity_slug: string | null;
  entity_name: string | null;
  related_tool_slugs: string[];
  internal_links: string[];
  word_count: number;
  data_points: number;
  quality_score: number;
  reading_minutes: number;
  category?: Category | null;
  author?: Author | null;
};

export type PostCard = Pick<
  Post,
  "id" | "slug" | "title" | "excerpt" | "published_at" | "reading_minutes" | "post_type"
> & { category?: Pick<Category, "slug" | "name" | "short_name"> | null };

export type QueueRow = {
  id: number;
  focus_keyword: string;
  secondary_keywords: string[];
  category_slug: string;
  post_type: PostType;
  slot: number;
  priority: number;
  est_volume_in: string | null;
  intent: string | null;
  target_slug: string | null;
  entity_type: string | null;
  entity_slug: string | null;
  entity_name: string | null;
  brief: string | null;
  status: QueueStatus;
  claimed_at: string | null;
  post_id: string | null;
  attempts: number;
  last_error: string | null;
  created_at: string;
};
