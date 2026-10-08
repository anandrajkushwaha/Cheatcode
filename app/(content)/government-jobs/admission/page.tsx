import type { Metadata } from "next";
import { SITE } from "@/lib/seo/constants";
import { KindScreen } from "@/components/govt/KindScreen";
import { pageFrom, pagedMetadata } from "@/lib/govt/paging";

export const revalidate = 120;

const base: Metadata = {
  title: "Government Admission Notices 2026 \u2014 Entrance and Counselling | Cheatcode",
  description: "Entrance and counselling notices from universities and government institutions.",
  alternates: { canonical: `${SITE.url}/government-jobs/admission` },
  openGraph: {
    title: "Government Admission Notices 2026 \u2014 Entrance and Counselling",
    description: "Entrance and counselling notices from universities and government institutions.",
    url: `${SITE.url}/government-jobs/admission`,
    siteName: SITE.name,
    type: "website",
  },
};

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  return pagedMetadata(base, "admission", pageFrom(await searchParams));
}

export default async function Page({ searchParams }: Props) {
  return (
    <KindScreen
      kind="admission"
      page={pageFrom(await searchParams)}
      blurb="Entrance and counselling notices from universities and government institutions."
    />
  );
}
