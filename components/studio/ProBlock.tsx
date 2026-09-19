import Link from "next/link";
import { CheckIcon, SparkIcon } from "@/components/studio/icons";
import { CHECKOUT_LIVE, PRO_PERKS } from "@/lib/studio/plan";

/**
 * The upgrade promo.
 *
 * Two things here are deliberate departures from the Figma.
 *
 * The third benefit was "Auto-Apply on Naukri". It is gone: we cannot
 * automate applications on somebody else's site, and putting a competitor's
 * name in our own pricing is not a thing to ship. The list now comes from
 * lib/studio/plan.ts, and every line in it is something the product does.
 *
 * The button does not say "Become a Pro" while nothing can be bought.
 * Razorpay is not connected, so the honest label is an invitation to look
 * rather than a checkout that dead-ends. Flip CHECKOUT_LIVE when it is wired
 * and this reads the way the design drew it.
 */
export function ProBlock({ paid }: { paid: boolean }) {
  if (paid) return null;

  return (
    <section className="overflow-hidden rounded-2xl bg-obsidian text-paper">
      <div className="flex flex-col gap-6 p-6 sm:p-7 lg:flex-row lg:items-center lg:gap-10">
        <div className="shrink-0">
          <p className="text-[0.8rem] text-paper/60">With</p>
          <p className="mt-1 flex items-center gap-2 text-[2.4rem] font-semibold leading-none tracking-[-0.04em]">
            PRO
            <SparkIcon className="size-6 text-amber-300" />
          </p>
          <p className="mt-2 text-[0.85rem] text-paper/70">you get hired faster</p>

          <Link
            href="/studio/upgrade?from=studio-home"
            className="mt-5 inline-block rounded-full bg-paper px-5 py-2.5 text-[0.85rem] font-medium text-ink transition-opacity hover:opacity-90"
          >
            {CHECKOUT_LIVE ? "Become a Pro" : "See what's in Pro"}
          </Link>
        </div>

        <div className="hidden w-px self-stretch bg-paper/15 lg:block" />

        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-4">
            <p className="text-[0.9rem] font-medium">What you will get</p>
            <div className="flex shrink-0 gap-6 text-[0.72rem] text-paper/50">
              <span className="w-8 text-center">You</span>
              <span className="w-8 text-center font-semibold text-amber-300">PRO</span>
            </div>
          </div>

          <ul className="mt-4 space-y-3">
            {PRO_PERKS.map((perk) => (
              <li key={perk.title} className="flex items-center justify-between gap-4">
                <span className="min-w-0">
                  <span className="block truncate text-[0.88rem]">{perk.title}</span>
                  <span className="mt-0.5 block truncate text-[0.75rem] text-paper/50">
                    {perk.detail}
                  </span>
                </span>
                <span className="flex shrink-0 items-center gap-6">
                  <span className="w-8 text-center text-paper/30" aria-label="Not included">
                    —
                  </span>
                  <span className="flex w-8 justify-center" aria-label="Included">
                    <CheckIcon className="size-5 text-amber-300" />
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
