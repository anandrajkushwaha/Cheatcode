import type { Metadata } from "next";
import Link from "next/link";
import { buildMetadata } from "@/lib/seo/metadata";
import { LegalPage, LegalSummary } from "@/components/content/LegalPage";

/**
 * The privacy policy.
 *
 * Written against what the code actually does, not against a template. Every
 * field listed under "What we collect" maps to a real column — page_views and
 * page_events for analytics, profiles for the account, resumes and
 * resume_drafts for the document, agent_messages for the assistant. If you
 * add a column that holds something about a person, this page is part of that
 * change, not a follow-up to it.
 *
 * Two claims here are load-bearing and easy to break without noticing:
 *
 *  1. No IP address is written to our own tables. app/api/track reads the
 *     address to test it against ANALYTICS_EXCLUDE_IPS and then drops it.
 *     Adding an ip column to page_views would make this page false.
 *  2. The free ATS checker parses in the browser and uploads nothing. Moving
 *     that parse server-side would make this page false too.
 *
 * NOTE FOR REVIEW: this is an accurate description of the system, not legal
 * advice. Before you take payments or open to EU traffic, have a lawyer read
 * it against the DPDP Act rules as they stand then.
 */

const UPDATED = "18 September 2026";

export const metadata: Metadata = buildMetadata({
  title: "Privacy Policy — Cheatcode",
  description:
    "What Cheatcode collects, why, who else sees it, and how to get it deleted. Written in plain English against what the product actually does.",
  path: "/privacy",
});

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy policy"
      intro="You are about to hand a career site your resume, your salary and your phone number. This page says exactly what happens to all three."
      updated={UPDATED}
    >
      <LegalSummary>
        <p>
          We never sell your data, and we run no advertising trackers of any
          kind.
        </p>
        <p>
          Our own analytics store no IP addresses — only a page path, a rough
          location, a device type and a random identifier that is not tied to
          your name.
        </p>
        <p>
          The free resume tools read your file inside your browser. The file
          never reaches us.
        </p>
        <p>
          Anything in your account — resume, chat history, profile — is deleted
          when you ask, and you can ask by replying to any email from us.
        </p>
      </LegalSummary>

      <h2>Who this is</h2>
      <p>
        Cheatcode (&quot;we&quot;, &quot;us&quot;) runs the website at
        cheatcodeapp.com and the app behind it, from India. Under India&apos;s
        Digital Personal Data Protection Act, 2023, we are the data fiduciary
        for the personal data described here and you are the data principal.
        Every question, request and complaint about this policy goes to{" "}
        <a href="mailto:hello@cheatcodeapp.com">hello@cheatcodeapp.com</a>.
      </p>

      <h2>What we collect</h2>

      <h3>When you simply read the site</h3>
      <p>
        We run our own analytics rather than relying on a third party for the
        numbers we care about. For each page view and each significant action —
        a scroll past a point, a click on a call to action — we record the page
        path, where you arrived from and which site that maps to, an approximate
        country, region and city, your device type, operating system and browser
        name, a random session identifier, a random visitor identifier, and the
        time.
      </p>
      <p>
        Two things are deliberately absent. We do not store your IP address: the
        server reads it for the length of one request, only to check it against
        a list of addresses whose traffic we exclude from our own numbers, and
        then discards it without writing it anywhere. We also do not store the
        raw user-agent string — only the device, operating system and browser
        name worked out from it. The visitor identifier is a random value with
        no relation to your name or email, and on its own it tells us that the
        same browser came back, nothing more.
      </p>
      <p>
        Your internet address is still handled, briefly, by the companies that
        put this page in front of you — our host and the network in front of it
        keep it in their own short-lived server logs, as every website on the
        internet does.
      </p>

      <h3>When you use a free tool</h3>
      <p>
        The resume ATS checker and the salary calculator run entirely inside
        your browser. Your resume file is read by JavaScript on your own device,
        scored there, and forgotten when you close the tab. It is never
        transmitted to us and there is no copy of it on any server of ours. What
        we do record is the same anonymous event as any other page — that the
        tool was used, and roughly from where.
      </p>

      <h3>When you join the waitlist</h3>
      <p>
        We store your email address and which page you signed up from. That is
        the entire record.
      </p>

      <h3>When you create an account</h3>
      <p>
        Sign-in is handled by Supabase, which holds your email address and
        authentication details. Your profile then holds whatever you choose to
        fill in: name, email, phone number, profile photo, a headline, your
        current job title and company, years of experience, and your current and
        expected salary.
      </p>
      <p>
        Salary is the most sensitive thing on that list, so it is worth being
        precise: it is optional, we use it to match you to roles and to give you
        an honest read on what you should be asking for, and it is never shown
        to another user or to a mentor unless you put it there yourself.
      </p>

      <h3>When you work on a resume in the app</h3>
      <p>
        This is different from the free tool, and the difference matters. Inside
        the app, we store the text extracted from the document you upload, the
        structured version of it that the model reads out, the score, and every
        draft you edit afterwards. It is stored because an editor has to survive
        a phone dying mid-sentence and a laptop opened the next morning, which
        nothing kept only in a browser can do. If you share a draft, we also
        store the email address of the person you shared it with.
      </p>

      <h3>When you talk to the assistant</h3>
      <p>
        We store your conversations with the AI assistant — the messages, who
        sent them, whether they were spoken aloud, and when. We also count how
        much you have used it: tokens, seconds of voice, and what that cost us.
        Those counters are how the usage limits on your plan work.
      </p>

      <h3>When you apply to be a mentor</h3>
      <p>
        We store what you send us in the application, which is what we need to
        decide whether the network is a fit for you and you for it.
      </p>

      <h2>Cookies</h2>
      <p>
        We use no advertising cookies, no cross-site tracking pixels, and no
        data brokers. The cookies on this site are these:
      </p>
      <ul>
        <li>
          <strong>Sign-in cookies</strong>, set by Supabase, which keep you
          logged in and expire when your session does. Without them there is no
          way to have an account.
        </li>
        <li>
          <strong>An admin session cookie</strong>, which exists only on our own
          back-office pages and only for us.
        </li>
        <li>
          <strong>A cc_owner cookie</strong>, which does the opposite of
          tracking: it marks a browser as ours so our own visits never pollute
          our traffic numbers. It is set only on our own devices.
        </li>
        <li>
          <strong>Google Analytics cookies</strong>, described below.
        </li>
      </ul>

      <h2>Google Analytics</h2>
      <p>
        We run Google Analytics alongside our own numbers. It is configured with
        IP anonymisation switched on, it is never loaded on our admin pages, and
        it is not loaded at all until the page has checked that the visitor is
        not an automated browser — so a bot never becomes a session. Google
        sets its own cookies and processes the data on its own terms. You can
        opt out entirely with Google&apos;s browser add-on, or with any
        content blocker.
      </p>

      <h2>Who else handles your data</h2>
      <p>
        We do not sell personal data and we do not share it for anyone else&apos;s
        marketing. These are the companies that process it on our behalf so the
        product can work:
      </p>
      <ul>
        <li>
          <strong>Supabase</strong> — the database and the sign-in system. Your
          account, profile, resume and conversations live here.
        </li>
        <li>
          <strong>Vercel</strong> — hosting. It serves every page and runs our
          server code.
        </li>
        <li>
          <strong>Cloudflare</strong> — the network in front of the site, which
          handles routing and blocks attacks.
        </li>
        <li>
          <strong>Google Analytics</strong> — audience measurement, as above.
        </li>
        <li>
          <strong>OpenAI, Google (Gemini) and Sarvam AI</strong> — the language
          models behind resume parsing, the assistant and the scoring. Which one
          handles a given feature depends on how we have it configured, and can
          change.
        </li>
        <li>
          <strong>ElevenLabs</strong> — speech, when you use the assistant by
          voice.
        </li>
      </ul>
      <p>
        The AI line deserves plain speech. To turn your resume into structured
        fields, or to answer a question about it, the relevant text is sent to
        whichever model provider is configured for that feature. Where a
        provider offers a setting that keeps our requests out of their training
        data and their long-term storage, we use it. We do not hand any provider
        a bulk export of our users, and none of them receive your data for their
        own marketing.
      </p>

      <h2>Where your data goes</h2>
      <p>
        Several of the companies above operate outside India, so some of your
        data is processed abroad. We only use providers who offer terms
        committing them to protect it, and we transfer only what the feature
        needs to work.
      </p>

      <h2>How long we keep it</h2>
      <p>
        Account data — profile, resumes, drafts, conversations — is kept until
        you delete it or ask us to close your account, after which it is removed
        from our live systems and disappears from backups as those age out.
        Waitlist emails are kept until you ask to be taken off the list.
        Analytics rows contain no name, email or address and are kept as a
        long-run record of how the site is doing. Usage counters are kept as
        long as they are needed for billing and limits.
      </p>

      <h2>Your rights</h2>
      <p>
        Under the DPDP Act you can ask us for a copy of the personal data we
        hold about you, ask us to correct or complete anything wrong, ask us to
        erase it, withdraw a consent you previously gave, and nominate someone
        to exercise these rights if you cannot. Most of it you can do yourself
        from your account settings; for anything else, email{" "}
        <a href="mailto:hello@cheatcodeapp.com">hello@cheatcodeapp.com</a> and we
        will answer within thirty days.
      </p>
      <p>
        If you are not satisfied with how we have handled a request, the same
        address is our grievance contact — say so in the subject line and it
        gets treated as a complaint rather than a question. You also have the
        right to complain to the Data Protection Board of India.
      </p>

      <h2>Children</h2>
      <p>
        Cheatcode is built for people at the start of a career and is not
        intended for anyone under 18. We do not knowingly create accounts for
        children. If you believe a child has given us personal data, write to us
        and we will delete it.
      </p>

      <h2>Security</h2>
      <p>
        Everything travels over HTTPS. Database access is governed by row-level
        security, so one account cannot read another&apos;s resume or
        conversations. Administrative access is limited to us and protected by a
        separate login. No system is perfect, and we will not pretend otherwise
        — if a breach ever affects your data, we will tell you and the Data
        Protection Board of India as the law requires.
      </p>

      <h2>Changes</h2>
      <p>
        When this policy changes we will update the date at the top of the page,
        and for anything significant we will tell account holders directly
        rather than relying on you to re-read it.
      </p>

      <h2>Contact</h2>
      <p>
        <a href="mailto:hello@cheatcodeapp.com">hello@cheatcodeapp.com</a> —
        privacy questions, data requests and grievances all arrive here. See
        also our <Link href="/terms">terms of service</Link> and our{" "}
        <Link href="/refunds">refund policy</Link>.
      </p>
    </LegalPage>
  );
}
