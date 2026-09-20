import { getAllBanks } from "@/lib/interview/bank";
import { BankManager } from "@/components/admin/BankManager";

export const dynamic = "force-dynamic";

/**
 * The question bank.
 *
 * These pages exist to be found by somebody who has never heard of Cheatcode
 * and searched "graphic designer interview questions", so every one of them
 * ends in an invitation to take a mock interview. That is the whole funnel.
 */
export default async function AdminBank() {
  const result = await getAllBanks();

  if (!result.ok) {
    return (
      <p className="rounded-xl border border-ink-15 px-4 py-3 text-[0.82rem] text-ink-50">
        Not set up yet — run <code>supabase/schemas/{result.missing}</code> in
        the Supabase SQL editor.
      </p>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-[1.3rem] font-semibold tracking-[-0.03em]">Question bank</h1>
        <p className="mt-2 max-w-[68ch] text-[0.85rem] leading-relaxed text-ink-50">
          Public interview-question pages, one per role. Drafted by the model,
          published by you — read one before you publish it, because these are
          indexed and carry our name.
        </p>
      </div>

      <BankManager banks={result.data} />
    </div>
  );
}
