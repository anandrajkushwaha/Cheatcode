import Link from "next/link";
import { NoticeForm } from "@/components/admin/govt/NoticeForm";
import { NOTICE_KINDS, type NoticeKind } from "@/lib/govt/types";
import { todayIn } from "@/lib/govt/lifecycle";

export const dynamic = "force-dynamic";

/**
 * A new notice.
 *
 * `?kind=result` is honoured so that posting six results in a row does not
 * mean picking "Results" six times — the panel's tabs carry the kind through.
 */
export default async function NewNotice({
  searchParams,
}: {
  searchParams: Promise<{ kind?: string }>;
}) {
  const sp = await searchParams;
  const kind = (NOTICE_KINDS as readonly string[]).includes(sp.kind ?? "")
    ? (sp.kind as NoticeKind)
    : undefined;

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/govt" className="text-[0.78rem] text-ink-30 underline underline-offset-2 hover:text-ink">
          ← Government jobs
        </Link>
        <h1 className="mt-2 text-[1.3rem] font-semibold tracking-[-0.03em]">Post a notice</h1>
      </div>
      {/* Today in India, worked out on the server: a laptop set to another
          timezone would otherwise default the date to yesterday. */}
      <NoticeForm defaultKind={kind} today={todayIn()} />
    </div>
  );
}
