import { Empty, num } from "@/components/admin/ui";
import type { SessionRow } from "@/lib/admin/usage";
import { IST } from "@/lib/admin/range";

/**
 * One row per conversation, for looking at a single person.
 *
 * This used to be the whole dashboard. It is a better second screen than a
 * first one: a session is not a unit anybody makes decisions about, but once
 * you have picked a person out of the list, "what did each of their
 * conversations do" is exactly the next question.
 *
 * The columns that matter are the last two. Spend says the agent ran; a
 * résumé that was produced, shared and downloaded says it was worth running.
 */

const USD = (n: number) => (n === 0 ? "$0" : n < 0.01 ? `$${n.toFixed(4)}` : `$${n.toFixed(2)}`);

/** A recorded number, or an em dash for one we never recorded. */
const known = (value: number, metered: number): string => (metered > 0 ? num(value) : "—");
const knownUSD = (value: number, calls: number, metered: number): string =>
  calls === 0 || metered === 0 ? "—" : USD(value);

function ist(iso: string) {
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: IST,
  }).format(new Date(iso));
}

export function SessionTable({ rows }: { rows: SessionRow[] }) {
  if (!rows.length) return <Empty>No conversations in this window.</Empty>;

  return (
    <>
      <div className="-mx-2 hidden overflow-x-auto md:block">
        <table className="w-full min-w-[820px] text-left text-[0.8rem]">
          <thead>
            <tr className="text-[0.7rem] uppercase tracking-[0.1em] text-ink-30">
              <Th>Started</Th>
              <Th>Channel</Th>
              <Th right>Calls</Th>
              <Th right>In</Th>
              <Th right>Out</Th>
              <Th right>Cost</Th>
              <Th>Model</Th>
              <Th>Résumé</Th>
              <Th>Downloaded</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ink-08">
            {rows.map((s) => (
              <tr key={s.sessionId ?? s.startedAt} className="align-top">
                <Td>
                  <span className="whitespace-nowrap">{ist(s.startedAt)}</span>
                </Td>
                <Td>
                  <span className="text-ink-50">{s.channel ?? "—"}</span>
                </Td>
                <Td right>{num(s.calls)}</Td>
                <Td right>{known(s.inputTokens, s.metered)}</Td>
                <Td right>{known(s.outputTokens, s.metered)}</Td>
                <Td right>
                  {knownUSD(s.costUsd, s.calls, s.metered)}
                  {s.unpriced > 0 && <span className="text-ink-30"> +</span>}
                </Td>
                <Td>
                  <span className="block max-w-[16rem] truncate text-[0.72rem] text-ink-50">
                    {s.models.length ? s.models.join(", ") : "—"}
                  </span>
                </Td>
                <Td>
                  <ResumeCell row={s} />
                </Td>
                <Td>
                  <Downloaded row={s} />
                </Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul className="divide-y divide-ink-08 md:hidden">
        {rows.map((s) => (
          <li key={s.sessionId ?? s.startedAt} className="py-3">
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-[0.78rem]">{ist(s.startedAt)}</span>
              <span className="shrink-0 text-[0.85rem] font-medium tabular-nums">
                {knownUSD(s.costUsd, s.calls, s.metered)}
              </span>
            </div>
            <dl className="mt-2 grid grid-cols-3 gap-x-3 gap-y-1.5 text-[0.74rem]">
              <Cell k="Channel" v={s.channel ?? "—"} />
              <Cell k="Calls" v={num(s.calls)} />
              <Cell k="In" v={known(s.inputTokens, s.metered)} />
              <Cell k="Out" v={known(s.outputTokens, s.metered)} />
            </dl>
            <div className="mt-2 text-[0.72rem]">
              <ResumeCell row={s} />
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}

/**
 * The résumé this conversation produced, as a link where there is one.
 *
 * A share id that exists but is switched off is not a link — opening it 404s,
 * and an admin screen that hands you a dead link is worse than one that hands
 * you none.
 */
function ResumeCell({ row }: { row: SessionRow }) {
  if (!row.resume) return <span className="text-ink-30">—</span>;
  const { shareId, isPublic, title } = row.resume;
  if (shareId && isPublic) {
    return (
      <a
        href={`/r/${shareId}`}
        target="_blank"
        rel="noreferrer"
        className="block max-w-[14rem] truncate underline underline-offset-2"
      >
        {title}
      </a>
    );
  }
  return (
    <span className="block max-w-[14rem] truncate text-ink-50" title="Not shared publicly">
      {title}
    </span>
  );
}

function Downloaded({ row }: { row: SessionRow }) {
  if (!row.resume) return <span className="text-ink-30">—</span>;
  if (!row.resume.downloads) return <span className="text-ink-30">No</span>;
  return (
    <span className="whitespace-nowrap text-[0.74rem]">
      {num(row.resume.downloads)}×
      {row.resume.lastDownloadedAt ? ` · ${ist(row.resume.lastDownloadedAt)}` : ""}
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
