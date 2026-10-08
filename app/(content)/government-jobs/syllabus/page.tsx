import type { Metadata } from "next";
import { SITE } from "@/lib/seo/constants";
import { KindScreen } from "@/components/govt/KindScreen";
import { pageFrom, pagedMetadata } from "@/lib/govt/paging";

export const revalidate = 120;

const base: Metadata = {
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

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  return pagedMetadata(base, "syllabus", pageFrom(await searchParams));
}

export default async function Page({ searchParams }: Props) {
  return (
    <KindScreen
      kind="syllabus"
      page={pageFrom(await searchParams)}
      blurb="Syllabus and exam pattern, straight from the notification that announced it."
    />
  );
}
