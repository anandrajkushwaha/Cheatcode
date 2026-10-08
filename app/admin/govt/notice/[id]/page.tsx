import Link from "next/link";
import { notFound } from "next/navigation";
import { getPanelNotice } from "@/lib/govt/admin";
import { NoticeForm } from "@/components/admin/govt/NoticeForm";
import { todayIn } from "@/lib/govt/lifecycle";

export const dynamic = "force-dynamic";

export default async function EditNotice({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const notice = await getPanelNotice(id);
  if (!notice) notFound();

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/govt" className="text-[0.78rem] text-ink-30 underline underline-offset-2 hover:text-ink">
          ← Government jobs
        </Link>
        <h1 className="mt-2 text-[1.3rem] font-semibold tracking-[-0.03em]">Edit notice</h1>
      </div>
      <NoticeForm notice={notice} today={todayIn()} />
    </div>
  );
}
