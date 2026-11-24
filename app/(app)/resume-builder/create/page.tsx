import type { Metadata } from "next";
import { getSessionUser } from "@/lib/supabase/app";
import { GuestBuilder } from "@/components/app/builder/GuestBuilder";
import { buildMetadata } from "@/lib/seo/metadata";

export const dynamic = "force-dynamic";

// The editor is a tool, not a page to rank: /resume-builder is the public
// landing page for "resume builder" and "CV maker", and this is where its
// buttons lead. Kept out of the index and out of the sitemap; the links on it
// are still followed.
export const metadata: Metadata = buildMetadata({
  title: "Resume editor | Cheatcode",
  description: "Build your resume in a free, ATS-friendly template — no sign-up to start.",
  path: "/resume-builder/create",
  noindex: true,
  follow: true,
});

/**
 * The builder before an account. A template tapped on the home page, on
 * /resume-templates or on /resume-builder opens here (?template=id), and so
 * does an old /resume-builder?template=id link (a 308 in next.config.ts).
 * Google sign-in from the builder comes back here too. See GuestBuilder.tsx.
 */
export default async function ResumeBuilderCreatePage({
  searchParams,
}: {
  searchParams: Promise<{ template?: string }>;
}) {
  const [{ template }, user] = await Promise.all([searchParams, getSessionUser()]);
  return <GuestBuilder template={template ?? null} signedIn={Boolean(user)} />;
}
