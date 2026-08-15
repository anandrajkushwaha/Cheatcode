import type { MetadataRoute } from "next";
import { SITE } from "@/lib/seo/constants";

/**
 * Web app manifest — what Android and Chrome read when someone adds the site
 * to their home screen. The 192px icon is the launcher tile, the 512px one is
 * used for the splash screen; both are marked "any maskable" so Android can
 * crop them to whatever shape the launcher uses without adding its own
 * white plate around the mark.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: SITE.name,
    short_name: SITE.name,
    description: SITE.description,
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#ffffff",
    lang: "en-IN",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
