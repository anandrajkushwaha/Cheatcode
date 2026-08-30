import { getPublishLog } from "@/lib/queries/admin";

export default async function AdminLogs() {
  const log = await getPublishLog(200);

  return (
    <>
      <h1 className="text-2xl font-semibold tracking-[-0.03em]">Publish log</h1>
      <p className="mt-3 max-w-[64ch] text-[0.9rem] leading-relaxed text-ink-50">
        Every attempt by the scheduler, including the ones the quality gate rejected.
        A rejected slot is deliberately left empty rather than filled with a weak page.
      </p>

      {log.length === 0 ? (
        <p className="mt-8 text-[0.9rem] text-ink-50">
          No runs yet. This fills up once the scheduled tasks are switched on.
        </p>
      ) : (
        <div className="mt-8 overflow-x-auto">
          <table className="w-full min-w-[720px] text-[0.85rem]">
            <thead>
              <tr className="border-b border-ink-15 text-left text-[0.72rem] uppercase tracking-wider text-ink-30">
                <th className="pb-3 pr-4 font-medium">When</th>
                <th className="pb-3 pr-4 font-medium">Slot</th>
                <th className="pb-3 pr-4 font-medium">Result</th>
                <th className="pb-3 pr-4 font-medium">Detail</th>
                <th className="pb-3 text-right font-medium">Words</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-08">
              {log.map((l) => (
                <tr key={l.id as number}>
                  <td className="whitespace-nowrap py-3 pr-4 text-ink-50">
                    {new Date(l.created_at as string).toLocaleString("en-IN", {
                      timeZone: "Asia/Kolkata",
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                  </td>
                  <td className="py-3 pr-4 text-ink-30">{(l.slot as number) ?? "—"}</td>
                  <td className="py-3 pr-4">{l.ok ? "published" : "rejected"}</td>
                  <td className="max-w-[380px] py-3 pr-4 text-ink-50">
                    <span className="line-clamp-2">{(l.reason as string) ?? "—"}</span>
                  </td>
                  <td className="py-3 text-right text-ink-50">
                    {(l.word_count as number) ?? "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
