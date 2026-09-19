import { getProfile, isPaid } from "@/lib/app/account";
import { recordProIntent } from "@/lib/app/pro-intent";
import { StudioPlaceholder } from "@/components/studio/Placeholder";

export const dynamic = "force-dynamic";

/**
 * The studio's plan screen, still a placeholder — but it records the same way
 * /app/upgrade does.
 *
 * Worth doing before the screen itself exists: the studio promo is already
 * live behind sign-in, and a click on it is the same signal as a click in the
 * old app. Recording only one of the two would make the number wrong for as
 * long as both surfaces are up, which is the whole cutover period.
 */
export default async function StudioUpgradePage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string }>;
}) {
  const [profile, params] = await Promise.all([getProfile(), searchParams]);

  if (!isPaid(profile)) {
    await recordProIntent(params.from ?? "studio", "/studio/upgrade");
  }

  return (
    <StudioPlaceholder
      title="Pro"
      detail="Payments are not connected yet. Razorpay with UPI Autopay is the next backend job, and it is the one change that also touches live users."
    />
  );
}
