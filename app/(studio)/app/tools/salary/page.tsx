import Link from "next/link";
import { SalaryCalculator } from "@/components/tools/SalaryCalculator";

export default function StudioSalaryPage() {
  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/app/tools"
          className="text-[0.8rem] text-ink-50 transition-colors hover:text-ink"
        >
          ← Free tools
        </Link>
        <h1 className="mt-3 text-[1.38rem] font-semibold tracking-[-0.03em]">
          In-hand salary calculator
        </h1>
        <p className="mt-2 max-w-[60ch] text-[0.87rem] leading-relaxed text-ink-50">
          What the CTC on your offer letter actually becomes each month, after
          PF, gratuity, professional tax and income tax.
        </p>
      </div>

      <div className="rounded-2xl border border-ink-08 bg-paper p-5 sm:p-6">
        <SalaryCalculator />
      </div>
    </div>
  );
}
