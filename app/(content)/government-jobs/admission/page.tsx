import type { Metadata } from "next";
import { SITE } from "@/lib/seo/constants";
import { KindScreen } from "@/components/govt/KindScreen";

export const revalidate = 600;

export const metadata: Metadata = {
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

export default function Page() {
  return <KindScreen kind="admission" blurb="Entrance and counselling notices from universities and government institutions." />;
}
