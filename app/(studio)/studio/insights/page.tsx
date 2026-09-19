import Link from "next/link";
import { getInsights } from "@/lib/studio/insights";

/**
 * Every insight, not just the three the panel has room for.
 *
 * The panel is glanceable and this is browsable, which is why it is a grid
 * rather than the same narrow column repeated — at this width the eye can
 * compare headlines instead of reading them one at a time.
 */
export default async function InsightsIndexPage() {
  const items = await getInsights(60);

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto max-w-[70rem] px-5 py-8 sm:px-8 sm:py-10">
        <h1 className="font-display text-[clamp(1.9rem,4vw,2.6rem)] font-bold italic leading-none text-studio-accent">
          Insights
        </h1>
        <p className="mt-3 max-w-[52ch] text-[0.95rem] leading-relaxed text-ink-50">
          What is moving in the job market, pulled from the places that cover
          it. Headlines and extracts — each one links back to whoever wrote it.
        </p>

        {items.length === 0 ? (
          <p className="mt-12 text-[0.95rem] text-ink-30">
            Nothing here yet. The feed fills itself a few times a day.
          </p>
        ) : (
          <ul className="mt-9 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((item) => (
              <li key={item.id}>
                <Link
                  href={`/studio/insights/${item.id}`}
                  className="flex h-full flex-col rounded-studio-card bg-paper p-5 transition-shadow hover:shadow-studio"
                >
                  <p className="text-[1rem] font-medium leading-snug text-ink-70">
                    {item.title}
                  </p>
                  {item.summary && (
                    <p className="mt-2 line-clamp-3 text-[0.85rem] leading-relaxed text-ink-50">
                      {item.summary}
                    </p>
                  )}
                  <p className="mt-4 flex items-center gap-1.5 pt-1 text-[0.75rem] text-ink-30">
                    <span className="truncate">{item.source}</span>
                    {item.publishedLabel && (
                      <>
                        <span aria-hidden>·</span>
                        <span className="shrink-0">{item.publishedLabel}</span>
                      </>
                    )}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
