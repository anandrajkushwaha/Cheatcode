import { SITE } from "./constants";

export function organizationJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: SITE.name,
    url: SITE.url,
    description: SITE.description,
    areaServed: "IN",
  };
}

export function websiteJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: SITE.name,
    url: SITE.url,
    inLanguage: "en-IN",
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
