import Link from "next/link";
import { getNoticesResult } from "@/lib/govt/query";
import { KIND_LABEL, KIND_SLUG, NOTICE_KINDS, type NoticeKind } from "@/lib/govt/types";
import { NoticeRow } from "@/components/govt/bits";
import { Pager, PER_PAGE } from "@/components/govt/Pager";

/**
 * One kind of notice, in full.
 *
 * Six routes share this. They are six separate files rather than one dynamic
 * segment for two reasons: a dynamic `[kind]` would collide with `[slug]`,
 * which is the exam page sitting at the same level — and each kind wants its
 * own title and description written for what people actually search, which is
 * per-file content rather than a template.
 *
 * Twenty to a page, numbered. The hub shows the newest ten of each kind and
 * sends people here for the rest, so this is the page that has to stay
 * usable when a kind holds four hundred notices — which it will, since
 * nothing is ever removed from it, only closed.
 */
export async function KindScreen({
  kind,
  blurb,
  page = 1,
}: {
  kind: NoticeKind;
  blurb: string;
  page?: number;
}) {
  const { notices, total, error } = await getNoticesResult(kind, PER_PAGE, page - 1);
  const pages = Math.max(1, Math.ceil(total / PER_PAGE));
  const first = (page - 1) * PER_PAGE + 1;

  return (
    <div className="container-page pb-20 pt-8 sm:pb-28 sm:pt-10">
      <nav className="mb-5 text-[0.8rem] text-ink-30">
        <Link href="/government-jobs" className="transition-colors hover:text-ink">
          Government jobs
        </Link>
        <span className="px-1.5">/</span>
        <span>{KIND_LABEL[kind]}</span>
      </nav>

      <header className="max-w-[62ch]">
        <h1 className="text-[1.6rem] font-semibold tracking-[-0.035em] sm:text-[2rem]">
          {KIND_LABEL[kind]}
        </h1>
        <p className="mt-2.5 text-[0.95rem] leading-relaxed text-ink-50">{blurb}</p>
      </header>

      {/* The other five, so somebody who landed on the wrong one from Google
          can get to the right one without going back to the hub. */}
      <nav className="mt-6 flex flex-wrap gap-2">
        {NOTICE_KINDS.filter((k) => k !== kind).map((k) => (
          <Link
            key={k}
            href={`/government-jobs/${KIND_SLUG[k]}`}
            className="rounded-full border border-ink-15 px-3.5 py-1.5 text-[0.82rem] text-ink-50 transition-colors hover:border-ink hover:text-ink"
          >
            {KIND_LABEL[k]}
          </Link>
        ))}
      </nav>

      {notices.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-dashed border-ink-15 p-8 text-center">
          <p className="text-[0.95rem] font-medium">
            {error ? "Not available right now" : "Nothing published yet"}
          </p>
          <p className="mx-auto mt-2 max-w-[48ch] text-[0.88rem] leading-relaxed text-ink-50">
            {error
              ? "We could not load notices just now. Please try again shortly."
              : "This page fills as the recruitment boards publish. Nothing is listed here before it exists on an official site."}
          </p>
        </div>
      ) : (
        <>
          <ul className="mt-8 rounded-2xl border border-ink-08 bg-paper px-4 sm:px-5">
            {notices.map((n) => (
              <NoticeRow key={n.id} notice={n} />
            ))}
          </ul>

          {/* Said in full rather than as "page 2 of 7": the useful fact is how
              many there are altogether, and it is the only place on the site
              that says so. */}
          <p className="mt-3 text-center text-[0.78rem] text-ink-30">
            {total <= PER_PAGE
              ? `${total} listed`
              : `${first}–${first + notices.length - 1} of ${total}`}
          </p>

          <Pager base={`/government-jobs/${KIND_SLUG[kind]}`} page={page} pages={pages} />
        </>
      )}

      <p className="mt-10 max-w-[70ch] text-[0.8rem] leading-relaxed text-ink-30">
        Cheatcode is not a government body. Every notice links to the official notification on the
        recruiting authority&apos;s own website, and that page is the one to rely on.
      </p>
    </div>
  );
}
