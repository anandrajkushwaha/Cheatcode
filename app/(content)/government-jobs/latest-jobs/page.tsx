import type { Metadata } from "next";
import { SITE } from "@/lib/seo/constants";
import { KindScreen } from "@/components/govt/KindScreen";
import { pageFrom, pagedMetadata } from "@/lib/govt/paging";

export const revalidate = 120;

const base: Metadata = {
  title: "Latest Government Jobs 2026 \u2014 Sarkari Naukri Notifications | Cheatcode",
  description: "Every open government recruitment we have, newest first, with the official notification linked. Free and no sign-up.",
  alternates: { canonical: `${SITE.url}/government-jobs/latest-jobs` },
  openGraph: {
    title: "Latest Government Jobs 2026 \u2014 Sarkari Naukri Notifications",
    description: "Every open government recruitment we have, newest first, with the official notification linked. Free and no sign-up.",
    url: `${SITE.url}/government-jobs/latest-jobs`,
    siteName: SITE.name,
    type: "website",
  },
};

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  return pagedMetadata(base, "latest-jobs", pageFrom(await searchParams));
}

export default async function Page({ searchParams }: Props) {
  return (
    <KindScreen
      kind="job"
      page={pageFrom(await searchParams)}
      blurb="Open government recruitments, newest first. Each one links to the official notification and to a page showing where that exam has got to."
    />
  );
}
