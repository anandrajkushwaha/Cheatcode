import type { Metadata } from "next";
import { SITE } from "@/lib/seo/constants";
import { getClosed } from "@/lib/govt/query";
import { ExamListScreen } from "@/components/govt/ExamListScreen";

export const revalidate = 120;

export const metadata: Metadata = {
  title: "Closed Government Recruitments \u2014 Past Notifications | Cheatcode",
  description: "Government recruitments whose application deadline has passed, kept for reference with their official notifications.",
  alternates: { canonical: `${SITE.url}/government-jobs/closed` },
};

export default async function Page() {
  const exams = await getClosed();
  return (
    <ExamListScreen
      title="Closed recruitments"
      blurb="Applications whose stated closing date has passed. Kept rather than removed \u2014 the notification, the result and the admit card for these are still worth finding."
      exams={exams}
      emptyLine="Nothing has closed yet."
    />
  );
}
