import Link from "next/link";
import type { LiveBanner } from "@/lib/queries/banners";

/**
 * A promotional slot on the site.
 *
 * Everything is tagged with data-ev so the existing analytics delegate picks it
 * up: banner_click on the link, and banner_view from the intersection observer
 * that already watches for CTAs. The banner id travels in data-ev-label, which
 * is what banner_stats joins on — so measurement needs no extra wiring here,
 * and a banner cannot ship without being measurable.
 */
export function PromoBanner({ banner }: { banner: LiveBanner | null }) {
  if (!banner) return null;

  const dark = banner.theme === "dark";
  const shell = dark
    ? "bg-ink text-paper"
    : "bg-ink-04 text-ink border border-ink-08";

  return (
    <aside
      data-ev-view="banner_view"
      data-ev-label={banner.id}
      data-ev-location={banner.placement}
      className={`overflow-hidden rounded-3xl ${shell}`}
    >
      {banner.image_url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={banner.image_url}
          alt={banner.image_alt ?? ""}
          loading="lazy"
          className="h-40 w-full object-cover"
        />
      )}

      <div className="p-7">
        {banner.eyebrow && (
          <p
            className={`text-[0.72rem] uppercase tracking-[0.16em] ${
              dark ? "text-white/40" : "text-ink-30"
            }`}
          >
            {banner.eyebrow}
          </p>
        )}

        <p className="mt-2.5 text-xl font-medium leading-snug tracking-[-0.02em]">
          {banner.title}
        </p>

        {banner.body && (
          <p
            className={`mt-2.5 max-w-[54ch] text-[0.95rem] leading-relaxed ${
              dark ? "text-white/60" : "text-ink-50"
            }`}
          >
            {banner.body}
          </p>
        )}

        {banner.cta_href && banner.cta_label && (
          <Link
            href={banner.cta_href}
            data-ev="banner_click"
            data-ev-label={banner.id}
            data-ev-location={banner.placement}
            className={`mt-6 inline-block rounded-full px-5 py-2.5 text-[0.85rem] font-medium transition-transform hover:scale-[1.03] active:scale-[0.98] ${
              dark ? "bg-paper text-ink" : "bg-ink text-paper"
            }`}
          >
            {banner.cta_label}
          </Link>
        )}
      </div>
    </aside>
  );
}
