import Link from "next/link";
import { notFound } from "next/navigation";
import { getInsight } from "@/lib/studio/insights";
import { ChevronRightIcon } from "@/components/studio/icons";

/**
 * One insight, on its own page.
 *
 * What this page is careful *not* to be: a copy of the publisher's article.
 * We store a headline, an excerpt and a link, and this shows exactly those
 * three things. Mirroring the full text would be republishing somebody else's
 * work, and attribution does not make that alright — so the most prominent
 * thing on the page, after the headline, is the way out to the source.
 *
 * The image is a plain img rather than next/image on purpose. next.config
 * allowlists our own Supabase storage and nothing else, and widening it to
 * every publisher domain would turn our image endpoint into an open proxy
 * that anyone could point at anything.
 */

const KIND_LABEL: Record<string, string> = {
  trend: "Trend",
  guide: "Guide",
  tip: "Tip",
};

export default async function InsightPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const insight = await getInsight(id);
  if (!insight) notFound();

  let host: string | null = null;
  try {
    host = new URL(insight.url).hostname.replace(/^www\./, "");
  } catch {
    /* A malformed URL costs the label, not the page. */
  }

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <article className="mx-auto max-w-[62ch] px-5 py-8 sm:px-8 sm:py-12">
        <Link
          href="/studio/insights"
          className="inline-flex items-center gap-1 text-[0.85rem] text-ink-50 transition-colors hover:text-ink-70"
        >
          <ChevronRightIcon className="size-4 rotate-180" />
          All insights
        </Link>

        <p className="mt-6 flex flex-wrap items-center gap-2 text-[0.78rem] text-ink-30">
          <span className="rounded-full bg-studio-accent/10 px-2.5 py-1 font-medium text-studio-accent">
            {KIND_LABEL[insight.kind] ?? "Trend"}
          </span>
          <span className="truncate">{insight.source}</span>
          {insight.publishedLabel && (
            <>
              <span aria-hidden>·</span>
              <span>{insight.publishedLabel}</span>
            </>
          )}
        </p>

        <h1 className="mt-3 text-[clamp(1.5rem,3.2vw,2.15rem)] font-semibold leading-[1.2] tracking-[-0.03em] text-ink">
          {insight.title}
        </h1>

        {insight.imageUrl && (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={insight.imageUrl}
            alt=""
            loading="lazy"
            referrerPolicy="no-referrer"
            className="mt-7 w-full rounded-studio-card bg-ink-04 object-cover"
          />
        )}

        {insight.summary && (
          <p className="mt-7 text-[1.05rem] leading-relaxed text-ink-70">
            {insight.summary}
          </p>
        )}

        <div className="mt-9 rounded-studio-card border border-studio-edge bg-paper p-5">
          <p className="text-[0.85rem] leading-relaxed text-ink-50">
            This is a short extract. The full story is{" "}
            {host ? `on ${host}` : "on the publisher's site"}, where it belongs.
          </p>
          <a
            href={insight.url}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 inline-flex items-center gap-2 rounded-full bg-studio-accent px-5 py-2.5 text-[0.9rem] font-medium text-paper transition-opacity hover:opacity-90"
          >
            Read it on {insight.source}
            <ChevronRightIcon className="size-4" />
          </a>
        </div>
      </article>
    </div>
  );
}
