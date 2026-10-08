import type { Metadata } from "next";
import { SITE } from "@/lib/seo/constants";
import { KindScreen } from "@/components/govt/KindScreen";
import { pageFrom, pagedMetadata } from "@/lib/govt/paging";

export const revalidate = 120;

const base: Metadata = {
  title: "Government Exam Answer Key 2026 \u2014 Provisional and Final | Cheatcode",
  description: "Provisional and final answer keys published by the recruitment boards, linked to the official page.",
  alternates: { canonical: `${SITE.url}/government-jobs/answer-key` },
  openGraph: {
    title: "Government Exam Answer Key 2026 \u2014 Provisional and Final",
    description: "Provisional and final answer keys published by the recruitment boards, linked to the official page.",
    url: `${SITE.url}/government-jobs/answer-key`,
    siteName: SITE.name,
    type: "website",
  },
};

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  return pagedMetadata(base, "answer-key", pageFrom(await searchParams));
}

export default async function Page({ searchParams }: Props) {
  return (
    <KindScreen
      kind="answer_key"
      page={pageFrom(await searchParams)}
      blurb="Answer keys as the boards publish them, provisional and final. Objection windows are stated on the official page."
    />
  );
}
