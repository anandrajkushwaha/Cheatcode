import Link from "next/link";
import { getPanel } from "@/lib/govt/admin";
import { KIND_LABEL, NOTICE_KINDS, formatDate, type NoticeKind } from "@/lib/govt/types";
import { PublishAll, RowPublish } from "@/components/admin/govt/RowPublish";

export const dynamic = "force-dynamic";

/**
 * Where the government pages are written.
 *
 * The screen that used to be here was a monitor: ten boards, what each run
 * found, an error column. Useful for a week and then the wrong screen
 * entirely, because the job is no longer watching a scraper — it is posting
 * notices. So this is a posting screen, and the monitor moved to a page of
 * its own that nobody has to look at while it is switched off.
 *
 * One list, newest first, every kind and every status in it. Not six tabs:
 * the question somebody has on opening this is "did my last ten go up", and
 * that is answered by one list sorted by when it was posted, not by six.
 *
 * A job here is a title and a link, and nothing else is required. The title
 * on the public page IS the link — somebody taps it and lands on the board's
 * own page — so there is no page of ours in between to fill in. The
 * recruitment pages the code can still build are parked, deliberately, until
 * the simple thing is running.
 */
export default async function AdminGovt({
  searchParams,
}: {
  searchParams: Promise<{ kind?: string; status?: string }>;
}) {
  const sp = await searchParams;
  const kind = (NOTICE_KINDS as readonly string[]).includes(sp.kind ?? "")
    ? (sp.kind as NoticeKind)
    : null;
  const status = ["published", "draft", "withdrawn", "retired", "stale"].includes(sp.status ?? "")
    ? (sp.status as string)
    : null;

  const panel = await getPanel({ kind, status });

  if (!panel.ok) {
    return (
      <div className="space-y-5">
        <h1 className="text-[1.3rem] font-semibold tracking-[-0.03em]">Government jobs</h1>
        <div className="rounded-xl border border-ink-15 px-4 py-3.5 text-[0.85rem] leading-relaxed text-ink-50">
          <p>{panel.error}</p>
          {panel.detail && (
            <p className="mt-2 font-mono text-[0.72rem] text-ink-30">{panel.detail}</p>
          )}
          <p className="mt-3 text-[0.8rem]">
            To see what this database actually has, run this in the SQL editor:{" "}
            <code className="text-[0.76rem]">
              select table_name from information_schema.tables where table_schema=&apos;public&apos; and
              table_name like &apos;govt%&apos;;
            </code>
          </p>
        </div>
      </div>
    );
  }

  const liveTotal = NOTICE_KINDS.reduce((n, k) => n + panel.live[k], 0);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-[1.3rem] font-semibold tracking-[-0.03em]">Government jobs</h1>
          <p className="mt-2 max-w-[70ch] text-[0.85rem] leading-relaxed text-ink-50">
            Everything on <code>/government-jobs</code> is posted from here, and a job is two
            fields: the title as the board writes it, and the official link. Nothing is public
            until you press Publish — add a batch, read it back, put it up together.
          </p>
        </div>
        <Link
          href="/admin/govt/notice/new?kind=job"
          className="rounded-full bg-ink px-5 py-2.5 text-[0.85rem] font-medium text-paper transition-opacity hover:opacity-90"
        >
          Add a job
        </Link>
      </div>

      {panel.legacy && (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-[0.82rem] leading-relaxed text-amber-900">
          Posting works, but this database has not had{" "}
          <code>supabase/schemas/105_govt_manual_posting.sql</code> run, so nothing records who
          posted what. If you have just run it, the API is still serving a cached schema — run{" "}
          <code>notify pgrst, &apos;reload schema&apos;;</code> in the SQL editor.
        </p>
      )}

      {/* The six tabs, as they would look to a reader. A zero here is a tab
          that exists on the public site with nothing on it, which is the most
          useful number on this screen. */}
      <div className="flex flex-wrap gap-2">
        <Tab href="/admin/govt" label="All" count={liveTotal} on={!kind && !status} />
        {NOTICE_KINDS.map((k) => (
          <Tab
            key={k}
            href={`/admin/govt?kind=${k}`}
            label={KIND_LABEL[k]}
            count={panel.live[k]}
            on={kind === k}
          />
        ))}
        <Tab href="/admin/govt?status=draft" label="Drafts" count={panel.drafts} on={status === "draft"} />
        {panel.retired > 0 && (
          <Tab
            href="/admin/govt?status=retired"
            label="Withdrawn"
            count={panel.retired}
            on={status === "retired"}
          />
        )}
      </div>

      {panel.drafts > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-ink-08 bg-ink-04 px-4 py-3">
          <p className="text-[0.84rem] text-ink-50">
            {panel.drafts} saved and not public yet.
          </p>
          <PublishAll count={panel.drafts} />
        </div>
      )}

      <section className="space-y-3">
        <div className="flex items-baseline justify-between gap-4">
          <h2 className="text-[0.72rem] font-medium uppercase tracking-[0.16em] text-ink-30">
            Notices
          </h2>
          <span className="text-[0.75rem] text-ink-30">{panel.notices.length} shown</span>
        </div>

        {panel.notices.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-ink-15 px-4 py-6 text-[0.85rem] leading-relaxed text-ink-50">
            {kind || status
              ? "Nothing here with that filter."
              : "Nothing here yet. Add a job above — title, official link, done."}
          </p>
        ) : (
          <ul className="space-y-2">
            {panel.notices.map((n) => (
              <li
                key={n.id}
                className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2 rounded-2xl border border-ink-08 px-4 py-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2">
                    <span className="text-[0.7rem] uppercase tracking-[0.1em] text-ink-30">
                      {KIND_LABEL[n.kind]}
                    </span>
                    <StatusTag status={n.status} />
                    {!n.manual && (
                      <span className="rounded-full bg-ink-04 px-2 py-0.5 text-[0.66rem] text-ink-50">
                        from the monitor
                      </span>
                    )}
                  </p>
                  <p className="mt-1 text-[0.88rem] font-medium leading-snug">{n.title}</p>
                  <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.76rem] text-ink-30">
                    <span>{formatDate(n.publishedOn) ?? "no date"}</span>
                    {n.examSlug ? (
                      <Link
                        href={`/government-jobs/${n.examSlug}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="underline underline-offset-2 hover:text-ink"
                      >
                        {n.examName}
                      </Link>
                    ) : (
                      <span>not attached</span>
                    )}
                    <a
                      href={n.officialUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="max-w-[28ch] truncate underline underline-offset-2 hover:text-ink"
                    >
                      {hostOf(n.officialUrl)}
                    </a>
                    {n.postedBy && <span>by {n.postedBy}</span>}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <RowPublish id={n.id} status={n.status} />
                  <Link
                    href={`/admin/govt/notice/${n.id}`}
                    className="rounded-full border border-ink-15 px-3.5 py-1.5 text-[0.78rem] text-ink-50 transition-colors hover:border-ink-30 hover:text-ink"
                  >
                    Edit
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Last, small, and honest about itself. */}
      <p className="rounded-2xl border border-ink-08 px-4 py-3.5 text-[0.82rem] leading-relaxed text-ink-50">
        The automatic monitor is{" "}
        {panel.activeSources === 0 ? (
          <strong className="font-medium">switched off</strong>
        ) : (
          <strong className="font-medium">reading {panel.activeSources} board(s)</strong>
        )}
        .{" "}
        <Link href="/admin/govt/sources" className="underline underline-offset-2 hover:text-ink">
          See the boards
        </Link>
        .
      </p>
    </div>
  );
}

function Tab({
  href,
  label,
  count,
  on,
}: {
  href: string;
  label: string;
  count: number;
  on: boolean;
}) {
  return (
    <Link
      href={href}
      className={`rounded-full border px-3.5 py-1.5 text-[0.8rem] transition-colors ${
        on ? "border-ink bg-ink text-paper" : "border-ink-15 text-ink-50 hover:border-ink-30 hover:text-ink"
      }`}
    >
      {label} <span className={on ? "opacity-70" : "text-ink-30"}>{count}</span>
    </Link>
  );
}

/**
 * The row's state, in a word.
 *
 * Published is not tagged. Almost everything here is published, and a badge
 * on the normal case is a badge nobody reads — so the tag appears only when
 * the row is not what you would assume.
 */
function StatusTag({ status }: { status: string }) {
  if (status === "published") return null;

  const text =
    status === "draft"
      ? "draft"
      : status === "withdrawn" || status === "retired"
        ? "withdrawn"
        : status === "closed"
          ? "closed"
          : status;

  return (
    <span className="rounded-full bg-ink-04 px-2 py-0.5 text-[0.66rem] font-medium text-ink-50">
      {text}
    </span>
  );
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url.slice(0, 30);
  }
}
