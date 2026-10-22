/**
 * Contextual links inside an article, added when it is rendered.
 *
 * A keyword → URL map (see KEYWORD_LINKS and the posts' focus keywords) is
 * matched against the article's text, and the first occurrence of each
 * phrase becomes a link — at most `max` per article, never to the article
 * itself, never to a page the article already links to, and never inside a
 * heading, an existing link, code, or a button. The stored HTML is not
 * changed: the links are part of the page Google is served, and the map can
 * be tuned without touching 300 posts.
 *
 * Pure: no imports, so npm test can run it.
 */

export type LinkTarget = { phrase: string; href: string; caseSensitive?: boolean };

/**
 * Hand-picked phrases, checked before the posts' focus keywords. Hrefs to
 * posts are dropped at render time when that post is not published, so a
 * stale line here never produces a dead link.
 */
export const KEYWORD_LINKS: LinkTarget[] = [
  { phrase: "applicant tracking system", href: "/tools/resume-ats-checker" },
  { phrase: "ATS checker", href: "/tools/resume-ats-checker" },
  { phrase: "ATS score", href: "/tools/resume-ats-checker" },
  { phrase: "in-hand salary calculator", href: "/tools/in-hand-salary-calculator" },
  { phrase: "take-home salary", href: "/tools/in-hand-salary-calculator" },
  { phrase: "expected CTC", href: "/blog/expected-ctc-question" },
  { phrase: "pre-placement offer", href: "/blog/pre-placement-offer" },
  { phrase: "CTC vs in-hand", href: "/blog/ctc-vs-in-hand-salary" },
  { phrase: "notice period", href: "/blog/notice-period-rules-india" },
  { phrase: "Form 16", href: "/blog/form-16-explained" },
  { phrase: "HRA exemption", href: "/blog/hra-exemption-calculation" },
  { phrase: "gratuity", href: "/blog/gratuity-calculation-india" },
  { phrase: "new tax regime", href: "/blog/new-tax-regime-vs-old-regime" },
  { phrase: "old tax regime", href: "/blog/new-tax-regime-vs-old-regime" },
  { phrase: "EPF balance", href: "/blog/how-to-check-epf-balance" },
  { phrase: "PF transfer", href: "/blog/pf-transfer-job-change" },
  { phrase: "UAN", href: "/blog/uan-activation-kyc-guide", caseSensitive: true },
  { phrase: "salary negotiation", href: "/blog/how-to-negotiate-salary" },
  { phrase: "cover letter", href: "/blog/how-to-write-a-cover-letter" },
  { phrase: "STAR method", href: "/blog/star-method-interview" },
  { phrase: "tell me about yourself", href: "/blog/tell-me-about-yourself" },
  { phrase: "resume summary", href: "/blog/resume-summary-examples" },
  { phrase: "relieving letter", href: "/blog/relieving-letter-format-india" },
  { phrase: "resignation letter", href: "/blog/resignation-letter-format" },
  { phrase: "offer letter", href: "/blog/offer-letter-format-india" },
  { phrase: "experience letter", href: "/blog/experience-letter-format-india" },
  { phrase: "background verification", href: "/blog/background-verification-process-india" },
  { phrase: "campus placement", href: "/blog/campus-placement-preparation" },
  { phrase: "off-campus drive", href: "/blog/off-campus-drive" },
  { phrase: "TCS NQT", href: "/blog/tcs-nqt-preparation", caseSensitive: true },
  { phrase: "group discussion", href: "/blog/group-discussion-topics-tips" },
  { phrase: "aptitude test", href: "/blog/aptitude-test-preparation" },
  { phrase: "appraisal hike", href: "/blog/appraisal-hike-percentage-india" },
  { phrase: "counter-offer", href: "/blog/counter-offer-accept-or-not" },
  { phrase: "employment gap", href: "/blog/how-to-explain-employment-gap" },
];

/** "/blog/x", whatever form the href was written in; null for other sites. */
export function localPath(href: string): string | null {
  const m = /^(?:https?:\/\/(?:www\.)?cheatcodeapp\.com)?(\/[^?#"']*)/i.exec(href.trim());
  if (!m) return null;
  return m[1].length > 1 ? m[1].replace(/\/+$/, "") : m[1];
}

const SKIP = new Set(["a", "h1", "h2", "h3", "h4", "h5", "h6", "code", "pre", "button", "script", "style"]);

function escape(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function autolink(html: string, targets: LinkTarget[], selfPath: string, max = 5): string {
  if (!html || max <= 0) return html;

  // Pages this article already links to, and the article itself.
  const linked = new Set<string>([selfPath]);
  for (const m of html.matchAll(/<a\b[^>]*\bhref\s*=\s*["']([^"']+)["']/gi)) {
    const p = localPath(m[1]);
    if (p) linked.add(p);
  }

  // Longest phrase first, so "in-hand salary calculator" beats "in-hand salary";
  // one candidate per href and per phrase (two guides with the same focus
  // keyword would otherwise link one phrase two ways).
  const seen = new Set<string>();
  const pending = [...targets]
    .sort((a, b) => b.phrase.length - a.phrase.length)
    .filter((t) => {
      const phrase = `phrase:${t.phrase.trim().toLowerCase()}`;
      if (linked.has(t.href) || seen.has(t.href) || seen.has(phrase) || t.phrase.trim().length < 3) return false;
      seen.add(t.href);
      seen.add(phrase);
      return true;
    })
    .map((t) => ({
      ...t,
      re: new RegExp(`(?<![\\w-])${escape(t.phrase)}(?![\\w-])`, t.caseSensitive ? "" : "i"),
    }));
  if (!pending.length) return html;

  let added = 0;
  let depth = 0; // inside any SKIP element
  const parts = html.split(/(<[^>]+>)/);
  for (let i = 0; i < parts.length && added < max; i++) {
    const part = parts[i];
    if (part.startsWith("<")) {
      const tag = /^<\/?\s*([a-z0-9]+)/i.exec(part)?.[1]?.toLowerCase();
      if (tag && SKIP.has(tag) && !part.endsWith("/>")) depth += part.startsWith("</") ? -1 : 1;
      if (depth < 0) depth = 0;
      continue;
    }
    if (depth > 0 || !part.trim()) continue;

    // Within one text run, link left to right, never inside what was just added.
    let pieces: { text: string; done: boolean }[] = [{ text: part, done: false }];
    for (const t of pending) {
      if (added >= max || linked.has(t.href)) continue;
      const next: typeof pieces = [];
      let hit = false;
      for (const piece of pieces) {
        if (hit || piece.done) {
          next.push(piece);
          continue;
        }
        const m = t.re.exec(piece.text);
        if (!m) {
          next.push(piece);
          continue;
        }
        hit = true;
        next.push({ text: piece.text.slice(0, m.index), done: false });
        next.push({ text: `<a href="${t.href}">${m[0]}</a>`, done: true });
        next.push({ text: piece.text.slice(m.index + m[0].length), done: false });
      }
      if (hit) {
        linked.add(t.href);
        added += 1;
        pieces = next;
      }
    }
    parts[i] = pieces.map((p) => p.text).join("");
  }
  return parts.join("");
}

/**
 * Paths that are noindex: sign-in, the app, the ad landing pages, the guest
 * builder, and the interview question bank's index while it has no published banks (drop it
 * from here when it does — see app/(content)/interview-questions/page.tsx).
 */
const PRIVATE =
  /^(?:https?:\/\/(?:www\.)?cheatcodeapp\.com)?\/(?:(?:signin|signup|app|admin|build-resume|resume-builder)(?:[/?#]|$)|interview-questions(?:[?#]|$))/i;

/** rel for a link: nofollow when it points at a noindex page, so crawl time goes to the guides. */
export function relFor(href: string): "nofollow" | undefined {
  return PRIVATE.test(href) ? "nofollow" : undefined;
}

/** The same, applied to every link in a block of stored article HTML. */
export function nofollowPrivate(html: string): string {
  return html.replace(/<a\b([^>]*?)\bhref\s*=\s*(["'])([^"']+)\2([^>]*)>/gi, (whole, pre, q, href, post) => {
    if (!relFor(href) || /\brel\s*=/i.test(pre + post)) return whole;
    return `<a${pre}href=${q}${href}${q}${post} rel="nofollow">`;
  });
}

/**
 * Internal links as they should be served: a link to a merged guide goes
 * straight to the guide that kept the topic (no redirect hop), and a link to
 * a guide that is not live — scheduled, archived, unpublished — is removed,
 * keeping its words. `live` holds "/blog/slug" for every published guide.
 */
export function fixGuideLinks(html: string, live: Set<string>, merged: Record<string, string>): string {
  return html.replace(
    /<a\b([^>]*?)\bhref\s*=\s*(["'])([^"']+)\2([^>]*)>([\s\S]*?)<\/a>/gi,
    (whole, pre, q, href, post, inner) => {
      const path = localPath(href);
      const slug = path ? /^\/blog\/([a-z0-9-]+)$/.exec(path)?.[1] : undefined;
      if (!slug) return whole;
      const to = merged[slug];
      if (to) return `<a${pre}href=${q}${to.startsWith("/") ? to : `/blog/${to}`}${q}${post}>${inner}</a>`;
      return live.has(`/blog/${slug}`) ? whole : inner;
    },
  );
}
