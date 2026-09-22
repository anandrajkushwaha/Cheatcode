import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { after } from "next/server";
import { recordSignupSource } from "@/lib/app/signup-source";
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
  // Not a redirect: this layout *is* /app, so redirecting here looped forever.
  if (!appAuthConfigured) {
    return (
      <main className="grid min-h-dvh place-items-center p-8 text-center text-[0.9rem] text-ink-50">
        Accounts aren&apos;t configured on this deployment yet.
      </main>
    );
  }

  const user = await getSessionUser();
  if (!user) redirect("/signin?next=/app");

  const profile = await getProfile();

  // What first brought this person here, copied onto their account once —
  // after the response, so it never slows a page.
  if (profile && !(profile as { signup_source?: string | null }).signup_source) {
    const ft = (await cookies()).get("cc_ft")?.value;
    if (ft) after(() => recordSignupSource(user.id, ft));
  }

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
