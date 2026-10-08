import type { Metadata } from "next";
import { SITE } from "@/lib/seo/constants";
import { getUndated } from "@/lib/govt/query";
import { ExamListScreen } from "@/components/govt/ExamListScreen";

export const revalidate = 120;

export const metadata: Metadata = {
  title: "Government Recruitments With No Stated Closing Date | Cheatcode",
  description: "Published government notices whose application closing date we have not been able to verify from the official notification.",
  alternates: { canonical: `${SITE.url}/government-jobs/dates-not-stated` },
};

export default async function Page() {
  const exams = await getUndated();
  return (
    <ExamListScreen
      title="Dates not stated"
      blurb="Real notices whose closing date we have not verified from the official notification. They are not necessarily open \u2014 the date is simply not something we can stand behind, so we do not claim it. The official notification is linked on each one."
      exams={exams}
      emptyLine="Every published recruitment has a verified closing date."
    />
  );
}
