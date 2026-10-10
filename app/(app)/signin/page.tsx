import { redirect } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import type { Metadata } from "next";
import { getSessionUser } from "@/lib/supabase/app";
import { appAuthConfigured } from "@/lib/supabase/app-env";
import { SignInForm } from "./SignInForm";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Sign in — Cheatcode",
  robots: { index: false, follow: false },
};

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; method?: string }>;
}) {
  const { next, method } = await searchParams;
  // Only ever redirect within this site: an open redirect here would let
  // someone send a signed-in user to a page they control.
  const target = next && next.startsWith("/") && !next.startsWith("//") ? next : "/app";

  if (!appAuthConfigured) {
    return (
      <main className="container-page flex min-h-dvh items-center justify-center">
        <div className="max-w-md rounded-2xl border border-ink-30 p-7">
          <p className="text-[0.95rem] font-medium">Accounts aren&apos;t configured yet</p>
          <p className="mt-2.5 text-[0.9rem] leading-relaxed text-ink-50">
            Set <code>NEXT_PUBLIC_APP_SUPABASE_URL</code> and{" "}
            <code>NEXT_PUBLIC_APP_SUPABASE_PUBLISHABLE_KEY</code>, then run{" "}
            <code>supabase/schemas/20_app_accounts.sql</code>.
          </p>
        </div>
      </main>
    );
  }

  if (await getSessionUser()) redirect(target);

  return (
    <main className="relative flex min-h-dvh flex-col overflow-hidden">
      {/*
        The photograph is the page, and the card floats on it.

        `priority` because this is the largest thing above the fold on the one
        screen standing between an ad click and an account — a background that
        fades in late reads as a page still loading, and people leave sign-in
        pages faster than any other. `object-cover` means a phone gets the
        middle of the frame rather than a letterboxed strip.
      */}
      <Image
        src="/signin-bg.webp"
        quality={90}
        alt=""
        fill
        priority
        sizes="100vw"
        className="-z-10 object-cover"
      />

      <div className="container-page py-7">
        <Link
          href="/"
          className="text-[0.95rem] font-semibold tracking-[-0.04em] text-white drop-shadow-[0_1px_8px_rgba(0,0,0,0.45)]"
        >
          Cheatcode
        </Link>
      </div>

      <div className="flex flex-1 items-center justify-center px-4 pb-16 pt-2 sm:pb-24">
        <div className="w-full max-w-[34rem] rounded-[1.75rem] bg-paper p-7 shadow-[0_24px_70px_-20px_rgba(0,0,0,0.45)] sm:p-10">
          <SignInForm next={target} initialMode={method === "email" ? "email" : "choose"} />
        </div>
      </div>
    </main>
  );
}
