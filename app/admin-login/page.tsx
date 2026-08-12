import { Suspense } from "react";
import type { Metadata } from "next";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = {
  title: "Sign in — Cheatcode",
  robots: { index: false, follow: false },
};

export default function AdminLoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <p className="text-[0.95rem] font-semibold tracking-[-0.04em]">Cheatcode</p>
        <h1 className="mt-6 text-2xl font-semibold tracking-[-0.03em]">Admin sign in</h1>
        <p className="mt-2 text-[0.88rem] text-ink-50">
          Credentials are set in the Vercel environment variables.
        </p>
        {/* useSearchParams needs a Suspense boundary to prerender. */}
        <Suspense fallback={<div className="mt-8 h-44 rounded-xl bg-ink-04" />}>
          <LoginForm />
        </Suspense>
      </div>
    </main>
  );
}
