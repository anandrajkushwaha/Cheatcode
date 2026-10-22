import type { NextConfig } from "next";
import { MERGED_GUIDES, mergedTarget } from "./lib/seo/merged-guides";

/**
 * Guides merged into another guide on the same search.
 *
 * Two pages on one query split it between them and neither ranks, so the
 * weaker one was archived (its row is kept, and a copy is in
 * backup.posts_20261008) and its URL now answers with a permanent redirect to
 * the page that kept the topic. Add a pair here whenever the SEO audit's
 * "Competing articles" is resolved by a merge.
 */


const nextConfig: NextConfig = {
  images: {
    // next/image re-encodes every local asset. The default 75 is a visible
    // softening on the flat UI renders in the marketing pages, which are
    // already only 1x exports; 90 costs a few KB and keeps the edges crisp.
    qualities: [75, 90],
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },
  async redirects() {
    return [
      // One host. Search Console found pages crawled on the bare domain as
      // well as on www — two copies of each, neither indexed. www is the
      // canonical everywhere (SITE.url), so the bare domain points there.
      {
        source: "/:path*",
        has: [{ type: "host", value: "cheatcodeapp.com" }],
        destination: "https://www.cheatcodeapp.com/:path*",
        permanent: true,
      },
      // An old landing page Google still remembers.
      { source: "/lander", destination: "/", permanent: true },
      ...Object.keys(MERGED_GUIDES).map((from) => ({
        source: `/blog/${from}`,
        destination: mergedTarget(from)!,
        permanent: true,
      })),
    ];
  },
  async headers() {
    // A file, not a page: keep it out of the indexing report.
    return [{ source: "/manifest.webmanifest", headers: [{ key: "X-Robots-Tag", value: "noindex" }] }];
  },
};

export default nextConfig;
