import Link from "next/link";
import { getAdminQueue } from "@/lib/queries/admin";

const FILTERS = ["pending", "claimed", "done", "failed"] as const;

export default async function AdminQueue({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;
  const active = FILTERS.includes(status as never) ? status! : null;
  const rows = await getAdminQueue(active, 300);

  return (
    <>
      <h1 className="text-2xl font-semibold tracking-[-0.03em]">Content queue</h1>
      <p className="mt-3 max-w-[64ch] text-[0.9rem] leading-relaxed text-ink-50">
        This is the editorial calendar. Every 4 hours a scheduled session claims the
        highest-priority pending row for its slot, researches it, writes it, and publishes it.
      </p>

      <div className="mt-7 flex flex-wrap gap-2">
        <Link
          href="/admin/queue"
          className={`rounded-full px-4 py-1.5 text-[0.8rem] ${
            !active ? "bg-ink text-paper" : "border border-ink-15 text-ink-50"
          }`}
        >
          All
        </Link>
        {FILTERS.map((f) => (
          <Link
            key={f}
            href={`/admin/queue?status=${f}`}
            className={`rounded-full px-4 py-1.5 text-[0.8rem] capitalize ${
              active === f ? "bg-ink text-paper" : "border border-ink-15 text-ink-50"
            }`}
          >
            {f}
          </Link>
        ))}
      </div>

      <div className="mt-8 overflow-x-auto">
        <table className="w-full min-w-[820px] text-[0.85rem]">
          <thead>
            <tr className="border-b border-ink-15 text-left text-[0.72rem] uppercase tracking-wider text-ink-30">
              <th className="pb-3 pr-4 font-medium">Keyword</th>
              <th className="pb-3 pr-4 font-medium">Topic</th>
              <th className="pb-3 pr-4 font-medium">Type</th>
              <th className="pb-3 pr-4 font-medium">Slot</th>
              <th className="pb-3 pr-4 font-medium">Est. volume</th>
              <th className="pb-3 pr-4 font-medium">Status</th>
              <th className="pb-3 font-medium">Tries</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ink-08">
            {rows.map((r) => (
              <tr key={r.id as number}>
                <td className="py-3 pr-4">{r.focus_keyword as string}</td>
                <td className="py-3 pr-4 text-ink-50">{r.category_slug as string}</td>
                <td className="py-3 pr-4 text-ink-30">{r.post_type as string}</td>
                <td className="py-3 pr-4 text-ink-30">{r.slot as number}</td>
                <td className="py-3 pr-4 text-ink-50">{(r.est_volume_in as string) ?? "—"}</td>
                <td className="py-3 pr-4">
                  <span
                    className={`rounded-full px-2.5 py-1 text-[0.72rem] ${
                      r.status === "done"
                        ? "bg-ink text-paper"
                        : r.status === "pending"
                          ? "border border-ink-15 text-ink-50"
                          : "border border-ink-30 text-ink"
                    }`}
                  >
                    {r.status as string}
                  </span>
                </td>
                <td className="py-3 text-ink-30">{r.attempts as number}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && <p className="mt-6 text-[0.9rem] text-ink-50">Nothing here.</p>}
      </div>
    </>
  );
}
