import type { Metadata, Viewport } from "next";
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

export const metadata: Metadata = buildMetadata({
  title: "Cheatcode — Talk to someone who's already done it",
  description:
    "Some people have a cousin at Google. Now you have Cheatcode. Get 1-on-1 time with people 5–10 years ahead of you — real answers on resumes, interviews, salary and first jobs.",
  path: "/",
});

export const viewport: Viewport = {
  themeColor: "#ffffff",
  colorScheme: "light",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en-IN" className={inter.variable} data-scroll-behavior="smooth">
      <body className="antialiased">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-full focus:bg-ink focus:px-5 focus:py-3 focus:text-sm focus:text-paper"
        >
          Skip to content
        </a>
        {children}
        <JsonLd data={organizationJsonLd()} />
        <JsonLd data={websiteJsonLd()} />
      </body>
    </html>
  );
}
