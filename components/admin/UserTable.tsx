import Link from "next/link";
import { Empty, num } from "@/components/admin/ui";
import type { UserRow } from "@/lib/admin/usage";
import { IST } from "@/lib/admin/range";

/**
 * Who is using the product, and what each of them costs.
 *
 * This replaced a session table as the top-level view, and the reason is that
 * a session is not a unit anybody makes decisions about. "This conversation
 * cost eleven rupees" is trivia; "this person has had nine conversations, cost
 * ₹140, and never downloaded anything" is a decision — about pricing, about
 * limits, about whether the product is working for them.
 *
 * Sorted by cost, because the top of this list is the entire reason to look
 * at it.
 *
 * ------------------------------------------------------------- the dashes
 *
 * Every number here can legitimately be "we did not record that", and those
 * are printed as an em dash rather than zero throughout. A zero is a
 * measurement; nobody investigates one.
 */

const USD = (n: number) => (n === 0 ? "$0" : n < 0.01 ? `$${n.toFixed(4)}` : `$${n.toFixed(2)}`);
const INR_PER_USD = 88;

const money = (usd: number, metered: number) => {
  if (metered === 0) return "—";
  const inr = Math.round(usd * INR_PER_USD);
  return inr >= 1 ? `₹${num(inr)}` : USD(usd);
};

function ago(iso: string): string {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (mins < 60) return `${Math.max(1, mins)}m ago`;
  if (mins < 60 * 24) return `${Math.round(mins / 60)}h ago`;
  const days = Math.round(mins / (60 * 24));
  if (days < 30) return `${days}d ago`;
  return new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", timeZone: IST }).format(
    new Date(iso),
  );
}

export function UserTable({ users }: { users: UserRow[] }) {
  if (!users.length) return <Empty>Nobody used the agent in this window.</Empty>;

  return (
    <>
      {/* Desktop: one row per person. */}
      <div className="-mx-2 hidden overflow-x-auto md:block">
        <table className="w-full min-w-[920px] text-left text-[0.8rem]">
          <thead>
            <tr className="text-[0.7rem] uppercase tracking-[0.1em] text-ink-30">
              <Th>Person</Th>
              <Th right>Cost</Th>
              <Th right>Calls</Th>
              <Th right>Chats</Th>
              <Th right>Voice</Th>
              <Th right>In</Th>
              <Th right>Out</Th>
              <Th>Used for</Th>
              <Th right>Résumés</Th>
              <Th right>Last seen</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ink-08">
            {users.map((u) => (
              <tr key={u.userId ?? "none"} className="align-top">
                <Td>
                  <Person row={u} />
                </Td>
                <Td right>
                  <span className="font-medium">{money(u.costUsd, u.metered)}</span>
                  {u.unpriced > 0 && (
                    <span className="text-ink-30" title={`${u.unpriced} calls had no rate`}>
                      {" "}
                      +
                    </span>
                  )}
                </Td>
                <Td right>{num(u.calls)}</Td>
                <Td right>{num(u.sessions)}</Td>
                <Td right>{u.voiceSeconds > 0 ? `${Math.round(u.voiceSeconds / 60)}m` : "—"}</Td>
                <Td right>{u.metered ? num(u.inputTokens) : "—"}</Td>
                <Td right>{u.metered ? num(u.outputTokens) : "—"}</Td>
                <Td>
                  <Features row={u} />
                </Td>
                <Td right>
                  <Outcome row={u} />
                </Td>
                <Td right>
                  <span className="whitespace-nowrap text-ink-50">{ago(u.lastSeen)}</span>
                </Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Phone: the same rows as cards. Ten columns squeezed onto a phone is
          not a table, it is a puzzle. */}
      <ul className="divide-y divide-ink-08 md:hidden">
        {users.map((u) => (
          <li key={u.userId ?? "none"} className="py-3">
            <div className="flex items-baseline justify-between gap-3">
              <Person row={u} />
              <span className="shrink-0 text-[0.85rem] font-medium tabular-nums">
                {money(u.costUsd, u.metered)}
              </span>
            </div>
            <dl className="mt-2 grid grid-cols-3 gap-x-3 gap-y-1.5 text-[0.74rem]">
              <Cell k="Calls" v={num(u.calls)} />
              <Cell k="Chats" v={num(u.sessions)} />
              <Cell k="Voice" v={u.voiceSeconds > 0 ? `${Math.round(u.voiceSeconds / 60)}m` : "—"} />
              <Cell k="In" v={u.metered ? num(u.inputTokens) : "—"} />
              <Cell k="Out" v={u.metered ? num(u.outputTokens) : "—"} />
              <Cell k="Last seen" v={ago(u.lastSeen)} />
            </dl>
            <div className="mt-2 text-[0.72rem] text-ink-30">
              <Features row={u} />
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}

/**
 * Who it was, and a way in.
 *
 * The id sits under the name either way — it is what you paste into a query
 * when you need to go and look, and an email alone is not enough to find a
 * row. Spend with no user attached keeps a row of its own rather than being
 * dropped, so the column still adds up to the total.
 */
function Person({ row }: { row: UserRow }) {
  if (!row.userId) {
    return (
      <span className="min-w-0">
        <span className="block text-[0.8rem] text-ink-50">Not signed in</span>
        <span className="block text-[0.68rem] text-ink-30">
          scheduled jobs and anonymous paths
        </span>
      </span>
    );
  }

  return (
    <span className="min-w-0">
      <Link
        href={`/admin/users/${row.userId}`}
        className="block truncate text-[0.8rem] underline-offset-2 hover:underline"
      >
        {row.name || row.email || "Unnamed"}
      </Link>
      <span className="block truncate text-[0.68rem] text-ink-30">
        {row.email && row.name ? `${row.email} · ` : ""}
        {row.plan === "pro" ? "Pro" : "Free"}
      </span>
    </span>
  );
}

/** What they actually did, not just how much of it. */
function Features({ row }: { row: UserRow }) {
  if (!row.features.length) return <span className="text-ink-30">—</span>;
  return (
    <span className="text-[0.72rem] text-ink-50">
      {row.features
        .slice(0, 3)
        .map((f) => `${f.label} ${f.calls}`)
        .join(" · ")}
      {row.features.length > 3 && ` +${row.features.length - 3}`}
    </span>
  );
}

/**
 * Did any of it produce something.
 *
 * The point of the whole dashboard in one column: spend says the agent ran, a
 * downloaded résumé says it was worth running.
 */
function Outcome({ row }: { row: UserRow }) {
  if (!row.resumes) return <span className="text-ink-30">—</span>;
  return (
    <span className="whitespace-nowrap">
      {num(row.resumes)}
      {row.downloads > 0 && (
        <span className="text-ink-50" title={`${row.downloads} downloads`}>
          {" "}
          ↓{num(row.downloads)}
        </span>
      )}
    </span>
  );
}

function Th({ children, right }: { children: React.ReactNode; right?: boolean }) {
  return <th className={`px-2 pb-2 font-medium ${right ? "text-right" : ""}`}>{children}</th>;
}

function Td({ children, right }: { children: React.ReactNode; right?: boolean }) {
  return <td className={`px-2 py-2.5 ${right ? "text-right tabular-nums" : ""}`}>{children}</td>;
}

function Cell({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <dt className="text-ink-30">{k}</dt>
      <dd className="tabular-nums">{v}</dd>
    </div>
  );
}
