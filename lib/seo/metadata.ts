import type { Metadata } from "next";
import { SITE } from "./constants";

type BuildMetadataOptions = {
  title: string;
  description: string;
  path: string;
  image?: string;
  type?: "website" | "article";
  noindex?: boolean;
  /** With noindex: still follow the links. For archive pages that lead to indexable ones. */
  follow?: boolean;
};

/**
 * Single source of truth for page metadata.
 * Every page should return buildMetadata(...) — never hand-write a <title>.
 */
export function buildMetadata({
  title,
  description,
  path,
  image,
  type = "website",
  noindex = false,
  follow = false,
}: BuildMetadataOptions): Metadata {
  const url = `${SITE.url}${path}`;

  return {
    title,
    description,
    metadataBase: new URL(SITE.url),
    alternates: { canonical: url },
    robots: noindex
      ? { index: false, follow }
      : {
          index: true,
          follow: true,
          googleBot: {
            index: true,
            follow: true,
            "max-image-preview": "large",
            "max-snippet": -1,
            "max-video-preview": -1,
          },
        },
    openGraph: {
      title,
      description,
      url,
      siteName: SITE.name,
      type,
      locale: SITE.locale,
      ...(image ? { images: [{ url: image, width: 1200, height: 630 }] } : {}),
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
  };
}
