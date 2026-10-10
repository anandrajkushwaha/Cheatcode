import type { Metadata } from "next";
import SignInPage from "../signin/page";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Sign up — Cheatcode",
  robots: { index: false, follow: false },
};

/**
 * The link to put on ads: the sign-in screen, opened straight at the email
 * step. Someone tapping a Meta ad is inside Instagram's or Facebook's browser,
 * where Google sign-in cannot work, so they should not have to find the email
 * option themselves. `?next=` works here exactly as on /signin.
 */
export default async function SignUpPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; username?: string }>;
}) {
  const { next, username } = await searchParams;
  return SignInPage({ searchParams: Promise.resolve({ next, method: "email", username }) });
}
