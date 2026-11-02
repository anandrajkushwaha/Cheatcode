import type { Metadata } from "next";
import { getExamSlugs } from "@/lib/govt/query";

export const revalidate = 120;

/**
 * Keep the government-jobs section out of Google while it has nothing in it.
 *
 * Every listing is retired right now, so the hub and the kind pages are
 * empty shells. Search Console had all ten of them under "Discovered —
 * currently not indexed", and empty pages count against the whole site's
 * quality, not only themselves. noindex,follow until one exam is published
 * or closed; then this returns nothing and each page's own metadata
 * (index, follow) applies again. An exam page decides for itself.
 */
export async function generateMetadata(): Promise<Metadata> {
  const exams = await getExamSlugs();
  return exams.length ? {} : { robots: { index: false, follow: true } };
}

export default function GovernmentJobsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
