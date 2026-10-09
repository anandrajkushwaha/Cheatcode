import "server-only";
import { createPublicClient } from "@/lib/supabase/public";
import type { Post, PostCard, Category, Author } from "@/types/db";

export const POSTS_PER_PAGE = 12;

const CARD_COLS =
  "id,slug,title,excerpt,published_at,reading_minutes,post_type," +
  "category:categories(slug,name,short_name)";

/** A card with its cover image: the homepage strip and "Keep reading". */
export type GuideCardPost = PostCard & { cover_image: string | null; cover_alt: string | null };

const GUIDE_CARD_COLS = `${CARD_COLS},cover_image,cover_alt`;


const FULL_COLS =
  "*,category:categories(*),author:authors(*)";

/** Public site reads use the publishable key — RLS guarantees only published rows come back. */
function db() {
  return createPublicClient();
}

/**
 * One article, or null when it genuinely does not exist.
 *
 * A failed query throws rather than returning null, and that difference is
 * the whole SEO story of this function. Null means notFound(): a 404 with a
 * noindex tag, which ISR then caches — so a single Supabase timeout during a
 * revalidation used to replace a ranking article with a cached "Not found"
 * until the next one, and Google treats a 404 as a reason to drop the URL.
 * A thrown error is different: Next keeps serving the last good render, and
 * a crawler that does see a 500 treats it as temporary and comes back.
 */
export async function getPostBySlug(slug: string): Promise<Post | null> {
  const supabase = db();
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("posts")
    .select(FULL_COLS)
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw new Error(`[posts] could not load ${slug}: ${error.message}`);
  return (data as Post) ?? null;
}

export async function getPosts({
  page = 1,
  perPage = POSTS_PER_PAGE,
  categorySlug,
}: { page?: number; perPage?: number; categorySlug?: string } = {}): Promise<{
  posts: PostCard[];
  total: number;
}> {
  const supabase = db();
  if (!supabase) return { posts: [], total: 0 };

  let query = supabase
    .from("posts")
    .select(CARD_COLS, { count: "exact" })
    .order("published_at", { ascending: false })
    .range((page - 1) * perPage, page * perPage - 1);

  if (categorySlug) {
    const { data: cat } = await supabase
      .from("categories")
      .select("id")
      .eq("slug", categorySlug)
      .maybeSingle();
    if (!cat) return { posts: [], total: 0 };
    query = query.eq("category_id", cat.id);
  }

  const { data, count } = await query;
  return { posts: (data as unknown as PostCard[]) ?? [], total: count ?? 0 };
}

/**
 * The newest guides for the landing page, the ones with a cover image first.
 *
 * The strip is a row of picture cards, and a card with no picture next to
 * three that have one reads as broken. So it takes the newest guides that
 * have a cover, and only tops up with uncovered ones if there are not enough.
 */
export async function getLatestGuidesWithCovers(
  limit = 4,
): Promise<GuideCardPost[]> {
  const supabase = db();
  if (!supabase) return [];
  const { data } = await supabase
    .from("posts")
    .select(GUIDE_CARD_COLS)
    .order("published_at", { ascending: false })
    .limit(30);
  const rows = (data as unknown as GuideCardPost[]) ?? [];
  const covered = rows.filter((r) => r.cover_image);
  const rest = rows.filter((r) => !r.cover_image);
  return [...covered, ...rest].slice(0, limit);
}

export async function getAllPostSlugs(): Promise<
  { slug: string; updated_at: string }[]
> {
  const supabase = db();
  if (!supabase) return [];
  const { data } = await supabase
    .from("posts")
    .select("slug,updated_at")
    .order("published_at", { ascending: false })
    .limit(5000);
  return data ?? [];
}

/**
 * Same cluster, excluding the current post. Falls back to recent posts.
 *
 * Not simply the newest in the category: that sent every article's "Keep
 * reading" links to the same three posts, so each new guide pushed an older
 * one out of every list and the back catalogue ended up with no internal
 * links pointing at it at all. Instead the window is chosen from the whole
 * category by the post's own id — stable for a given page, different between
 * pages — so the links spread across everything in the cluster.
 *
 * The cards are picture cards, so guides with a cover image are rotated
 * through first and uncovered ones only fill a short row. (The back
 * catalogue's internal links no longer depend on this list: every guide is
 * linked from other guides' bodies, which the SEO audit checks.)
 */
export async function getRelatedPosts(
  post: Pick<Post, "id" | "category">,
  limit = 4,
): Promise<GuideCardPost[]> {
  const supabase = db();
  if (!supabase) return [];

  if (post.category?.id) {
    const { data } = await supabase
      .from("posts")
      .select(GUIDE_CARD_COLS)
      .eq("category_id", post.category.id)
      .neq("id", post.id)
      .order("published_at", { ascending: false })
      .limit(300);
    const pool = (data as unknown as GuideCardPost[]) ?? [];
    if (pool.length) {
      const covered = rotate(pool.filter((p) => p.cover_image), post.id, limit);
      const rest = rotate(pool.filter((p) => !p.cover_image), post.id, limit - covered.length);
      return [...covered, ...rest].slice(0, limit);
    }
  }

  const { data } = await supabase
    .from("posts")
    .select(GUIDE_CARD_COLS)
    .neq("id", post.id)
    .order("published_at", { ascending: false })
    .limit(limit);
  return (data as unknown as GuideCardPost[]) ?? [];
}

/** `limit` consecutive items from `pool`, starting at a point fixed by `seed`. */
function rotate<T>(pool: T[], seed: string, limit: number): T[] {
  if (limit <= 0) return [];
  if (pool.length <= limit) return pool;
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  const start = h % pool.length;
  return Array.from({ length: limit }, (_, i) => pool[(start + i) % pool.length]);
}

export async function getCategories(): Promise<Category[]> {
  const supabase = db();
  if (!supabase) return [];
  const { data } = await supabase
    .from("categories")
    .select("*")
    .order("sort_order");
  return (data as Category[]) ?? [];
}

export async function getCategoryBySlug(slug: string): Promise<Category | null> {
  const supabase = db();
  if (!supabase) return null;
  const { data } = await supabase
    .from("categories")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();
  return (data as Category) ?? null;
}

export async function getCategoryCounts(): Promise<Record<string, number>> {
  const supabase = db();
  if (!supabase) return {};
  const { data } = await supabase.from("posts").select("category_id");
  const cats = await getCategories();
  const byId = Object.fromEntries(cats.map((c) => [c.id, c.slug]));
  const out: Record<string, number> = {};
  for (const row of data ?? []) {
    const slug = byId[(row as { category_id: string }).category_id];
    if (slug) out[slug] = (out[slug] ?? 0) + 1;
  }
  return out;
}

export async function getAuthorBySlug(slug: string): Promise<Author | null> {
  const supabase = db();
  if (!supabase) return null;
  const { data } = await supabase
    .from("authors")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();
  return (data as Author) ?? null;
}

export async function getPostsByAuthor(authorId: string, limit = 50): Promise<PostCard[]> {
  const supabase = db();
  if (!supabase) return [];
  const { data } = await supabase
    .from("posts")
    .select(CARD_COLS)
    .eq("author_id", authorId)
    .order("published_at", { ascending: false })
    .limit(limit);
  return (data as unknown as PostCard[]) ?? [];
}
