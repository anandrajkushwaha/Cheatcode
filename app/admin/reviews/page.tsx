import { getAllReviews } from "@/lib/studio/reviews";
import { ReviewsManager } from "@/components/admin/ReviewsManager";

export const dynamic = "force-dynamic";

/**
 * Testimonials.
 *
 * Everything on this screen exists so that adding a quote to the Pro page is
 * a two-minute job rather than a code change — which is the only version of
 * "we should put some testimonials up" that ever actually happens.
 */
export default async function AdminReviews() {
  const result = await getAllReviews();

  if (!result.ok) {
    return (
      <p className="rounded-xl border border-ink-15 px-4 py-3 text-[0.82rem] text-ink-50">
        Not set up yet — run <code>supabase/schemas/{result.missing}</code> in
        the Supabase SQL editor.
      </p>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-[1.3rem] font-semibold tracking-[-0.03em]">Reviews</h1>
        <p className="mt-2 max-w-[68ch] text-[0.85rem] leading-relaxed text-ink-50">
          What appears in the testimonial carousel on the Pro page, in this
          order. Publish only what the person has agreed to — these are their
          name and words on a page that sells something.
        </p>
      </div>

      <ReviewsManager reviews={result.data} />
    </div>
  );
}
