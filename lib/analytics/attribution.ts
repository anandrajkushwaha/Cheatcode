/**
 * Where a visit came from — one answer, used by the browser and the server.
 *
 * Importless so both sides read the same rules. Order of evidence:
 *
 *   1. utm_* on the landing URL — what our own ads and links say. Meta ads
 *      must carry them (see the URL parameters on each ad); Google Ads adds
 *      gclid on its own.
 *   2. Click ids — gclid/gbraid/wbraid mean a Google ad; fbclid means the link
 *      was clicked inside Facebook or Instagram (paid or organic — Meta adds
 *      it to both, which is why the ads also need utm tags).
 *   3. The referrer's domain — Google search, LinkedIn, WhatsApp…
 *
 * Nothing at all is "direct".
 */

export type Touch = {
  /** "meta ads", "google ads", "instagram", "google", "direct", … */
  source: string;
  /** "paid", "organic", "social", "referral", "none" */
  medium: string;
  campaign: string | null;
};

const REFERRERS: [string, string, string[]][] = [
  // [source, medium, domains]
  ["google", "organic", ["google.com", "google.co.in", "googleusercontent.com"]],
  ["bing", "organic", ["bing.com"]],
  ["duckduckgo", "organic", ["duckduckgo.com"]],
  ["linkedin", "social", ["linkedin.com", "lnkd.in"]],
  ["instagram", "social", ["instagram.com"]],
  ["facebook", "social", ["facebook.com", "fb.com", "fb.me", "m.facebook.com", "l.facebook.com"]],
  ["x", "social", ["x.com", "twitter.com", "t.co"]],
  ["reddit", "social", ["reddit.com", "redd.it"]],
  ["whatsapp", "social", ["whatsapp.com", "wa.me"]],
  ["youtube", "social", ["youtube.com", "youtu.be"]],
  ["quora", "social", ["quora.com"]],
  ["telegram", "social", ["telegram.org", "t.me"]],
  ["chatgpt", "referral", ["chatgpt.com", "chat.openai.com"]],
  ["internal", "none", ["cheatcodeapp.com"]],
];

const isDomain = (host: string, d: string) => host === d || host.endsWith(`.${d}`);

export function fromReferrer(host: string | null | undefined): Touch | null {
  if (!host) return null;
  const h = host.toLowerCase().replace(/^www\./, "");
  for (const [source, medium, domains] of REFERRERS) {
    if (domains.some((d) => isDomain(h, d))) {
      return source === "internal" ? null : { source, medium, campaign: null };
    }
  }
  return { source: h.slice(0, 60), medium: "referral", campaign: null };
}

const clean = (v: string | null | undefined, max = 80) =>
  (v ?? "").trim().toLowerCase().replace(/[^a-z0-9 _.\-|/+]/g, "").slice(0, max) || null;

const SOCIAL_ALIASES: Record<string, string> = {
  fb: "facebook",
  facebook: "facebook",
  ig: "instagram",
  instagram: "instagram",
  meta: "meta",
  an: "meta",
  msg: "meta",
};

/** Read a landing URL's query string and referrer. Null when there is no signal. */
export function classify(search: string, referrerHost: string | null): Touch | null {
  const q = new URLSearchParams(search);
  const utmSource = clean(q.get("utm_source"), 40);
  const utmMedium = clean(q.get("utm_medium"), 40);
  const campaign = clean(q.get("utm_campaign"));

  if (utmSource) {
    const base = SOCIAL_ALIASES[utmSource] ?? utmSource;
    const paid = /cpc|ppc|paid|ads?\b|display|cpm/.test(utmMedium ?? "");
    // Every Meta placement reads as one "meta ads" line: that is the budget
    // somebody is deciding on. The finer split is in the campaign name.
    const source = paid
      ? `${["facebook", "instagram", "meta"].includes(base) ? "meta" : base} ads`
      : base;
    return { source, medium: paid ? "paid" : utmMedium ?? "referral", campaign };
  }

  if (q.get("gclid") || q.get("gbraid") || q.get("wbraid")) {
    return { source: "google ads", medium: "paid", campaign };
  }

  if (q.get("fbclid")) {
    const ref = fromReferrer(referrerHost);
    const source = ref?.source === "instagram" ? "instagram" : "facebook";
    return { source, medium: "social", campaign };
  }

  return fromReferrer(referrerHost);
}

export const DIRECT: Touch = { source: "direct", medium: "none", campaign: null };

/** Accept a touch from the browser, trusting nothing about its shape. */
export function sanitizeTouch(v: unknown): Touch | null {
  if (!v || typeof v !== "object") return null;
  const t = v as Record<string, unknown>;
  const source = typeof t.source === "string" ? clean(t.source, 60) : null;
  if (!source) return null;
  return {
    source,
    medium: (typeof t.medium === "string" ? clean(t.medium, 30) : null) ?? "none",
    campaign: typeof t.campaign === "string" ? clean(t.campaign) : null,
  };
}
