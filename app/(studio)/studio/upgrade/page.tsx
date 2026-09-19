import { getProfile, isPaid } from "@/lib/app/account";
import { getSessionUser, createAppAdminClient } from "@/lib/supabase/app";
import { recordProIntent } from "@/lib/app/pro-intent";
import { billingConfigured } from "@/lib/payments/razorpay";
import { PRO_PERKS, PRO_PRICE_PER_MONTH } from "@/lib/studio/plan";
import { PayButton } from "@/components/studio/PayButton";

export const dynamic = "force-dynamic";

/**
 * The plan screen.
 *
 * Whether it can take money is not a constant in this file — billingConfigured()
 * asks whether the keys actually exist. A screen that advertises a checkout the
 * server cannot run is worse than one that says it is not open yet.
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

export default async function StudioUpgradePage({
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

  // The mandate, if there is one. Read with the admin client because the
  // renewal date should show even in the seconds before the session catches up.
  let mandate: Mandate | null = null;
  if (user) {
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

  return (
    <div className="mx-auto max-w-[720px] space-y-6">
      <div>
        <h1 className="text-[1.38rem] font-semibold tracking-[-0.03em]">Pro</h1>
        <p className="mt-2 max-w-[58ch] text-[0.87rem] leading-relaxed text-ink-50">
          ₹{PRO_PRICE_PER_MONTH} a month by UPI Autopay. Cancel whenever you
          like — the month you have paid for stays yours.
        </p>
      </div>

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
        </section>
      ) : (
        <section className="overflow-hidden rounded-2xl border border-ink-08 bg-paper">
          <div className="border-b border-ink-08 px-6 py-5">
            <p className="flex items-baseline gap-1.5">
              <span className="text-[1.75rem] font-semibold tracking-[-0.03em]">
                ₹{PRO_PRICE_PER_MONTH}
              </span>
              <span className="text-[0.87rem] text-ink-50">a month</span>
            </p>
          </div>

          <ul className="divide-y divide-ink-08">
            {PRO_PERKS.map((perk) => (
              <li
                key={perk.title}
                className="flex items-center justify-between gap-4 px-6 py-3.5"
              >
                <span className="text-[0.92rem]">{perk.title}</span>
                {!perk.built && (
                  <span className="shrink-0 rounded-full bg-ink-04 px-2.5 py-1 text-[0.72rem] font-medium text-ink-50">
                    Coming soon
                  </span>
                )}
              </li>
            ))}
          </ul>

          <div className="px-6 py-6">
            {live ? (
              <PayButton
                label={`Unlock Pro ₹${PRO_PRICE_PER_MONTH}`}
                name={profile?.full_name ?? null}
                email={profile?.email ?? user?.email ?? null}
                contact={profile?.phone ?? null}
              />
            ) : (
              <>
                <p className="max-w-[52ch] text-[0.87rem] leading-relaxed text-ink-50">
                  Payments are not switched on yet. The checkout is built and
                  waiting on its keys — nothing here can take money until they
                  are set.
                </p>
                <p className="mt-3 text-[0.8rem] text-ink-30">
                  Set RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET, RAZORPAY_PLAN_ID and
                  RAZORPAY_WEBHOOK_SECRET, then redeploy.
                </p>
              </>
            )}
          </div>
        </section>
      )}

      <p className="max-w-[60ch] text-[0.8rem] leading-relaxed text-ink-30">
        Payment is handled by Razorpay. We never see or store your card or UPI
        details. See our refund and cancellation policy for how to get your
        money back.
      </p>
    </div>
  );
}
