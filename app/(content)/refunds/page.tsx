import type { Metadata } from "next";
import Link from "next/link";
import { buildMetadata } from "@/lib/seo/metadata";
import { LegalPage, LegalSummary } from "@/components/content/LegalPage";

/**
 * Refund and cancellation policy.
 *
 * This page exists before the payments do, and deliberately. Indian payment
 * gateways ask to see a published refund policy, a contact address and terms
 * during onboarding — having them live is part of getting approved, not a
 * thing you write afterwards.
 *
 * TO REVISIT when Razorpay goes live:
 *  - the 7-day window below is a promise; confirm it is one you want to keep
 *    before the first charge, because shortening it later looks worse than
 *    starting shorter;
 *  - if plans are billed monthly by UPI Autopay, check the mandate-cancellation
 *    wording against what Razorpay actually surfaces to the customer;
 *  - once mentor sessions are bookable, confirm the 24-hour cut-off matches
 *    what the booking screen tells people.
 */

const UPDATED = "18 September 2026";

export const metadata: Metadata = buildMetadata({
  title: "Refund & Cancellation Policy — Cheatcode",
  description:
    "When you get your money back from Cheatcode, how to ask, and how long it takes. Cancel a plan any time from your account.",
  path: "/refunds",
});

export default function RefundsPage() {
  return (
    <LegalPage
      title="Refund and cancellation policy"
      intro="When you get your money back, how to ask for it, and how long it takes to arrive."
      updated={UPDATED}
    >
      <LegalSummary>
        <p>
          Cancel a subscription any time from your account. No email, no
          retention call.
        </p>
        <p>
          Changed your mind about a first payment? Full refund within 7 days.
        </p>
        <p>
          A mentor does not turn up, or the session breaks on our side? Full
          refund, no questions.
        </p>
        <p>
          Approved refunds reach your account in 5 to 10 working days, on the
          card or UPI ID you paid from.
        </p>
      </LegalSummary>

      <h2>Cancelling a subscription</h2>
      <p>
        You can cancel from your account settings at any time, and it takes
        effect immediately in the sense that matters: you will not be charged
        again. Your paid features stay switched on until the end of the period
        you have already paid for, and then the account drops to the free plan.
        Nothing is deleted when a plan ends — your resumes, drafts and history
        are all still there.
      </p>
      <p>
        If you pay by UPI Autopay, cancelling in the app also cancels the
        mandate, so nothing further is debited. If you see a debit after
        cancelling, tell us and we will refund it in full.
      </p>

      <h2>Refunds on subscriptions</h2>
      <p>
        <strong>Your first payment.</strong> If you subscribe and decide within
        7 days that it is not for you, write to us and we will refund it in
        full. You do not have to give a reason.
      </p>
      <p>
        <strong>Renewals.</strong> An automatic renewal you did not intend is a
        real thing that happens to everyone. If you tell us within 7 days of a
        renewal charge and you have not meaningfully used the plan in that
        period, we will refund it in full. Beyond that, a renewal is not
        refundable — but you can cancel straight away so it does not happen
        again, and you keep the access you paid for until the period ends.
      </p>
      <p>
        <strong>When something is broken.</strong> If a paid feature did not
        work and we could not fix it for you, we will refund the period it
        affected, whatever the dates say. This is not conditional on any window.
      </p>
      <p>
        We may decline a refund where an account has clearly abused the offer —
        subscribing, consuming a month of AI usage, and asking for the money
        back, repeatedly.
      </p>

      <h2>Mentor sessions</h2>
      <p>
        <strong>You cancel more than 24 hours before.</strong> Full refund, or
        reschedule at no cost.
      </p>
      <p>
        <strong>You cancel within 24 hours.</strong> The mentor has held that
        time, so the session is not refundable. You can ask us anyway — if the
        mentor is able to fill the slot, we will refund it.
      </p>
      <p>
        <strong>You do not turn up.</strong> Not refundable, for the same
        reason.
      </p>
      <p>
        <strong>The mentor does not turn up, or cancels.</strong> Full refund,
        or a free session with someone else, whichever you prefer. You should
        not have to ask twice for this one.
      </p>
      <p>
        <strong>The session was unusable.</strong> If a technical failure on our
        side wrecked the call, tell us within 48 hours and we will refund it or
        rebook it free.
      </p>

      <h2>Failed and duplicate payments</h2>
      <p>
        If money left your account but the plan did not activate, or you were
        charged twice for the same thing, we refund it in full as soon as we can
        confirm it — you do not need to argue the case. Send us the payment
        reference and we will trace it.
      </p>

      <h2>How to ask for a refund</h2>
      <p>
        Email <a href="mailto:hello@cheatcodeapp.com">hello@cheatcodeapp.com</a>{" "}
        from the address on your account, with the payment reference or the date
        and amount, and a line about what happened. We reply within 2 working
        days and tell you either that it is approved or exactly why it is not.
      </p>

      <h2>How long a refund takes</h2>
      <p>
        Once approved, we raise the refund with our payment partner within 2
        working days. It then takes 5 to 10 working days to appear, depending on
        your bank, and it always goes back to the method you paid with — we
        cannot send it somewhere else. You will get an email when it is on its
        way.
      </p>

      <h2>Prices and taxes</h2>
      <p>
        Prices are in Indian rupees and include applicable taxes unless we say
        otherwise. A refund returns the amount you were actually charged.
      </p>

      <h2>Contact</h2>
      <p>
        <a href="mailto:hello@cheatcodeapp.com">hello@cheatcodeapp.com</a>. This
        policy sits alongside our <Link href="/terms">terms of service</Link>{" "}
        and our <Link href="/privacy">privacy policy</Link>.
      </p>
    </LegalPage>
  );
}
