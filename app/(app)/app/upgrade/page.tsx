import Link from "next/link";
import { getProfile, isPaid } from "@/lib/app/account";

/**
 * The one dark page in the product.
 *
 * The first version of this was gold, and gold was the wrong instinct: in
 * software it reads as a luxury-goods badge, and against a blue page it turns
 * to mustard. Every product people actually describe as premium marks its top
 * tier by going *deeper* than the rest of the interface, not brighter. So the
 * page the money lives on is near-black, and arriving here feels like walking
 * into a different room — which is the entire job of this screen.
 */

const INCLUDED = [
  {
    title: "Voice conversations with the agent",
    detail: "It works out what you actually want, then goes and finds it.",
  },
  {
    title: "Jobs ranked against your resume",
    detail: "With the reason spelled out — not a list you have to sift.",
  },
  {
    title: "Unlimited ATS checks and resume reads",
    detail: "Rewrite, re-upload, re-score as often as you like.",
  },
  {
    title: "New features the day they ship",
    detail: "Everything built from here lands on the paid plan first.",
  },
];

export default async function UpgradePage() {
  const profile = await getProfile();
  const paid = isPaid(profile);

  if (paid) {
    return (
      <div className="mx-auto max-w-lg">
        <div className="cc-premium-surface rounded-3xl border p-9 text-center">
          <Crest />
          <h1 className="mt-5 text-[1.5rem] font-semibold tracking-[-0.03em] text-paper">
            You are on Pro
          </h1>
          <p className="mt-3 text-[0.92rem] leading-relaxed text-paper/70">
            {profile?.plan_expires_at
              ? `Renews ${new Date(profile.plan_expires_at).toLocaleDateString("en-IN", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}.`
              : "No renewal date on file yet."}
          </p>
          <Link
            href="/app"
            className="mt-7 inline-block rounded-full bg-paper px-5 py-2.5 text-[0.85rem] font-medium text-ink"
          >
            Back to your dashboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl">
      <div className="cc-rise overflow-hidden rounded-3xl border border-ink-08">
        <div className="cc-premium-surface border-b px-7 pb-9 pt-10 text-center sm:px-10">
          <Crest />
          <p className="mt-5 text-[0.72rem] uppercase tracking-[0.18em] text-paper/55">
            Cheatcode Pro
          </p>
          <h1 className="mt-2 text-[1.75rem] font-semibold tracking-[-0.035em] text-paper sm:text-[2rem]">
            The part that costs us money
          </h1>
          <p className="mx-auto mt-3.5 max-w-[52ch] text-[0.94rem] leading-relaxed text-paper/70">
            The resume tools stay free, and they always will. The agent and job matching run a
            model on every use — that is what the plan pays for.
          </p>
        </div>

        <div className="bg-paper px-7 py-8 sm:px-10">
          <ul className="space-y-5">
            {INCLUDED.map((item) => (
              <li key={item.title} className="flex gap-3.5">
                <Tick />
                <div className="min-w-0">
                  <p className="text-[0.94rem] font-medium leading-snug">{item.title}</p>
                  <p className="mt-1 text-[0.84rem] leading-relaxed text-ink-50">{item.detail}</p>
                </div>
              </li>
            ))}
          </ul>

          <div className="mt-8 rounded-2xl border border-ink-08 bg-ink-04/60 p-5">
            <p className="text-[0.85rem] leading-relaxed text-ink-50">
              Payments are not connected yet. Razorpay with UPI Autopay arrives together with the
              agent — there is no point charging for something that does not exist. Nothing on this
              page will take your money today.
            </p>
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-3">
            {/* Faded obsidian went grey and looked broken. A plain outline
                says "not yet" without pretending to be a button. */}
            <span className="rounded-full border border-dashed border-ink-15 px-6 py-3 text-[0.9rem] text-ink-30">
              Not open yet
            </span>
            <Link
              href="/app"
              className="rounded-full border border-ink-15 px-5 py-3 text-[0.87rem] transition-colors hover:border-ink-30"
            >
              Back to your dashboard
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

/** A mark, not a medal: a thin ring of light on the dark ground. */
function Crest() {
  return (
    <span aria-hidden="true" className="inline-block">
      <svg width="46" height="46" viewBox="0 0 46 46">
        <defs>
          <linearGradient id="crest" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="55%" stopColor="var(--color-sky-2)" />
            <stop offset="100%" stopColor="var(--color-sky-1)" />
          </linearGradient>
        </defs>
        <circle cx="23" cy="23" r="21" fill="none" stroke="url(#crest)" strokeWidth="1.2" opacity="0.5" />
        <circle cx="23" cy="23" r="15" fill="url(#crest)" opacity="0.12" />
        <path
          d="M15.5 24.5l5 5 10-13"
          fill="none"
          stroke="url(#crest)"
          strokeWidth="2.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}

function Tick() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true" className="mt-0.5 shrink-0">
      <circle cx="9" cy="9" r="9" fill="var(--color-obsidian)" />
      <path
        d="M5.2 9.3l2.5 2.5 5.1-6"
        fill="none"
        stroke="var(--color-paper)"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
