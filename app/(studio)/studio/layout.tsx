import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { TopBar } from "@/components/studio/TopBar";
import { getSessionUser } from "@/lib/supabase/app";
import { appAuthConfigured } from "@/lib/supabase/app-env";
import { getProfile, isPaid } from "@/lib/app/account";
import { AgentOrb } from "@/components/app/AgentOrb";

/**
 * The studio shell.
 *
 * /app is untouched and still serves everybody; this is where its replacement
 * is built, screen by screen, behind the same sign-in. The swap at the end is
 * a redirect rather than a rewrite — which is the whole reason for building it
 * beside the live product instead of on top of it.
 *
 * The guard is the same one /app uses: proxy.ts matches this path and this
 * layout re-checks. Two layers, because a guard that lives only in middleware
 * is one config change away from being no guard at all.
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

  const profile = await getProfile();

  // overflow-x-clip, not hidden: clip does not create a scroll container, so
  // sticky headers inside still stick. It is here so a full-bleed band (the
  // Pro hero) can step outside this container without a sideways scrollbar.
  return (
    <div className="min-h-dvh overflow-x-clip bg-ink-04">
      <TopBar
        user={{
          name: profile?.full_name ?? user.email?.split("@")[0] ?? "You",
          avatarUrl: profile?.avatar_url ?? null,
        }}
      />
      <main id="main" className="mx-auto max-w-[1160px] px-3 py-5 sm:px-5 sm:py-6">
        {children}
      </main>

      {/* Every studio screen, one corner. Free accounts can open it and look
          around; sending or talking asks for Pro. */}
      <AgentOrb requirePro={!isPaid(profile)} />
    </div>
  );
}
