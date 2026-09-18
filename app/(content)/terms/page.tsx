import type { Metadata } from "next";
import Link from "next/link";
import { buildMetadata } from "@/lib/seo/metadata";
import { LegalPage, LegalSummary } from "@/components/content/LegalPage";

/**
 * Terms of service.
 *
 * Two clauses here are doing most of the work, and both exist because of what
 * this product actually is rather than because a template had them:
 *
 *  1. Mentors are independent people, not our employees, and a conversation
 *     with one is an opinion rather than a placement service. A career site
 *     that blurs this is one unhappy user away from being treated as a
 *     recruitment agency that promised a job.
 *  2. The assistant writes resumes, and a model will occasionally invent a
 *     date or a job title. Saying so here, in the person's own interest, is
 *     more honest than a disclaimer nobody reads at the bottom of a screen.
 *
 * TO FILL IN once the entity is registered: the governing-law section names
 * India but no city. Name the seat of the courts — usually where the company
 * is registered — and this section is done.
 *
 * NOTE FOR REVIEW: accurate and readable, but not drafted by a lawyer. Have
 * one read it before payments go live.
 */

const UPDATED = "18 September 2026";

export const metadata: Metadata = buildMetadata({
  title: "Terms of Service — Cheatcode",
  description:
    "The rules for using Cheatcode: accounts, mentor sessions, AI features, paid plans and the things we do not promise.",
  path: "/terms",
});

export default function TermsPage() {
  return (
    <LegalPage
      title="Terms of service"
      intro="What you can expect from Cheatcode, what we expect from you, and the things we are careful not to promise."
      updated={UPDATED}
    >
      <LegalSummary>
        <p>
          Use Cheatcode honestly, and it stays available to you. Abuse it or the
          people on it, and we will close your account.
        </p>
        <p>
          Mentors are independent people sharing their experience. Nobody here
          is promising you a job.
        </p>
        <p>
          Your resume stays yours. We only handle it to run the features you
          asked for.
        </p>
        <p>
          The AI gets things wrong sometimes. Read what it writes before you
          send it to an employer.
        </p>
      </LegalSummary>

      <h2>Agreeing to these terms</h2>
      <p>
        Cheatcode (&quot;we&quot;, &quot;us&quot;) operates cheatcodeapp.com and
        the app behind it, from India. By using the site, the free tools or an
        account, you agree to these terms. If you do not, the honest thing is
        not to use the service. How we handle your data is a separate document —
        our <Link href="/privacy">privacy policy</Link> — and it forms part of
        this agreement.
      </p>

      <h2>Who can use Cheatcode</h2>
      <p>
        You must be at least 18. You must give us information that is true — a
        resume describing someone else, an invented job history or a false
        identity is a breach of these terms, and on a site whose entire purpose
        is putting you in front of people who can help, it also defeats the
        point.
      </p>

      <h2>Your account</h2>
      <p>
        An account is for one person. Keep your sign-in details to yourself, and
        tell us promptly if you think someone else has got into your account.
        You are responsible for what happens under it.
      </p>

      <h2>What Cheatcode is, and what it is not</h2>
      <p>
        Cheatcode connects you with people a few years ahead of you and gives
        you tools to prepare. That is the whole of it. We are not a recruitment
        agency, a placement service or an employer. We do not guarantee that you
        will get an interview, an offer, a particular salary, or a reply from
        anyone.
      </p>
      <p>
        Mentors are independent individuals, not our employees or agents. What
        they tell you is their own opinion drawn from their own experience, and
        we do not verify, endorse or take responsibility for their advice.
        Nothing on Cheatcode — from a mentor, a guide or the assistant — is
        legal, financial, immigration or tax advice. For those, talk to someone
        qualified to give them.
      </p>

      <h2>Mentor sessions</h2>
      <p>
        A session is a conversation of the length shown when you book it. Turn
        up on time, treat the mentor with respect, and do not record a session
        without their explicit agreement. Harassment, discrimination, pressuring
        a mentor for a referral, or using a session to sell something will end
        your access immediately.
      </p>
      <p>
        Cancellations, no-shows and refunds are covered in the{" "}
        <Link href="/refunds">refund and cancellation policy</Link>.
      </p>

      <h2>Your content</h2>
      <p>
        Your resume, your drafts, your messages and everything else you put into
        Cheatcode remain yours. We claim no ownership of them.
      </p>
      <p>
        To run the product we need your permission to do specific things with
        them: store them, display them back to you, send the relevant text to
        the AI providers listed in our privacy policy so a feature can produce
        its output, and share a draft with a person you explicitly choose to
        share it with. That permission is limited to operating the service, it
        lasts as long as you keep the content on Cheatcode, and it ends when you
        delete it. We do not use your resume or your conversations to train AI
        models, and we do not license them to anyone.
      </p>
      <p>
        You confirm that what you upload is yours to upload, and that it does
        not infringe anyone else&apos;s rights.
      </p>

      <h2>AI features</h2>
      <p>
        The assistant, the resume parsing and the scoring are powered by
        language models. They are useful and they are fallible: a model can
        misread a date, invent a detail, or give advice that is wrong for your
        situation. Everything it produces is a draft for you to check, not a
        finished document. You are responsible for what you send to an employer
        under your own name.
      </p>
      <p>
        AI features carry usage limits, which depend on your plan and are shown
        in the app. We may adjust them, and we may rate-limit or pause an
        account that uses them in a way that is clearly automated or abusive.
      </p>

      <h2>Using the service fairly</h2>
      <p>Do not:</p>
      <ul>
        <li>
          scrape the site, or use bots, crawlers or automated scripts against it
          beyond what our robots file permits;
        </li>
        <li>
          copy our guides, tools or data to build a competing product, or feed
          them to a model for training;
        </li>
        <li>
          resell or share your access, or use one account for several people;
        </li>
        <li>
          try to break, probe or get around our security, rate limits or usage
          caps;
        </li>
        <li>
          upload anything unlawful, malicious, or belonging to someone else;
        </li>
        <li>
          misuse another user&apos;s or mentor&apos;s personal information,
          including contact details you obtain through a session.
        </li>
      </ul>

      <h2>Free tools</h2>
      <p>
        The ATS checker, the salary calculator and the guides are free and are
        provided as they are. The ATS score is a checklist, not a verdict from
        any real applicant tracking system, and the salary figures are estimates
        built on public data. Treat both as a starting point for a decision, not
        as the decision.
      </p>

      <h2>Paid plans</h2>
      <p>
        Some features need a paid plan. Prices are shown in Indian rupees and
        include applicable taxes unless stated otherwise. A subscription renews
        automatically for the same period until you cancel it, and you can
        cancel at any time from your account. If we change the price of a plan
        you are already on, we will tell you before it takes effect and you can
        cancel instead of renewing. Payments are handled by our payment partner
        — we never see or store your card details. Refunds are covered in the{" "}
        <Link href="/refunds">refund and cancellation policy</Link>.
      </p>

      <h2>Our content</h2>
      <p>
        The guides, the tools, the design and the code of Cheatcode belong to us
        and are protected by copyright. Read them, share a link, quote a
        paragraph with attribution — all fine. Republishing them, or building a
        dataset out of them, is not.
      </p>

      <h2>Availability and changes</h2>
      <p>
        We build in the open and ship often, which means features appear, change
        and occasionally disappear. We do not promise uninterrupted or
        error-free service. If we are ever retiring something you depend on, we
        will give you notice and a way to get your data out.
      </p>

      <h2>Suspension and closing an account</h2>
      <p>
        You can close your account whenever you like. We may suspend or close an
        account that breaches these terms, harms another user or mentor, or is
        being used unlawfully — normally with notice and an explanation, and
        immediately where the harm is serious. If we close your account without
        cause while you are on a paid plan, we will refund the unused part of
        what you paid.
      </p>

      <h2>Disclaimers and liability</h2>
      <p>
        Cheatcode is provided on an &quot;as is&quot; and &quot;as
        available&quot; basis, without warranties of any kind beyond those the
        law does not allow us to exclude. We are not liable for indirect or
        consequential losses, for lost opportunities, offers or earnings, or for
        decisions you make on the basis of advice from a mentor or output from
        the AI.
      </p>
      <p>
        Where we are liable, our total liability to you is limited to the amount
        you paid us in the twelve months before the claim — which, if you have
        only used the free parts of Cheatcode, is nothing. Nothing in these
        terms limits liability that cannot lawfully be limited, including for
        fraud.
      </p>

      <h2>Indemnity</h2>
      <p>
        If someone brings a claim against us because of content you uploaded or
        because you used Cheatcode in breach of these terms, you agree to cover
        the reasonable costs of dealing with it.
      </p>

      <h2>Governing law</h2>
      <p>
        These terms are governed by the laws of India, and the courts of India
        will have exclusive jurisdiction over any dispute arising from them.
        Before going to court, please write to us — almost everything is faster
        to fix over email.
      </p>

      <h2>Changes to these terms</h2>
      <p>
        We will update the date at the top when these terms change, and we will
        tell account holders directly about any change that materially affects
        them. Continuing to use Cheatcode after a change means you accept it.
      </p>

      <h2>Contact</h2>
      <p>
        <a href="mailto:hello@cheatcodeapp.com">hello@cheatcodeapp.com</a>. See
        also our <Link href="/privacy">privacy policy</Link> and our{" "}
        <Link href="/refunds">refund policy</Link>.
      </p>
    </LegalPage>
  );
}
