import "server-only";

/**
 * The MoreTraffic content API: posts written there, served at /blog.
 *
 * Every call is server-side with a 60-second revalidation, so new posts show
 * up within a minute without calling the API for each visitor. The key lives
 * only in MORETRAFFIC_KEY (never NEXT_PUBLIC_) and is never put in a page.
 *
 * Failures are returned, not thrown: /blog must render (with no MoreTraffic
 * posts) when the API is down or the key is missing, and say why in a
 * <meta name="moretraffic-status"> tag so the connection check can tell the
 * owner what to fix.
 */

const BASE = "https://www.moretraffic.app/api/v1/content";
export const REVALIDATE = 60;

export type MtStatus = "no-key" | "unreachable" | `http-${number}`;
export type MtResult<T> = { ok: true; data: T } | { ok: false; status: MtStatus };

export type MtHero = { url: string; width: number; height: number; alt?: string | null };

export type MtPost = {
  slug: string;
  title: string;
  metaTitle?: string | null;
  description?: string | null;
  html?: string;
  hero?: MtHero | null;
  publishedAt?: string | null;
  updatedAt?: string | null;
};

export type MtManifest = {
  site?: unknown;
  verifyToken?: string | null;
  template?: { css?: string | null } | null;
};

async function get<T>(path: string): Promise<MtResult<T>> {
  const key = process.env.MORETRAFFIC_KEY?.trim();
  if (!key) return { ok: false, status: "no-key" };
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, {
      headers: { "x-moretraffic-key": key, accept: "application/json" },
      next: { revalidate: REVALIDATE, tags: ["moretraffic"] },
      // A slow MoreTraffic must never hold up a page of ours: give up after
      // 4 seconds and render without it.
      signal: AbortSignal.timeout(4000),
    });
  } catch {
    return { ok: false, status: "unreachable" };
  }
  if (!res.ok) return { ok: false, status: `http-${res.status}` };
  try {
    return { ok: true, data: (await res.json()) as T };
  } catch {
    return { ok: false, status: "unreachable" };
  }
}

export function getManifest() {
  return get<MtManifest>("/manifest");
}

/** Every published post, following nextCursor (capped, in case of a loop). */
export async function getAllPosts(): Promise<MtResult<MtPost[]>> {
  const posts: MtPost[] = [];
  let cursor: string | null = null;
  for (let i = 0; i < 20; i++) {
    const q: string = cursor ? `?cursor=${encodeURIComponent(cursor)}` : "";
    const r = await get<{ posts?: MtPost[]; nextCursor?: string | null }>(`/posts${q}`);
    if (!r.ok) return i === 0 ? r : { ok: true, data: posts };
    posts.push(...(r.data.posts ?? []));
    cursor = r.data.nextCursor ?? null;
    if (!cursor) break;
  }
  return { ok: true, data: posts };
}

/** One post. `null` means the API answered 404: not a MoreTraffic post. */
export async function getPost(slug: string): Promise<MtResult<MtPost | null>> {
  const r = await get<{ post?: MtPost }>(`/posts/${encodeURIComponent(slug)}`);
  if (!r.ok) return r.status === "http-404" ? { ok: true, data: null } : r;
  return { ok: true, data: r.data.post ?? null };
}

/** The template CSS, for a <style> tag. Closing tags are neutralised. */
export function templateCss(m: MtResult<MtManifest>): string {
  if (!m.ok) return "";
  return (m.data.template?.css ?? "").replace(/<\/style/gi, "<\\/style");
}
