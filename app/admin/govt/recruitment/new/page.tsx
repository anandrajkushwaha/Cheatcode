import Link from "next/link";
import { ExamForm } from "@/components/admin/govt/ExamForm";

export const dynamic = "force-dynamic";

export default function NewRecruitment() {
  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/govt" className="text-[0.78rem] text-ink-30 underline underline-offset-2 hover:text-ink">
          ← Government jobs
        </Link>
        <h1 className="mt-2 text-[1.3rem] font-semibold tracking-[-0.03em]">New recruitment</h1>
        <p className="mt-2 max-w-[70ch] text-[0.85rem] leading-relaxed text-ink-50">
          This becomes a public page at its own address, and that address never changes afterwards —
          so the organisation and the name are worth getting right before saving.
        </p>
      </div>
      <ExamForm />
    </div>
  );
}
