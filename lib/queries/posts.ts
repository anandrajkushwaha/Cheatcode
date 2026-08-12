import "server-only";
import { createPublicClient } from "@/lib/supabase/public";
import type { Post, PostCard, Category, Author } from "@/types/db";

export const POSTS_PER_PAGE = 12;

const CARD_COLS =
  "id,slug,title,excerpt,published_at,reading_minutes,post_type," +
  "category:categories(slug,name,short_name)";

const FULL_COLS =
  "*,category:categories(*),author:authors(*)";

/** Public site reads use the publishable key — RLS guarantees only published rows come back. */
function db() {
  return createPublicClient();
}

export async function getPostBySlug(slug: string): Promise<Post | null> {
  const supabase = db();
  if (!supabase) return null;
  const { data } = await supabase
    .from("posts")
    .select(FULL_COLS)
    .eq("slug", slug)
    .maybeSingle();
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

/** Same cluster, excluding the current post. Falls back to recent posts. */
export async function getRelatedPosts(
  post: Pick<Post, "id" | "category">,
  limit = 3,
): Promise<PostCard[]> {
  const supabase = db();
  if (!supabase) return [];

  if (post.category?.id) {
    const { data } = await supabase
      .from("posts")
      .select(CARD_COLS)
      .eq("category_id", post.category.id)
      .neq("id", post.id)
      .order("published_at", { ascending: false })
      .limit(limit);
    if (data?.length) return data as unknown as PostCard[];
  }

  const { data } = await supabase
    .from("posts")
    .select(CARD_COLS)
    .neq("id", post.id)
    .order("published_at", { ascending: false })
    .limit(limit);
  return (data as unknown as PostCard[]) ?? [];
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
