import { getReviewQueue } from "@/lib/app/resume-review";
import { ReviewQueue } from "@/components/admin/ReviewQueue";

export const dynamic = "force-dynamic";

/**
 * Pro members waiting for a human to read their resume.
 *
 * The only perk on the Pro card that a person has to deliver by hand, which
 * is exactly why it needs a screen: an unanswered one is somebody who paid
 * ₹99 and heard nothing.
 */
export default async function AdminResumeRequests() {
  const result = await getReviewQueue();

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
        <h1 className="text-[1.3rem] font-semibold tracking-[-0.03em]">Resume reviews</h1>
        <p className="mt-2 max-w-[70ch] text-[0.85rem] leading-relaxed text-ink-50">
          Read the resume, write them an email, mark it replied. Two working
          days is what the product promises them.
        </p>
      </div>

      <ReviewQueue items={result.data} />
    </div>
  );
}
