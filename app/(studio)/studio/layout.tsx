import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getSessionUser } from "@/lib/supabase/app";
import { appAuthConfigured } from "@/lib/supabase/app-env";

/**
 * /studio, stripped back to the plumbing.
 *
 * The shell that used to live here — sidebar, insights panel, top nav — is
 * parked, not deleted; it is in git and in _to_delete/studio-v1 if any of it
 * is wanted back.
 *
 * What is kept on purpose is the guard. /studio is matched by proxy.ts and
 * re-checked here, and it would be a poor trade to make a protected area
 * public while clearing out a layout. When the next idea lands, it lands
 * inside a route that is already signed-in-only and already out of Google.
 */

export const metadata: Metadata = {
  title: "Cheatcode",
  robots: { index: false, follow: false, nocache: true },
};

export const dynamic = "force-dynamic";

export default async function StudioLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (!appAuthConfigured) redirect("/app");

  const user = await getSessionUser();
  if (!user) redirect("/signin?next=/studio");

  return <main id="main">{children}</main>;
}
