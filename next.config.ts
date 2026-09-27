import type { NextConfig } from "next";

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
};

export default nextConfig;
