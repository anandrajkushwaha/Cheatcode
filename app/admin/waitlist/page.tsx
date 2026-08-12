import { getWaitlist } from "@/lib/queries/admin";

export default async function AdminWaitlist() {
  const rows = await getWaitlist(500);

  return (
    <>
      <div className="flex items-baseline justify-between gap-4">
        <h1 className="text-2xl font-semibold tracking-[-0.03em]">Waitlist</h1>
        <p className="text-[0.85rem] text-ink-30">{rows.length} signups</p>
      </div>

      {rows.length === 0 ? (
        <p className="mt-8 text-[0.9rem] text-ink-50">No signups yet.</p>
      ) : (
        <table className="mt-8 w-full text-[0.85rem]">
          <thead>
            <tr className="border-b border-ink-15 text-left text-[0.72rem] uppercase tracking-wider text-ink-30">
              <th className="pb-3 pr-4 font-medium">Email</th>
              <th className="pb-3 pr-4 font-medium">Source</th>
              <th className="pb-3 font-medium">Joined</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ink-08">
            {rows.map((r) => (
              <tr key={r.id as string}>
                <td className="py-3 pr-4">{r.email as string}</td>
                <td className="py-3 pr-4 text-ink-50">{r.source as string}</td>
                <td className="whitespace-nowrap py-3 text-ink-50">
                  {new Date(r.created_at as string).toLocaleString("en-IN", {
                    timeZone: "Asia/Kolkata",
                    dateStyle: "medium",
                    timeStyle: "short",
                  })}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}
