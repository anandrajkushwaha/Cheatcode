import { SITE } from "./constants";

export function organizationJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": `${SITE.url}/#organization`,
    name: SITE.name,
    url: SITE.url,
    logo: `${SITE.url}/icon-512.png`,
    description: SITE.description,
    areaServed: "IN",
    email: SITE.email,
    sameAs: [...SITE.sameAs],
  };
}

export function websiteJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": `${SITE.url}/#website`,
    name: SITE.name,
    url: SITE.url,
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
