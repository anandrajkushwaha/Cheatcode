import Link from "next/link";
import { DataTable } from "@/components/admin/DataTable";
import { Panel, Stat, Empty, num } from "@/components/admin/ui";
import { auditDesigns } from "@/lib/admin/design-audit";
import {
  getRecentDownloads,
  getResumeList,
  getResumeSignals,
  getResumeTotals,
  getTemplateRows,
  reachOf,
  type ResumeMode,
} from "@/lib/admin/resume";

export const dynamic = "force-dynamic";

/**
 * Résumés: what people build, and what they take away with them.
 *
 * The download is the only event on this screen that means the product
 * worked. A draft started is an intention; a draft downloaded is somebody
 * walking out with a file they will actually send to an employer. So it is
 * the number at the top and the sort order of the template table.
 *
 * ------------------------------------------------------------- two histories
 *
 * Every download figure here comes from one of two places and the screen says
 * which, because they disagree on purpose:
 *
 *   all-time  — summed from `resume_drafts.download_count`, a counter that has
 *               run since the builder shipped. Complete, and dateless.
 *   last 7/28 — counted from `account_events`, one row per download. Dated,
 *               and empty before the recorder shipped.
 *
 * Until the event table has a month in it the second set will look tiny next
 * to the first. Labelling them "all time" and "since tracking started" is what
 * stops that reading as a crash.
 */


function when(iso: string) {
  return new Date(iso).toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "Asia/Kolkata",
  });
}

const MODES: { id: ResumeMode; label: string; note: string }[] = [
  { id: "downloaded", label: "Downloaded", note: "Finished — somebody took the PDF away. Most recent download first." },
  { id: "building", label: "Still building", note: "Started and never downloaded. The list worth acting on." },
  { id: "all", label: "All", note: "Every résumé, newest first." },
];

export default async function AdminResume({
  searchParams,
}: {
  searchParams: Promise<{ show?: string; tpl?: string; audit?: string }>;
}) {
  const { show, tpl, audit: auditParam } = await searchParams;
  // Off by default. The audit reads every saved design, photos and all, to
  // compare it against a fresh seed — worth a few seconds when somebody asks
  // for it, not on every visit to this screen.
  const wantsAudit = auditParam === "1";
  const mode: ResumeMode = MODES.some((m) => m.id === show) ? (show as ResumeMode) : "downloaded";

  const [totals, templates, recent, signals, list, audit] = await Promise.all([
    getResumeTotals(),
    getTemplateRows(),
    getRecentDownloads(40),
    getResumeSignals(),
    getResumeList(mode, 200),
    wantsAudit ? auditDesigns() : Promise.resolve(null),
  ]);

  if (!totals.ok) {
    return (
      <p className="rounded-xl border border-ink-15 px-4 py-3 text-[0.82rem] text-ink-50">
        Résumé data cannot be read yet — run <code>supabase/schemas/{totals.missing}</code>.
      </p>
    );
  }

  const t = totals.data;
  const all = templates.ok ? templates.data : [];
  const downloaded = all.filter((r) => r.downloads > 0);
  const never = all.filter((r) => r.drafts === 0 && r.downloads === 0);

  /**
   * Sixty templates, and on most days fifty-eight of them are a row of zeroes.
   *
   * The count of untouched designs is worth knowing — it is the argument
   * against adding a sixty-first — but it is one sentence, not fifty-eight
   * rows. Printing them all buries the two that are actually being used and
   * makes the panel something you scroll past rather than read.
   *
   * So the table shows what has been touched, the sentence carries the rest,
   * and the sentence is a link for the day somebody wants the full list.
   */
  const showAllTemplates = tpl === "all";

  /**
   * Both controls on this page write to the query string, and neither may
   * erase the other. A plain `?tpl=all` link sends "Still building" back to
   * "Downloaded" on the way past — the list silently changes underneath
   * somebody who was only asking about templates, and nothing on screen says
   * it happened. So every link here is built from the whole state.
   */
  const href = (next: { show?: ResumeMode; tpl?: "all" | null }) => {
    const q = new URLSearchParams();
    const m = next.show ?? mode;
    const a = next.tpl === null ? false : (next.tpl ?? tpl) === "all";
    if (m !== "downloaded") q.set("show", m);
    if (a) q.set("tpl", "all");
    const s = q.toString();
    return s ? `/admin/resume?${s}` : "/admin/resume";
  };
  const touched = all.filter((r) => r.drafts > 0 || r.downloads > 0);
  const rows = showAllTemplates ? all : touched;

  return (
    <>
      <header className="mb-8">
        <h1 className="text-[1.3rem] font-semibold tracking-[-0.03em]">Résumés</h1>
        <p className="mt-1.5 text-[0.85rem] leading-relaxed text-ink-50">
          What people build, which templates they finish on, and what they download.
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label="Downloads"
          value={t.downloadsAllTime}
          hint="all time, from the per-draft counters"
        />
        <Stat
          label="Downloads · 7 days"
          value={t.downloadsLast7}
          hint={t.hasEvents ? "from event rows" : "no events recorded yet"}
        />
        <Stat label="Résumés built" value={t.drafts} hint={`${num(t.draftsLast7)} in the last 7 days`} />
        <Stat
          label="People building"
          value={t.builders}
          hint={`${num(t.draftsDownloaded)} drafts downloaded at least once`}
        />
      </div>

      {!t.hasEvents && (
        <p className="mt-4 rounded-xl border border-ink-15 px-4 py-3 text-[0.8rem] leading-relaxed text-ink-50">
          No dated download events yet. The all-time counters above cover every download
          ever taken; the 7- and 28-day figures only start once somebody downloads a
          résumé after this build is live. Run{" "}
          <code>supabase/schemas/63_resume_events.sql</code> for the index these queries
          use — everything works without it, just more slowly as the table grows.
        </p>
      )}

      <div className="mt-6 grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <Panel
          title="Templates"
          note={`Sorted by all-time downloads. ${num(downloaded.length)} of ${num(all.length)} templates have ever been downloaded.`}
        >
          {!templates.ok ? (
            <Empty>
              Cannot read templates — run <code>supabase/schemas/{templates.missing}</code>.
            </Empty>
          ) : !rows.length ? (
            <Empty>
              No template has been used yet.{" "}
              <Link href={href({ tpl: "all" })} className="underline underline-offset-4">
                Show all {num(all.length)}
              </Link>
              .
            </Empty>
          ) : (
            <DataTable
              name="templates"
              initialSort={{ key: "downloads", dir: "desc" }}
              rows={rows.map((r) => ({
                id: r.id,
                name: r.name,
                layout: r.layout,
                drafts: r.drafts,
                downloads: r.downloads,
                recent: r.recent,
                share: r.downloads ? Math.round(r.share * 1000) / 10 : null,
              }))}
              columns={[
                { key: "name", label: "Template", sub: "layout", filter: false },
                { key: "drafts", label: "Built", kind: "number" },
                { key: "downloads", label: "Downloads", kind: "number" },
                { key: "recent", label: "28d", kind: "number" },
                { key: "share", label: "Share %", kind: "number" },
              ]}
            />
          )}
          {never.length > 0 && (
            <p className="mt-4 text-[0.78rem] leading-relaxed text-ink-30">
              {num(never.length)} templates have never been chosen at all. Worth knowing
              before adding more.{" "}
              <Link
                href={href({ tpl: showAllTemplates ? null : "all" })}
                className="text-ink-50 underline underline-offset-4 hover:text-ink"
              >
                {showAllTemplates ? "Hide the unused ones" : "Show them"}
              </Link>
              .
            </p>
          )}
        </Panel>

        <div className="flex min-w-0 flex-col gap-4">
          <Panel
            title="Recent downloads"
            note={t.hasEvents ? undefined : "Starts filling once the recorder is live."}
          >
            {!recent.ok ? (
              <Empty>
                Cannot read events — run <code>supabase/schemas/{recent.missing}</code>.
              </Empty>
            ) : !recent.data.length ? (
              <Empty>Nothing yet.</Empty>
            ) : (
              <ul className="space-y-3">
                {recent.data.map((d, i) => (
                  <li key={`${d.at}-${i}`} className="min-w-0 border-t border-ink-08 pt-3 first:border-0 first:pt-0">
                    <div className="flex items-baseline justify-between gap-3">
                      <Link
                        href={`/admin/users/${d.userId}`}
                        className="truncate text-[0.84rem] underline-offset-4 hover:underline"
                      >
                        {d.who}
                      </Link>
                      <span className="shrink-0 text-[0.72rem] tabular-nums text-ink-30">
                        {when(d.at)}
                      </span>
                    </div>
                    <p className="mt-0.5 truncate text-[0.76rem] text-ink-50">
                      {d.email ?? d.phone ?? "no address"}
                    </p>
                    <p className="mt-0.5 truncate text-[0.76rem] text-ink-30">
                      {d.templateName ?? "unknown template"}
                      {d.title ? ` · ${d.title}` : ""}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel
            title="Canvas designs"
            note="Which saved designs hold work that exists nowhere else. A design the editor wrote and nobody touched can be re-derived; one that differs cannot, because the canvas never writes back to the structured résumé."
          >
            {!audit ? (
              <p className="text-[0.85rem] leading-relaxed text-ink-50">
                Reads every saved design and compares it with a fresh seed.
                Takes a few seconds.{" "}
                <Link href="?audit=1" className="font-medium text-ink underline">
                  Run the audit
                </Link>
              </p>
            ) : "missing" in audit ? (
              <Empty>Cannot read the drafts table.</Empty>
            ) : (
              <dl className="space-y-2.5 text-[0.84rem]">
                <Row label="Drafts with a saved design" value={num(audit.withDesign)} />
                <Row
                  label="Never touched"
                  value={num(audit.untouched)}
                  hint="identical to a fresh seed"
                />
                <Row
                  label="Only the measured heights moved"
                  value={num(audit.heightDriftOnly)}
                  hint="the renderer wrote those, not the person — safe to drop"
                />
                <Row
                  label="Words changed only"
                  value={num(audit.textOnly)}
                  hint="same boxes, different text"
                />
                <Row
                  label="Moved, resized or restyled"
                  value={num(audit.edited)}
                  hint="real canvas work"
                />
                <Row
                  label="Holding text the résumé has lost"
                  value={num(audit.textAhead)}
                  hint="must be harvested, not re-seeded"
                />
                <Row
                  label="Clipped by the page edge today"
                  value={num(audit.clipped)}
                  hint="content past 297mm"
                />
                <Row label="With a photo" value={num(audit.withPhoto)} />
                <Row
                  label="Still mostly where the seeder put it"
                  value={num(audit.mostlyInPlace)}
                  hint="80%+ of boxes unmoved — harvests by index"
                />
                <Row
                  label="Heavily rearranged"
                  value={num(audit.heavilyRearranged)}
                  hint="under half unmoved — needs a parse"
                />
                <Row
                  label="Median boxes unmoved"
                  value={`${audit.medianMatch}%`}
                />
              </dl>
            )}
          </Panel>

          <Panel title="Other résumé signals" note="Already recorded by the product — all of history, not just since today.">
            {!signals.ok ? (
              <Empty>
                Cannot read — run <code>supabase/schemas/{signals.missing}</code>.
              </Empty>
            ) : (
              <dl className="space-y-2.5 text-[0.84rem]">
                <Row label="Résumés uploaded (ATS scans)" value={num(signals.data.uploads)} hint={`${num(signals.data.uploadsLast7)} in 7 days`} />
                <Row
                  label="Average ATS score"
                  value={signals.data.avgScore === null ? "—" : signals.data.avgScore.toFixed(1)}
                  hint={`${num(signals.data.scored)} scored`}
                />
                <Row label="Opened in the design editor" value={num(signals.data.designed)} hint={`of ${num(t.drafts)} drafts`} />
                <Row label="Shared with a public link" value={num(signals.data.shared)} />
                {signals.data.otherEvents.map((e) => (
                  <Row key={e.kind} label={e.kind} value={num(e.count)} />
                ))}
              </dl>
            )}
          </Panel>
        </div>
      </div>

      <div className="mt-4 rounded-[1.25rem] bg-paper p-6">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h2 className="text-[0.72rem] font-medium uppercase tracking-[0.16em] text-ink-30">
            Who built what
          </h2>
          {list.ok && list.data.length > 0 && (
            <p className="text-[0.75rem] text-ink-30">
              {(() => {
                const r = reachOf(list.data);
                return `${num(r.withEmail)} with an email · ${num(r.phoneOnly)} phone only${
                  r.neither ? ` · ${num(r.neither)} neither` : ""
                }`;
              })()}
            </p>
          )}
        </div>

        {/*
          Two lists rather than one long one. "Every résumé ever" is a table
          with no question attached; these are the two questions actually worth
          asking, and the one that is not chosen is one click away rather than
          a hundred rows down.
        */}
        <div className="mt-4 flex flex-wrap items-center gap-1.5">
          {MODES.map((m) => (
            <Link
              key={m.id}
              href={href({ show: m.id })}
              className={`rounded-lg px-3 py-1.5 text-[0.8rem] transition-colors ${
                m.id === mode
                  ? "bg-ink text-paper"
                  : "text-ink-50 hover:bg-ink-04 hover:text-ink"
              }`}
            >
              {m.label}
            </Link>
          ))}
          <p className="ml-1 text-[0.76rem] text-ink-30">
            {MODES.find((m) => m.id === mode)!.note}
          </p>
        </div>

        <div className="mt-5">
          {!list.ok ? (
            <Empty>
              Cannot read résumés — run <code>supabase/schemas/{list.missing}</code>.
            </Empty>
          ) : !list.data.length ? (
            <Empty>
              {mode === "downloaded"
                ? "Nobody has downloaded a résumé yet."
                : mode === "building"
                  ? "Nothing half-finished — every résumé started has been downloaded."
                  : "Nobody has started one yet."}
            </Empty>
          ) : (
            <DataTable
              name={`resumes-${mode}`}
              initialSort={{ key: "started", dir: "desc" }}
              rows={list.data.map((r) => ({
                id: r.id,
                email: r.email ?? (r.phone ? `${r.phone} · phone` : "no address"),
                href: `/admin/users/${r.userId}`,
                name: r.name,
                title: r.title,
                shared: r.isPublic ? "shared publicly" : null,
                template: r.templateName,
                downloads: r.downloads,
                started: r.createdAt,
                ...(mode !== "building" ? { last: r.lastDownloadedAt } : {}),
              }))}
              columns={[
                { key: "email", label: "Email", href: "href", max: "max-w-[15rem]", filter: false },
                { key: "name", label: "Name", max: "max-w-[10rem]", filter: false },
                { key: "title", label: "Résumé", sub: "shared", max: "max-w-[12rem]", filter: false },
                { key: "template", label: "Template", max: "max-w-[12rem]" },
                { key: "downloads", label: "Downloads", kind: "number" },
                { key: "started", label: "Started", kind: "date" },
                ...(mode !== "building" ? [{ key: "last", label: "Last download", kind: "date" as const }] : []),
              ]}
            />
          )}
        </div>

        {list.ok && list.data.length >= 200 && (
          <p className="mt-4 text-[0.78rem] text-ink-30">
            Showing 200. There are more.
          </p>
        )}
      </div>
    </>
  );
}

function Row({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-t border-ink-08 pt-2.5 first:border-0 first:pt-0">
      <dt className="min-w-0 text-ink-50">
        <span className="text-ink">{label}</span>
        {hint && <span className="ml-2 text-[0.72rem] text-ink-30">{hint}</span>}
      </dt>
      <dd className="shrink-0 font-medium tabular-nums">{value}</dd>
    </div>
  );
}
