import Link from "next/link";
import type { Metadata } from "next";
import { buildMetadata } from "@/lib/seo/metadata";
import { getAllPosts, getManifest, templateCss, type MtPost } from "@/lib/moretraffic";
import { LEGACY_INDEX_META, LegacyBlogIndex } from "../_legacy-blog/index-page";

/**
 * /blog — every published post: the MoreTraffic posts first, then the
 * original guides (topics, pagination at /blog/page/N) underneath.
 *
 * Server-rendered and revalidated every 60 seconds. The head carries
 * <meta name="moretraffic-verify"> from the manifest, or, when the manifest
 * can't be read, one <meta name="moretraffic-status"> naming why (no-key,
 * http-NNN, unreachable). The page itself never fails on MoreTraffic's
 * account: it renders with the original guides alone.
 */

export const revalidate = 60;

export async function generateMetadata(): Promise<Metadata> {
  const manifest = await getManifest();
  const token = manifest.ok ? manifest.data.verifyToken?.trim() : null;
  const other: Record<string, string> = token
    ? { "moretraffic-verify": token }
    : { "moretraffic-status": manifest.ok ? "no-token" : manifest.status };
  return {
    ...buildMetadata({ ...LEGACY_INDEX_META, path: "/blog" }),
    other,
  };
}

const DATE = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric" });
const date = (iso?: string | null) => {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : DATE.format(d);
};
const published = (p: MtPost) => p.publishedAt ?? (p as { published_at?: string }).published_at ?? null;

export default async function BlogIndex() {
  const [manifest, posts] = await Promise.all([getManifest(), getAllPosts()]);
  const css = templateCss(manifest);
  const list = posts.ok ? posts.data : [];

  return (
    <>
      {css && <style dangerouslySetInnerHTML={{ __html: css }} />}
      <LegacyBlogIndex>
        {list.length > 0 && (
          <section className="container-page mt-14" aria-labelledby="latest-posts">
            <h2 id="latest-posts" className="text-[0.72rem] font-medium uppercase tracking-[0.16em] text-ink-30">
              Latest
            </h2>
            <ul className="mt-5 divide-y divide-ink-08 border-y border-ink-08">
              {list.map((p) => (
                <li key={p.slug}>
                  <Link href={`/blog/${p.slug}`} className="group block py-6">
                    <h3 className="text-[1.2rem] font-semibold leading-snug tracking-[-0.02em] group-hover:underline group-hover:underline-offset-4">
                      {p.title}
                    </h3>
                    {p.description && (
                      <p className="mt-2 max-w-[70ch] text-[0.95rem] leading-relaxed text-ink-50">{p.description}</p>
                    )}
                    {date(published(p)) && <p className="mt-2 text-[0.8rem] text-ink-30">{date(published(p))}</p>}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}
      </LegacyBlogIndex>
    </>
  );
}
