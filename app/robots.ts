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
    sitemap: [
      `${SITE.url}/sitemap/static.xml`,
      `${SITE.url}/sitemap/posts.xml`,
      `${SITE.url}/sitemap/categories.xml`,
    ],
    host: SITE.url,
  };
}
