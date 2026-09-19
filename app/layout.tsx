import { Suspense } from "react";
import type { Metadata, Viewport } from "next";
import { Analytics } from "@/components/Analytics";
import { GoogleAnalytics } from "@/components/GoogleAnalytics";
import localFont from "next/font/local";
import { Playfair_Display } from "next/font/google";
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
 * The one display face, used for exactly one word: the Insights heading in
 * the studio.
 *
 * Fetched through next/font/google rather than vendored beside Inter, and the
 * distinction matters less than it looks: next/font downloads the file at
 * build time and serves it from our own origin, so the rule Inter is here to
 * satisfy — no request to fonts.googleapis.com from a visitor's browser —
 * still holds. The build machine makes the request once; nobody's browser
 * ever does.
 *
 * preload is off deliberately. Every marketing page inherits this layout and
 * none of them use this face, so preloading it would mean the blog fetching a
 * font for a heading it does not have.
 */
const playfair = Playfair_Display({
  subsets: ["latin"],
  weight: ["700"],
  style: ["italic"],
  display: "swap",
  variable: "--font-playfair",
  preload: false,
  fallback: ["Georgia", "Times New Roman", "serif"],
});

export const metadata: Metadata = {
  ...buildMetadata({
    title: "Cheatcode — Talk to someone who's already done it",
    description:
      "Some people have a cousin at Google. Now you have Cheatcode. Get 1-on-1 time with people 5–10 years ahead of you — real answers on resumes, interviews, salary and first jobs.",
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
      className={`${inter.variable} ${playfair.variable}`}
      data-scroll-behavior="smooth"
    >
      <body className="antialiased">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-full focus:bg-ink focus:px-5 focus:py-3 focus:text-sm focus:text-paper"
        >
          Skip to content
        </a>
        {children}
        <GoogleAnalytics />
        <Suspense fallback={null}>
          <Analytics />
        </Suspense>
        <JsonLd data={organizationJsonLd()} />
        <JsonLd data={websiteJsonLd()} />
      </body>
    </html>
  );
}
