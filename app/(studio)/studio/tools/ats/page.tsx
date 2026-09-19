import Link from "next/link";
import { AtsChecker } from "@/components/tools/AtsChecker";

export default function StudioAtsPage() {
  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/studio/tools"
          className="text-[0.85rem] text-ink-50 transition-colors hover:text-ink"
        >
          ← Free tools
        </Link>
        <h1 className="mt-3 text-[1.5rem] font-semibold tracking-[-0.03em]">
          Resume ATS checker
        </h1>
        <p className="mt-2 max-w-[60ch] text-[0.92rem] leading-relaxed text-ink-50">
          Before a person reads your resume, software does. This reads it the
          same way and reports what came out — in your browser, nothing uploaded.
        </p>
      </div>

      <div className="rounded-2xl border border-ink-08 bg-paper p-5 sm:p-6">
        <AtsChecker />
      </div>
    </div>
  );
}
