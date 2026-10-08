import type { Metadata } from "next";
import { SITE } from "@/lib/seo/constants";
import { KindScreen } from "@/components/govt/KindScreen";

export const revalidate = 120;

export const metadata: Metadata = {
  title: "Sarkari Result 2026 \u2014 Latest Government Exam Results | Cheatcode",
  description: "Government exam results as the boards declare them, each linked to the official result page.",
  alternates: { canonical: `${SITE.url}/government-jobs/results` },
  openGraph: {
    title: "Sarkari Result 2026 \u2014 Latest Government Exam Results",
    description: "Government exam results as the boards declare them, each linked to the official result page.",
    url: `${SITE.url}/government-jobs/results`,
    siteName: SITE.name,
    type: "website",
  },
};

export default function Page() {
  return <KindScreen kind="result" blurb="Results as the recruitment boards declare them. Each links to the official result page, and to the exam it belongs to." />;
}
