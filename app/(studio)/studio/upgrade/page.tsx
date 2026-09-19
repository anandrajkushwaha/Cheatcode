import Link from "next/link";
import { getProfile, isPaid } from "@/lib/app/account";
import { getSessionUser, createAppAdminClient } from "@/lib/supabase/app";
import { recordProIntent } from "@/lib/app/pro-intent";
import { billingConfigured } from "@/lib/payments/razorpay";
import { getReviews } from "@/lib/studio/reviews";
import { getProof } from "@/lib/studio/proof";
import { ProHero } from "@/components/studio/pro/ProHero";
import { ProCompare } from "@/components/studio/pro/ProCompare";
import { ProDidYouKnow } from "@/components/studio/pro/ProDidYouKnow";
import { ProReviews } from "@/components/studio/pro/ProReviews";
import { ProFaq } from "@/components/studio/pro/ProFaq";
import { ProStickyBar } from "@/components/studio/pro/ProStickyBar";

export const dynamic = "force-dynamic";

/**
 * The Pro landing page.
 *
 * This replaced the plain plan screen that used to live here rather than
 * sitting beside it, because every "upgrade" link in the product already
 * points at this path and two pages selling the same thing is how copy starts
 * disagreeing with itself.
 *
 * Whether it can take money is not a constant — billingConfigured() asks
 * whether the keys exist. A page that advertises a checkout the server cannot
 * run is worse than one that says it is not open yet.
 *
 * Someone already on Pro gets the hero and the questions, without the pricing
 * or the bar. They still need the cancellation answer more than anybody else
 * does, so the FAQ stays.
 */

const WHEN = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "Asia/Kolkata",
});

type Mandate = { status: string; current_end: string | null };

function when(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : WHEN.format(d);
}

export default async function StudioProPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string }>;
}) {
  const [user, profile, params] = await Promise.all([
    getSessionUser(),
    getProfile(),
    searchParams,
  ]);

  const paid = isPaid(profile);
  if (!paid) await recordProIntent(params.from ?? "studio", "/studio/upgrade");

  // The testimonials and the headline number are only wanted on the selling
  // version of the page, so they are not fetched for somebody who has already
  // bought — two queries saved on every visit by an existing subscriber.
  const [reviews, proof] = paid
    ? [[], null]
    : await Promise.all([getReviews(), getProof()]);

  let mandate: Mandate | null = null;
  if (user && paid) {
    const db = createAppAdminClient();
    if (db) {
      const { data } = await db
        .from("subscriptions")
        .select("status, current_end")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      mandate = (data as Mandate | null) ?? null;
    }
  }

  const live = billingConfigured();
  const renews = when(profile?.plan_expires_at);
  const name = profile?.full_name ?? null;
  const email = profile?.email ?? user?.email ?? null;
  const contact = profile?.phone ?? null;

  return (
    <>
      {/* The shell constrains everything to 1160 with its own padding; the
          hero is a full-width band, so it steps out of both. The studio
          wrapper clips the x-axis so a scrollbar cannot turn 100vw into a
          sideways scroll. */}
      <div className="relative left-1/2 -mt-5 w-screen max-w-[100vw] -translate-x-1/2 sm:-mt-6">
        <ProHero
          live={live && !paid}
          name={name}
          email={email}
          contact={contact}
        />
      </div>

      <div className="mx-auto max-w-[855px] pb-4 pt-12 sm:pt-14">
        {paid ? (
          <section className="rounded-2xl border border-ink-08 bg-paper p-6">
            <p className="text-[1rem] font-semibold">You are on Pro.</p>
            <p className="mt-2 text-[0.87rem] leading-relaxed text-ink-50">
              {mandate?.status === "active" && renews
                ? `Renews on ${renews}.`
                : renews
                  ? `Your access runs until ${renews}.`
                  : "Your plan is active."}
            </p>
            <p className="mt-3 text-[0.85rem] leading-relaxed text-ink-50">
              To cancel, write to hello@cheatcodeapp.com. The month you have
              already paid for stays yours.
            </p>
          </section>
        ) : (
          <>
            <ProCompare />

            {!live && (
              <p className="mt-5 max-w-[60ch] text-[0.85rem] leading-relaxed text-ink-50">
                Payments are not switched on yet. The checkout is built and
                waiting on its keys — nothing here can take money until they
                are set.
              </p>
            )}

            {proof && (
              <div className="mt-10">
                <ProDidYouKnow value={proof.value} text={proof.text} />
              </div>
            )}

            {reviews.length > 0 && (
              <div className="mt-14 sm:mt-16">
                <ProReviews reviews={reviews} />
              </div>
            )}
          </>
        )}
      </div>

      <div className="mx-auto max-w-[1120px] pt-14 sm:pt-16">
        <ProFaq />

        <nav aria-label="Breadcrumb" className="mt-10 flex flex-wrap items-center gap-2 text-[0.8rem] text-ink-50">
          <Link href="/studio" className="hover:text-ink hover:underline underline-offset-4">
            Home
          </Link>
          <span aria-hidden className="text-ink-30">›</span>
          <span>Cheatcode</span>
          <span aria-hidden className="text-ink-30">›</span>
          <span className="text-ink">Cheatcode Pro</span>
        </nav>

        <p className="mt-6 max-w-[62ch] text-[0.8rem] leading-relaxed text-ink-30">
          Payment is handled by Razorpay. We never see or store your card or UPI
          details. See our{" "}
          <Link href="/refunds" className="underline underline-offset-4 hover:text-ink">
            refund and cancellation policy
          </Link>{" "}
          for how to get your money back.
        </p>

        {/* Room for the bar, so the last line of the page is never under it. */}
        {!paid && live && <div className="h-24" />}
      </div>

      {!paid && live && (
        <ProStickyBar name={name} email={email} contact={contact} />
      )}
    </>
  );
}
