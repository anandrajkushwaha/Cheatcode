"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

type Row = { id: number; role: string; slug: string; published: boolean; count: number };

/**
 * Drafting and publishing question-bank pages.
 *
 * Drafting takes a while — twenty questions and twenty answers is a long
 * generation — so the button says so and stays disabled rather than letting
 * somebody press it three times and pay for three drafts.
 *
 * Publish is deliberately a second, separate press, with the preview link
 * right next to it. Nothing about this screen lets you generate straight to
 * live, because a page nobody read is how a wrong answer ends up ranking
 * under our name.
 */
export function BankManager({ banks }: { banks: Row[] }) {
  const router = useRouter();
  const [role, setRole] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  async function send(payload: Record<string, unknown>, slow = false) {
    setBusy(true);
    setError(null);
    setNote(slow ? "Writing twenty questions and answers — this takes up to a minute." : null);
    try {
      const res = await fetch("/api/admin/bank", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string; count?: number };
      if (!data.ok) {
        setError(data.error ?? "That didn't work.");
        return false;
      }
      if (data.count) setNote(`Drafted ${data.count} questions. Read it, then publish.`);
      router.refresh();
      return true;
    } catch {
      setError("Could not reach the server.");
      return false;
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-8">
      <section className="rounded-2xl border border-ink-08 p-6">
        <h2 className="text-[0.72rem] font-medium uppercase tracking-[0.16em] text-ink-30">
          Draft a new role page
        </h2>
        <p className="mt-3 max-w-[64ch] text-[0.82rem] leading-relaxed text-ink-50">
          One page per role, twenty questions with answers. It is saved as a
          draft — nothing is public, and nothing goes in the sitemap, until you
          publish it.
        </p>

        <div className="mt-5 flex flex-wrap items-center gap-3">
          <input
            value={role}
            onChange={(e) => setRole(e.target.value)}
            placeholder="Graphic Designer"
            className="min-w-[240px] flex-1 rounded-xl border border-ink-15 px-3 py-2 text-[0.85rem] outline-none focus:border-ink-30"
          />
          <button
            type="button"
            disabled={busy || role.trim().length < 3}
            onClick={async () => {
              const ok = await send({ action: "draft", role: role.trim() }, true);
              if (ok) setRole("");
            }}
            className="rounded-full bg-ink px-5 py-2.5 text-[0.85rem] font-medium text-paper transition-opacity hover:opacity-90 disabled:opacity-40"
          >
            {busy ? "Writing…" : "Draft page"}
          </button>
        </div>

        {note && <p className="mt-3 text-[0.8rem] text-ink-50">{note}</p>}
        {error && (
          <p className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-[0.8rem] text-red-700">
            {error}
          </p>
        )}
      </section>

      <section>
        <div className="flex items-baseline justify-between gap-4">
          <h2 className="text-[0.72rem] font-medium uppercase tracking-[0.16em] text-ink-30">
            Pages
          </h2>
          <span className="text-[0.75rem] text-ink-30">
            {banks.filter((b) => b.published).length} live · {banks.length} total
          </span>
        </div>

        {banks.length === 0 ? (
          <p className="mt-5 text-[0.85rem] leading-relaxed text-ink-30">
            None yet. Draft one above — start with the roles your users
            actually have, which the People tab can tell you.
          </p>
        ) : (
          <ul className="mt-5 space-y-3">
            {banks.map((b) => (
              <li
                key={b.id}
                className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-ink-08 p-4"
              >
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-2 text-[0.88rem] font-semibold">
                    {b.role}
                    {!b.published && (
                      <span className="rounded-full bg-ink-04 px-2 py-0.5 text-[0.68rem] font-medium text-ink-50">
                        Draft
                      </span>
                    )}
                  </p>
                  <p className="text-[0.76rem] text-ink-30">
                    /interview-questions/{b.slug} · {b.count} questions
                  </p>
                </div>

                <div className="flex shrink-0 flex-wrap items-center gap-2">
                  {b.published && (
                    <Link
                      href={`/interview-questions/${b.slug}`}
                      target="_blank"
                      className="rounded-lg border border-ink-08 px-2.5 py-1.5 text-[0.75rem] text-ink-50 transition-colors hover:bg-ink-04 hover:text-ink"
                    >
                      View
                    </Link>
                  )}
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() =>
                      void send({ action: "publish", id: b.id, published: !b.published })
                    }
                    className="rounded-lg border border-ink-08 px-2.5 py-1.5 text-[0.75rem] text-ink-50 transition-colors hover:bg-ink-04 hover:text-ink disabled:opacity-40"
                  >
                    {b.published ? "Unpublish" : "Publish"}
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => {
                      if (!confirm(`Delete the ${b.role} page? This cannot be undone.`)) return;
                      void send({ action: "delete", id: b.id });
                    }}
                    className="rounded-lg border border-ink-08 px-2.5 py-1.5 text-[0.75rem] text-ink-30 transition-colors hover:border-red-200 hover:bg-red-50 hover:text-red-700 disabled:opacity-40"
                  >
                    Delete
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
