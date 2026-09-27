import { Suspense } from "react";
import type { Metadata, Viewport } from "next";
import { Analytics } from "@/components/Analytics";
import { GoogleAnalytics } from "@/components/GoogleAnalytics";
import { MetaPixel } from "@/components/MetaPixel";
import { META_PIXEL_SNIPPET } from "@/lib/analytics/meta-snippet";
import localFont from "next/font/local";
import "./globals.css";
import { buildMetadata } from "@/lib/seo/metadata";
import { JsonLd } from "@/components/JsonLd";
import { organizationJsonLd, websiteJsonLd } from "@/lib/seo/jsonld";

// Self-hosted so there is no request to fonts.googleapis.com:
// one less DNS lookup + connection on the critical path, and no
// third-party font request from the user's browser.
const inter = localFont({
  src: "./fonts/inter-latin-wght-normal.woff2",
  weight: "100 900",
  style: "normal",
  display: "swap",
  variable: "--font-inter",
  preload: true,
  fallback: [
    "ui-sans-serif",
    "system-ui",
    "-apple-system",
    "Segoe UI",
    "sans-serif",
  ],
});

/**
 * Google Sans Flex — the brand face: wordmark, navigation, headlines, buttons.
 *
 * Shipped as a subset of the variable font rather than the 4 MB original.
 * The GRAD, ROND, slnt and wdth axes are pinned to the values the design uses
 * and the weight range is cut to 300–700, which is every weight the design
 * asks for; that alone is the difference between 4 MB and 157 KB, and about
 * 57 KB once the CDN compresses it.
 *
 * WOFF rather than WOFF2 because building WOFF2 needs brotli, which is not
 * installable here; WOFF is zlib and gets most of the way there (58 KB).
 * Worth revisiting only if the font shows up in a performance trace.
 */
const googleSansFlex = localFont({
  src: "./fonts/google-sans-flex-latin.woff",
  weight: "300 700",
  style: "normal",
  display: "swap",
  variable: "--font-gsf",
  preload: true,
  // next/font normally derives a metric-matched fallback by reading the file.
  // On these instanced variable TTFs that step emits malformed CSS and the
  // build dies in PostCSS with "Missed semicolon", so the adjustment is off
  // and the plain fallback list below is what gets used.
  adjustFontFallback: false,
  fallback: ["ui-sans-serif", "system-ui", "-apple-system", "Segoe UI", "sans-serif"],
});

/**
 * Playfair Display Bold Italic — the emphasis word inside a headline, and
 * nothing else. Pinned to 700 italic because that is the only cut the design
 * uses; a full variable family here would cost more than the word is worth.
 */
const playfair = localFont({
  src: "./fonts/playfair-display-bolditalic-latin.woff",
  weight: "700",
  style: "italic",
  display: "swap",
  variable: "--font-playfair",
  preload: true,
  adjustFontFallback: false,
  fallback: ["Georgia", "Times New Roman", "serif"],
});

export const metadata: Metadata = {
  ...buildMetadata({
    title: "Cheatcode — Resume, jobs and interview prep for freshers in India",
    description:
      "Some people have a cousin at Google. Now you have Cheatcode. Free ATS resume checker and builder with 60 templates, jobs from company boards, AI mock interviews and a career agent that has read your resume.",
    path: "/",
  }),
  // Search engine ownership verification. Set these in Vercel and redeploy —
  // no code change needed to verify a new property.
  verification: {
    google: process.env.GOOGLE_SITE_VERIFICATION,
    other: process.env.BING_SITE_VERIFICATION
      ? { "msvalidate.01": process.env.BING_SITE_VERIFICATION }
      : undefined,
  },
};

export const viewport: Viewport = {
  themeColor: "#ffffff",
  colorScheme: "light",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en-IN"
      className={`${inter.variable} ${googleSansFlex.variable}`}
      data-scroll-behavior="smooth"
    >
      <head>
        {/* Meta Pixel base code — in the page source, first thing in <head>. */}
        <script id="meta-pixel" dangerouslySetInnerHTML={{ __html: META_PIXEL_SNIPPET }} />
      </head>
      <body className="antialiased">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-full focus:bg-ink focus:px-5 focus:py-3 focus:text-sm focus:text-paper"
        >
          Skip to content
        </a>
        {children}
        <GoogleAnalytics />
        <MetaPixel />
        <Suspense fallback={null}>
          <Analytics />
        </Suspense>
        <JsonLd data={organizationJsonLd()} />
        <JsonLd data={websiteJsonLd()} />
      </body>
    </html>
  );
}
