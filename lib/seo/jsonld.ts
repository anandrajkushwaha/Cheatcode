import { SITE } from "./constants";

/**
 * Who Cheatcode is, on every page — the entity behind a brand search.
 *
 * "cheatcode" alone is mostly video-game cheat codes, so the markup spells
 * out the other names people type (alternateName), what the company is
 * about (knowsAbout) and who runs it, and links the profiles that confirm
 * it (sameAs). Google's knowledge panel and AI answers both lean on this.
 */
export function organizationJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": `${SITE.url}/#organization`,
    name: SITE.name,
    alternateName: ["Cheatcode App", "cheatcodeapp", "cheatcodeapp.com"],
    legalName: SITE.name,
    url: SITE.url,
    logo: { "@type": "ImageObject", url: `${SITE.url}/icon-512.png`, width: 512, height: 512 },
    image: `${SITE.url}/icon-512.png`,
    slogan: SITE.tagline,
    description: SITE.description,
    foundingDate: "2026-08",
    founder: { "@type": "Person", name: "Anand Raj Kushwaha" },
    areaServed: { "@type": "Country", name: "India" },
    knowsAbout: [
      "Resume writing",
      "ATS resume check",
      "Resume templates",
      "Job search in India",
      "Interview preparation",
      "Government jobs in India",
      "Career guidance for freshers",
    ],
    email: SITE.email,
    contactPoint: { "@type": "ContactPoint", contactType: "customer support", email: SITE.email, areaServed: "IN", availableLanguage: ["English", "Hindi"] },
    sameAs: [...SITE.sameAs],
  };
}

export function websiteJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": `${SITE.url}/#website`,
    name: SITE.name,
    alternateName: ["Cheatcode App", "cheatcodeapp"],
    url: SITE.url,
    description: SITE.description,
    inLanguage: "en-IN",
    publisher: { "@id": `${SITE.url}/#organization` },
  };
}

/**
 * BreadcrumbList from the same items the visible <Breadcrumbs> draws.
 *
 * Paths, not URLs: the last crumb is usually the page itself and has no href
 * in the visible trail, so it takes `path` from the caller instead — Google
 * wants an item URL on every entry but the last is allowed to omit it, and
 * giving it one costs nothing.
 */
export function breadcrumbJsonLd(items: { label: string; path?: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((it, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: it.label,
      ...(it.path !== undefined ? { item: `${SITE.url}${it.path === "/" ? "" : it.path}` } : {}),
    })),
  };
}

/** Tolerates both {q,a} and {question,answer} shapes. */
export function faqJsonLd(items: { q?: string; a?: string; question?: string; answer?: string }[]) {
  const entries = (items ?? [])
    .map((it) => ({ q: it.q ?? it.question ?? "", a: it.a ?? it.answer ?? "" }))
    .filter((it) => it.q && it.a);

  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: entries.map(({ q, a }) => ({
      "@type": "Question",
      name: q,
      acceptedAnswer: { "@type": "Answer", text: a },
    })),
  };
}
