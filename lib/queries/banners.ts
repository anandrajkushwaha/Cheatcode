import "server-only";
import { createPublicClient } from "@/lib/supabase/public";

export type LiveBanner = {
  id: string;
  placement: "in_article" | "sidebar" | "blog_list";
  eyebrow: string | null;
  title: string;
  body: string | null;
  cta_label: string | null;
  cta_href: string | null;
  image_url: string | null;
  image_alt: string | null;
  theme: "dark" | "light";
};

/**
 * The banners currently live for a slot.
 *
 * Read with the publishable key, so the row-level policy decides what is live —
 * active, started, not yet ended. Putting that logic in the database rather
 * than here means a banner cannot leak onto the site through a code path that
 * forgot to check the dates.
 */
export async function getBanners(placement: LiveBanner["placement"]): Promise<LiveBanner[]> {
  const supabase = createPublicClient();
  if (!supabase) return [];

  const { data } = await supabase
    .from("promo_banners")
    .select("id,placement,eyebrow,title,body,cta_label,cta_href,image_url,image_alt,theme")
    .eq("placement", placement)
    .order("sort_order")
    .limit(4);

  return (data ?? []) as LiveBanner[];
}

/**
 * One banner for a slot, chosen by the page it appears on.
 *
 * Rotating by a hash of the path rather than at random keeps a given article
 * showing the same banner on every visit. That matters for measurement: with
 * random rotation a banner's click rate is confounded by which articles it
 * happened to land on, and you can never tell a good banner from a lucky one.
 */
export async function pickBanner(
  placement: LiveBanner["placement"],
  key: string,
): Promise<LiveBanner | null> {
  const all = await getBanners(placement);
  if (all.length === 0) return null;

  let hash = 0;
  for (let i = 0; i < key.length; i++) hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
  return all[hash % all.length];
}
