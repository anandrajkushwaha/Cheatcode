import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { StudioShell } from "@/components/studio/Shell";
import { getSessionUser } from "@/lib/supabase/app";
import { appAuthConfigured } from "@/lib/supabase/app-env";
import { getProfile, isPaid } from "@/lib/app/account";
import { listConversations } from "@/lib/app/agent-history";
import { getInsights } from "@/lib/studio/insights";
import {
  STUDIO_LAYOUT_COOKIE,
  decodeLayout,
} from "@/lib/studio/layout-state";

/**
 * The studio: the new app shell, living beside the old one rather than on top
 * of it.
 *
 * Why a separate path instead of rebuilding /app in place. The old product
 * works and people are using it; replacing its layout in the same route means
 * every half-finished screen is the live screen. Here the new shell can be
 * opened on the real domain, behind the real sign-in, while /app carries on
 * untouched — and the eventual cutover is a redirect rather than a rewrite.
 *
 * The auth guard is the same one /app uses, deliberately: proxy.ts matches
 * this path too, and this layout re-checks. Two layers, because a guard that
 * lives only in middleware is one config change away from being no guard.
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

  // Everything the frame needs, fetched together. These are independent
  // queries against the same connection, so awaiting them in sequence would
  // pay three round trips to render one header.
  const [jar, profile, conversations, insights] = await Promise.all([
    cookies(),
    getProfile(),
    listConversations(12),
    getInsights(),
  ]);

  return (
    <StudioShell
      initial={decodeLayout(jar.get(STUDIO_LAYOUT_COOKIE)?.value)}
      user={{
        name: profile?.full_name ?? user.email?.split("@")[0] ?? "You",
        plan: isPaid(profile) ? "Pro plan" : "Free plan",
        avatarUrl: profile?.avatar_url ?? null,
      }}
      recents={conversations.map((c) => ({
        id: c.id,
        title: c.title ?? "Untitled chat",
      }))}
      insights={insights}
    >
      {children}
    </StudioShell>
  );
}
