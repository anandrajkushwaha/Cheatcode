import { getGovtStatus } from "@/lib/govt/query";
import { GovtRunButton } from "@/components/admin/GovtRunButton";

export const dynamic = "force-dynamic";

/**
 * Government jobs, from the inside.
 *
 * This screen exists to answer one question the public page cannot: an empty
 * /government-jobs means "nothing ingested yet", "the migration was never
 * run", or "ingestion is paused on purpose", and all three look identical to
 * a visitor while meaning different things. Everything else here — what each
 * source last did, how many rows exist — is in service of the same thing:
 * being able to tell whether the feature is quiet, paused or broken.
 */
export default async function AdminGovt() {
  const status = await getGovtStatus();

  if (!status.ok) {
    return (
      <div className="space-y-5">
        <h1 className="text-[1.3rem] font-semibold tracking-[-0.03em]">Government jobs</h1>
        <div className="rounded-xl border border-ink-15 px-4 py-3.5 text-[0.85rem] leading-relaxed text-ink-50">
          {status.setup ? (
            <>
              Not set up yet — run <code>supabase/schemas/100_govt_notices.sql</code> in the Supabase
              SQL editor, in the same project the app accounts live in. Until that is done,{" "}
              <code>/government-jobs</code> will show its empty state to everybody.
            </>
          ) : (
            <>Could not read the government tables: {status.error}</>
          )}
        </div>
      </div>
    );
  }

  const live = status.sources.filter((s) => s.active).length;
  // Paused is a fact about the data, not a flag: when every board is off, no
  // run — scheduled or manual — can read or publish anything.
  const paused = live === 0;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-[1.3rem] font-semibold tracking-[-0.03em]">Government jobs</h1>
        <p className="mt-2 max-w-[68ch] text-[0.85rem] leading-relaxed text-ink-50">
          {paused ? (
            <>
              Ingestion is paused. Every board is switched off and the scheduled run has been
              removed, so nothing is being read and nothing new can be published until the
              publishing gate is trustworthy. Rows that were published by the earlier runs were
              moved to <code>retired</code> rather than deleted — they are off the public pages
              but still here to inspect.
            </>
          ) : (
            <>
              The recruitment boards we watch, and what each run found. A board whose page holds
              no recruitment notices writes &ldquo;empty&rdquo; and publishes nothing, so a wrong
              URL costs a quiet row here rather than bad data on a public page.
            </>
          )}
        </p>
      </div>

      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {[
          ["Sources on", `${live} of ${status.sources.length}`],
          ["Recruitments", status.exams],
          ["Notices", status.notices],
          ["Published", status.published],
          ["Reported errors", status.reports],
        ].map(([label, value]) => (
          <div key={String(label)} className="rounded-xl border border-ink-08 px-4 py-3">
            <dt className="text-[0.7rem] uppercase tracking-[0.12em] text-ink-30">{label}</dt>
            <dd className="mt-1 text-[1.15rem] font-semibold">{value}</dd>
          </div>
        ))}
      </dl>

      <GovtRunButton paused={paused} />

      {status.exams === 0 && !paused && (
        <p className="rounded-xl border border-dashed border-ink-15 px-4 py-3.5 text-[0.85rem] leading-relaxed text-ink-50">
          Tables are there and empty. Nothing has been ingested yet, which is why{" "}
          <code>/government-jobs</code> shows its empty state — that is the feature being quiet,
          not broken.
        </p>
      )}
      {paused && status.published === 0 && (
        <p className="rounded-xl border border-dashed border-ink-15 px-4 py-3.5 text-[0.85rem] leading-relaxed text-ink-50">
          Nothing is published, so <code>/government-jobs</code> shows its empty state to
          everybody. That is the pause working, not a fault.
        </p>
      )}

      <div className="overflow-x-auto rounded-xl border border-ink-08">
        <table className="w-full min-w-[46rem] text-left text-[0.84rem]">
          <thead className="border-b border-ink-08 text-[0.72rem] uppercase tracking-[0.1em] text-ink-30">
            <tr>
              <th className="px-4 py-2.5 font-medium">Board</th>
              <th className="px-4 py-2.5 font-medium">Notifications page</th>
              <th className="px-4 py-2.5 font-medium">On</th>
              <th className="px-4 py-2.5 font-medium">Last run</th>
              <th className="px-4 py-2.5 font-medium">Found</th>
            </tr>
          </thead>
          <tbody>
            {status.sources.map((s) => (
              <tr key={s.id} className="border-b border-ink-08 last:border-0 align-top">
                <td className="px-4 py-3">
                  <span className="font-medium">{s.organisation}</span>
                  <span className="block text-[0.76rem] text-ink-30">{s.name}</span>
                </td>
                <td className="max-w-[20rem] px-4 py-3">
                  {s.listUrl ? (
                    <a
                      href={s.listUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block truncate text-ink-50 underline underline-offset-2 hover:text-ink"
                    >
                      {s.listUrl}
                    </a>
                  ) : (
                    <span className="text-ink-30">not set</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <span className={s.active ? "text-[#1a7f37]" : "text-ink-30"}>
                    {s.active ? "on" : "off"}
                  </span>
                </td>
                <td className="px-4 py-3 text-ink-50">
                  {s.lastRunAt ? new Date(s.lastRunAt).toLocaleString("en-IN") : "never"}
                  {s.lastError && (
                    <span className="mt-1 block max-w-[22rem] text-[0.76rem] text-[#c0392b]">
                      {s.lastError}
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-ink-50">{s.lastCount}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
