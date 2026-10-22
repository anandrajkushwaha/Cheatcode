import type { Metadata } from "next";
import { getSessionUser } from "@/lib/supabase/app";
import { GuestBuilder } from "@/components/app/builder/GuestBuilder";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Free resume builder | Cheatcode",
  description: "Build your resume in a free, ATS-friendly template — no sign-up to start.",
  // The editor itself is not a page to rank; /resume-templates is.
  robots: { index: false, follow: true },
};

/**
 * The builder before an account. A template tapped on the home page or on
 * /resume-templates opens here (?template=id). See GuestBuilder.tsx.
 */
export default async function ResumeBuilderPage({
  searchParams,
}: {
  searchParams: Promise<{ template?: string }>;
}) {
  const [{ template }, user] = await Promise.all([searchParams, getSessionUser()]);
  return <GuestBuilder template={template ?? null} signedIn={Boolean(user)} />;
}
