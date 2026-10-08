import type { Metadata } from "next";
import { SITE } from "@/lib/seo/constants";
import { KindScreen } from "@/components/govt/KindScreen";

export const revalidate = 600;

export const metadata: Metadata = {
  title: "Government Exam Syllabus 2026 and Exam Pattern | Cheatcode",
  description: "Official syllabus and exam pattern documents, linked to the board's own notification.",
  alternates: { canonical: `${SITE.url}/government-jobs/syllabus` },
  openGraph: {
    title: "Government Exam Syllabus 2026 and Exam Pattern",
    description: "Official syllabus and exam pattern documents, linked to the board's own notification.",
    url: `${SITE.url}/government-jobs/syllabus`,
    siteName: SITE.name,
    type: "website",
  },
};

export default function Page() {
  return <KindScreen kind="syllabus" blurb="Syllabus and exam pattern, straight from the notification that announced it." />;
}
