import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getSessionUser } from "@/lib/supabase/app";
import { BuildResume } from "./BuildResume";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Build your resume — free templates | Cheatcode",
  description: "Pick a free, ATS-friendly resume template and have your resume ready in 10 minutes.",
  // An ad landing page; the blog and the tools are what search should find.
  robots: { index: false, follow: false },
};

/**
 * The link for "build your resume" ads: templates first, sign-up as the
 * resume's own first step. See BuildResume.tsx. Somebody already signed in
 * goes straight to their resume page and its gallery.
 */
export default async function BuildResumePage() {
  if (await getSessionUser()) redirect("/app/resume");
  return <BuildResume />;
}
