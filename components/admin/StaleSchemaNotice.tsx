/**
 * Shown when the deployed SQL functions are older than this code.
 *
 * This exists because of a real failure: the app shipped before the migration
 * was run, the summary functions returned an older shape, and the dashboard
 * quietly printed NaN. The reader had no way to know the cause. Silence about
 * a known-wrong state is worse than an ugly banner.
 */
export function StaleSchemaNotice({ stale }: { stale: boolean }) {
  if (!stale) return null;

  return (
    <div className="mt-6 rounded-2xl border border-ink-30 p-5">
      <p className="text-[0.9rem] font-medium">These numbers are incomplete</p>
      <p className="mt-2 max-w-[70ch] text-[0.85rem] leading-relaxed text-ink-50">
        The database is still running an older version of the reporting functions, so several
        panels have nothing to read and are showing zero rather than the truth. Run{" "}
        <code className="font-mono text-ink">supabase/schemas/10_dashboard.sql</code> — and then{" "}
        <code className="font-mono text-ink">11_authoring.sql</code> — in the Supabase SQL editor
        and reload this page.
      </p>
    </div>
  );
}
