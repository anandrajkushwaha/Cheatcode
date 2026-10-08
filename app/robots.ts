import type { MetadataRoute } from "next";
import { SITE } from "@/lib/seo/constants";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        // /blog/page/N is not disallowed: it is how a crawler reaches the older
        // guides. Those pages are noindex,follow instead — walked, not listed.
        disallow: ["/api/", "/admin/"],
      },
    ],
    // One entry: the index at /sitemap.xml points to every shard.
    sitemap: `${SITE.url}/sitemap.xml`,
    host: SITE.url,
  };
}
