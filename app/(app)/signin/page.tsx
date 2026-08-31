import { redirect } from "next/navigation";
import Link from "next/link";
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
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  // Only ever redirect within this site: an open redirect here would let
  // someone send a signed-in user to a page they control.
  const target = next && next.startsWith("/") && !next.startsWith("//") ? next : "/app";

  if (!appAuthConfigured) {
    return (
      <main className="container-page flex min-h-screen items-center justify-center">
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
    <main className="flex min-h-screen flex-col">
      <div className="container-page py-8">
        <Link href="/" className="text-[0.95rem] font-semibold tracking-[-0.04em]">
          Cheatcode
        </Link>
      </div>
      <div className="container-page flex flex-1 items-center justify-center pb-24">
        <SignInForm next={target} />
      </div>
    </main>
  );
}
