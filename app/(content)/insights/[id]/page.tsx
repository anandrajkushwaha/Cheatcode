import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getInsight } from "@/lib/insights/query";
import { SITE } from "@/lib/seo/constants";

export const revalidate = 3600;

type Props = { params: Promise<{ id: string }> };

/**
 * Where a shared insight lands.
 *
 * Outside the sign-in wall, because the person opening a link from WhatsApp
 * usually has no account — and a login screen is where a shared link goes to
 * die. They read the card, see the source, and are offered the rest.
 *
 * The link preview is the card itself (the ?f=og version), so the message in
 * the chat already shows the headline before anybody taps.
 *
 * noindex: 70 words summarising somebody else's report is a good thing to
 * share and a thin thing to rank; the guides are what should be found.
 */
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const item = await getInsight(id);
  if (!item) return { title: "Not found", robots: { index: false, follow: false } };

  const url = `${SITE.url}/insights/${item.id}`;
  const image = `${SITE.url}/api/insights/${item.id}/card?f=og`;
  return {
    title: `${item.title} | Cheatcode Insights`,
    description: item.summary,
    robots: { index: false, follow: true },
    alternates: { canonical: url },
    openGraph: {
      title: item.title,
      description: item.summary,
      url,
      siteName: SITE.name,
      type: "article",
      images: [{ url: image, width: 1200, height: 630, alt: item.title }],
    },
    twitter: { card: "summary_large_image", title: item.title, description: item.summary, images: [image] },
  };
}

export default async function SharedInsight({ params }: Props) {
  const { id } = await params;
  const item = await getInsight(id);
  if (!item) notFound();

  const date = new Date(item.at).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Asia/Kolkata",
  });

  return (
    <div className="container-page max-w-[760px] py-10 sm:py-14">
      <article className="overflow-hidden rounded-3xl border border-[#efe9cf] bg-paper">
        {item.imageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={item.imageUrl} alt="" className="h-64 w-full object-cover sm:h-80" />
        )}
        <div className="p-6 sm:p-9">
          <div className="flex items-center gap-3 text-[0.78rem]">
            <span
              className={`rounded-full px-2.5 py-0.5 font-medium uppercase tracking-[0.1em] ${
                item.category === "guide" ? "bg-[#e8efff] text-[#1f5bff]" : "bg-[#fff1dc] text-[#b35f00]"
              }`}
            >
              {item.category === "guide" ? "Tips" : "Trend"}
            </span>
            <span className="text-ink-30">{date}</span>
          </div>
          <h1 className="mt-4 text-[1.6rem] font-semibold leading-snug tracking-[-0.02em] sm:text-[2rem]">
            {item.title}
          </h1>
          <p className="mt-4 text-[1.02rem] leading-[1.75] text-ink-70">{item.summary}</p>
          {item.sourceUrl && (
            <a
              href={item.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-6 inline-block text-[0.88rem] text-ink-50 hover:text-ink"
            >
              Read the full story at <span className="font-medium text-ink">{item.sourceName ?? "the source"}</span> ↗
            </a>
          )}
        </div>
      </article>

      <div className="mt-8 rounded-3xl bg-[#16162a] p-7 text-white sm:p-9">
        <p className="text-[1.2rem] font-semibold">More like this, every day</p>
        <p className="mt-2 max-w-[48ch] text-[0.92rem] leading-relaxed text-white/70">
          Cheatcode Insights: what is happening in hiring, pay and work rules in India, in 70 words each —
          plus jobs, a free resume builder and mock interviews.
        </p>
        <Link
          href={`/signin?next=${encodeURIComponent(`/app/insights?id=${item.id}`)}`}
          data-ev="cta_click"
          data-ev-location="shared-insight"
          data-ev-label="Sign up"
          className="mt-6 inline-block rounded-full bg-paper px-6 py-3 text-[0.9rem] font-medium text-ink"
        >
          Read more insights — free
        </Link>
      </div>
    </div>
  );
}
