import Link from "next/link";
import { getNotices } from "@/lib/govt/query";
import { KIND_LABEL, KIND_SLUG, NOTICE_KINDS, type NoticeKind } from "@/lib/govt/types";
import { NoticeRow } from "@/components/govt/bits";

/**
 * One kind of notice, in full.
 *
 * Six routes share this. They are six separate files rather than one dynamic
 * segment for two reasons: a dynamic `[kind]` would collide with `[slug]`,
 * which is the exam page sitting at the same level — and each kind wants its
 * own title and description written for what people actually search, which is
 * per-file content rather than a template.
 */
export async function KindScreen({
  kind,
  blurb,
}: {
  kind: NoticeKind;
  blurb: string;
}) {
  const notices = await getNotices(kind, 100);

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
          <p className="text-[0.95rem] font-medium">Nothing published yet</p>
          <p className="mx-auto mt-2 max-w-[48ch] text-[0.88rem] leading-relaxed text-ink-50">
            This page fills as the recruitment boards publish. Nothing is listed here before it
            exists on an official site.
          </p>
        </div>
      ) : (
        <ul className="mt-8 rounded-2xl border border-ink-08 bg-paper px-4 sm:px-5">
          {notices.map((n) => (
            <NoticeRow key={n.id} notice={n} />
          ))}
        </ul>
      )}

      <p className="mt-10 max-w-[70ch] text-[0.8rem] leading-relaxed text-ink-30">
        Cheatcode is not a government body. Every notice links to the official notification on the
        recruiting authority&apos;s own website, and that page is the one to rely on.
      </p>
    </div>
  );
}
