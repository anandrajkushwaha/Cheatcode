"use client";

import { useState } from "react";
import { AgentOverlay } from "@/components/app/AgentOverlay";

/**
 * Past conversations, each with a way back into it.
 *
 * Continuing opens the same full-screen agent the orb opens, with the old
 * turns already on screen and the old conversation id adopted — so the next
 * message lands in the same row rather than starting a second thread that
 * looks identical in this list.
 *
 * The messages are fetched on the press, not with the page. Thirty
 * conversations of history would be a large payload sent to everybody who
 * merely wanted to see what they had asked last week.
 */

type Turn = { role: "user" | "model"; text: string; spoken?: boolean };

export type Conversation = {
  id: string;
  title: string | null;
  createdAt: string;
  channel: string | null;
};

const WHEN = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "short",
  hour: "numeric",
  minute: "2-digit",
  timeZone: "Asia/Kolkata",
});

export function AgentHistory({ conversations }: { conversations: Conversation[] }) {
  const [open, setOpen] = useState<{
    origin: { x: number; y: number };
    conversationId: string;
    turns: Turn[];
  } | null>(null);
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function resume(id: string, target: HTMLElement) {
    setLoading(id);
    setError(null);
    try {
      const res = await fetch(`/api/app/agent/conversation?id=${id}`);
      const data = (await res.json()) as {
        ok?: boolean;
        turns?: Turn[];
        error?: string;
      };
      if (!data.ok || !data.turns) {
        setError(data.error ?? "Could not open that conversation.");
        return;
      }
      const r = target.getBoundingClientRect();
      setOpen({
        origin: { x: r.left + r.width / 2, y: r.top + r.height / 2 },
        conversationId: id,
        turns: data.turns,
      });
    } catch {
      setError("Could not reach the server.");
    } finally {
      setLoading(null);
    }
  }

  return (
    <>
      {error && (
        <p className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-[0.82rem] text-red-700">
          {error}
        </p>
      )}

      <ul className="space-y-2.5">
        {conversations.map((c) => (
          <li key={c.id}>
            <button
              type="button"
              onClick={(e) => void resume(c.id, e.currentTarget)}
              disabled={loading !== null}
              className="flex w-full flex-wrap items-center justify-between gap-3 rounded-2xl border border-ink-08 bg-paper px-5 py-3.5 text-left transition-colors hover:border-ink-30 disabled:opacity-60"
            >
              <span className="min-w-0">
                <span className="block truncate text-[0.89rem] font-medium">
                  {c.title?.trim() || "Untitled conversation"}
                </span>
                <span className="block text-[0.75rem] text-ink-30">
                  {WHEN.format(new Date(c.createdAt))}
                  {c.channel === "voice" ? " · started as a call" : ""}
                </span>
              </span>
              <span className="shrink-0 text-[0.8rem] font-medium text-ink-50">
                {loading === c.id ? "Opening…" : "Continue →"}
              </span>
            </button>
          </li>
        ))}
      </ul>

      {open && (
        <AgentOverlay
          origin={open.origin}
          onClose={() => setOpen(null)}
          resume={{ conversationId: open.conversationId, turns: open.turns }}
        />
      )}
    </>
  );
}
