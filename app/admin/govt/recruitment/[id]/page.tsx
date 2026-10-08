import Link from "next/link";
import { notFound } from "next/navigation";
import { getExamDraft } from "@/lib/govt/admin";
import { ExamForm } from "@/components/admin/govt/ExamForm";

export const dynamic = "force-dynamic";

export default async function EditRecruitment({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const exam = await getExamDraft(id);
  if (!exam) notFound();

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/govt" className="text-[0.78rem] text-ink-30 underline underline-offset-2 hover:text-ink">
          ← Government jobs
        </Link>
        <h1 className="mt-2 text-[1.3rem] font-semibold tracking-[-0.03em]">
          {exam.organisation} — {exam.name}
        </h1>
        <p className="mt-1 text-[0.8rem] text-ink-30">
          <code>/government-jobs/{exam.slug}</code> · the address does not change when you edit the name.
        </p>
      </div>
      <ExamForm exam={exam} />
    </div>
  );
}
