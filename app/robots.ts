import type { MetadataRoute } from "next";
import { SITE } from "@/lib/seo/constants";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/api/", "/admin/", "/blog/page/"],
      },
    ],
    // One entry: the index at /sitemap.xml points to every shard.
    sitemap: `${SITE.url}/sitemap.xml`,
    host: SITE.url,
  };
}
