import type { NextConfig } from "next";

/**
 * Guides merged into another guide on the same search.
 *
 * Two pages on one query split it between them and neither ranks, so the
 * weaker one was archived (its row is kept, and a copy is in
 * backup.posts_20261008) and its URL now answers with a permanent redirect to
 * the page that kept the topic. Add a pair here whenever the SEO audit's
 * "Competing articles" is resolved by a merge.
 */
const MERGED_GUIDES: Record<string, string> = {
  "tell-me-about-yourself-interview-answer": "tell-me-about-yourself",
  "hr-interview-questions-freshers": "hr-interview-questions",
  "software-engineer-resume-format-freshers": "software-engineer-resume-format",
  "gratuity-calculation": "gratuity-calculation-india",
  "group-discussion-topics-tips": "group-discussion-topics-for-freshers",
  "how-to-calculate-in-hand-salary-from-ctc": "ctc-vs-in-hand-salary",
  "what-are-your-salary-expectations": "expected-ctc-question",
  "why-should-we-hire-you-answer": "why-should-we-hire-you",
};

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
    return Object.entries(MERGED_GUIDES).map(([from, to]) => ({
      source: `/blog/${from}`,
      destination: `/blog/${to}`,
      permanent: true,
    }));
  },
};

export default nextConfig;
