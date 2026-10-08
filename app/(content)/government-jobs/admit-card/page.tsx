import type { Metadata } from "next";
import { SITE } from "@/lib/seo/constants";
import { KindScreen } from "@/components/govt/KindScreen";

export const revalidate = 120;

export const metadata: Metadata = {
  title: "Government Exam Admit Card 2026 \u2014 Hall Tickets | Cheatcode",
  description: "Admit cards and hall tickets released by the recruitment boards, linked to the official download page.",
  alternates: { canonical: `${SITE.url}/government-jobs/admit-card` },
  openGraph: {
    title: "Government Exam Admit Card 2026 \u2014 Hall Tickets",
    description: "Admit cards and hall tickets released by the recruitment boards, linked to the official download page.",
    url: `${SITE.url}/government-jobs/admit-card`,
    siteName: SITE.name,
    type: "website",
  },
};

export default function Page() {
  return <KindScreen kind="admit_card" blurb="Admit cards as they are released. The link goes to the board's own download page \u2014 we never host a hall ticket." />;
}
