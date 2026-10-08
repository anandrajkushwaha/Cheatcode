import type { Metadata } from "next";
import { SITE } from "@/lib/seo/constants";
import { getClosingSoon } from "@/lib/govt/query";
import { ExamListScreen } from "@/components/govt/ExamListScreen";

export const revalidate = 120;

export const metadata: Metadata = {
  title: "Government Jobs Closing Soon \u2014 Last Date This Week | Cheatcode",
  description: "Government recruitments whose application deadline falls in the next few days, nearest first.",
  alternates: { canonical: `${SITE.url}/government-jobs/closing-soon` },
};

export default async function Page() {
  const exams = await getClosingSoon();
  return (
    <ExamListScreen
      title="Closing soon"
      blurb="Applications with a verified closing date in the next few days. The date beside each one is the date stated in its official notification."
      exams={exams}
      emptyLine="Nothing is closing in the next few days."
    />
  );
}
