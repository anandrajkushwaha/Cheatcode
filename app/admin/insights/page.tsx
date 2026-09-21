import { getAllInsights } from "@/lib/insights/query";
import { InsightsManager } from "@/components/admin/InsightsManager";
import { currentAdmin } from "@/lib/admin/guard";

export const dynamic = "force-dynamic";

/**
 * Insights: the short news cards in the app's Insights tab.
 *
 * Written by a person here — a title, up to 70 words, and optionally an image
 * and a link to where the story came from. The image appears only when the
 * card is opened in the Insights tab; the home screen shows text alone.
 */
export default async function AdminInsights() {
  const [result, admin] = await Promise.all([getAllInsights(), currentAdmin()]);

  if (!result.ok) {
    return (
      <p className="rounded-xl border border-ink-15 px-4 py-3 text-[0.82rem] text-ink-50">
        {result.setup ? (
          <>
            Not set up yet — run <code>supabase/schemas/90_insights.sql</code> in the Supabase SQL
            editor (the same project the jobs live in).
          </>
        ) : (
          <>Could not load insights: {result.error}</>
        )}
      </p>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-[1.3rem] font-semibold tracking-[-0.03em]">Insights</h1>
        <p className="mt-2 max-w-[68ch] text-[0.85rem] leading-relaxed text-ink-50">
          Short news for the app's Insights tab — what is happening in hiring,
          pay and work rules, and what it means for someone looking for a job.
          Title, up to 70 words, and a source link if it came from a report.
        </p>
      </div>

      <InsightsManager items={result.data} canDelete={admin?.role === "owner"} />
    </div>
  );
}
