"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ResumeDocument } from "@/components/app/ResumeDocument";
import type { Resume } from "@/lib/app/resume-schema";

/**
 * The resume, beside the conversation.
 *
 * The point of this panel is that somebody can watch their resume being
 * written while they talk. Everything the agent saves lands here within a
 * second of it being said, which does two things at once: it proves the
 * conversation is going somewhere, and it catches a misheard company name
 * while they still remember saying it.
 *
 * It is opened by a tool result — never by the model emitting markup — so the
 * agent can ask for this panel and nothing else. `revision` bumps on every
 * save, which is the refetch signal; without it the panel would show a
 * document one sentence out of date, which is worse than showing none.
 */

type Draft = { content: Resume; ats_score: number | null } | null;

export function ResumePanel({
  open,
  revision,
  onClose,
}: {
  open: boolean;
  revision: number;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState<Draft>(null);
  const [state, setState] = useState<"idle" | "loading" | "error">("idle");

  const load = useCallback(async () => {
    setState("loading");
    try {
      const res = await fetch("/api/app/resume/draft");
      const json = (await res.json()) as { ok?: boolean; draft?: Draft };
      if (!json.ok) throw new Error("no");
      setDraft(json.draft ?? null);
      setState("idle");
    } catch {
      setState("error");
    }
  }, []);

  useEffect(() => {
    if (open) void load();
  }, [open, revision, load]);

  // Escape closes it, because it covers the conversation on a phone and a
  // panel you cannot dismiss with the keyboard is a trap.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const empty = !draft || (!draft.content.full_name && !draft.content.roles.length);

  return (
    <aside
      className="cc-fade-in fixed inset-y-0 right-0 z-[61] flex w-full max-w-[520px] flex-col border-l border-ink-08 bg-paper shadow-[-24px_0_60px_-30px_rgba(0,0,0,0.35)]"
      aria-label="Your resume"
    >
      <header className="flex shrink-0 items-center justify-between gap-4 border-b border-ink-08 px-5 py-3.5">
        <div className="min-w-0">
          <p className="text-[0.72rem] uppercase tracking-[0.16em] text-ink-30">Your resume</p>
          <p className="mt-0.5 text-[0.88rem]">
            {draft?.ats_score !== null && draft?.ats_score !== undefined ? (
              <>
                Scoring <span className="font-semibold tabular-nums">{draft.ats_score}</span> out of
                100
              </>
            ) : (
              "Being written as you talk"
            )}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <Link
            href="/app/resume/builder"
            className="text-[0.8rem] text-ink-30 underline-offset-4 hover:text-ink hover:underline"
          >
            Edit
          </Link>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close the resume"
            className="grid h-8 w-8 place-items-center rounded-full text-ink-30 transition-colors hover:bg-ink-04 hover:text-ink"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
              <path
                d="M1.5 1.5l11 11M12.5 1.5l-11 11"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-auto bg-ink-04 p-4">
        {state === "error" ? (
          <p className="px-2 py-6 text-[0.88rem] leading-relaxed text-ink-50">
            Couldn&apos;t load it just now.{" "}
            <button
              type="button"
              onClick={() => void load()}
              className="underline underline-offset-4 hover:text-ink"
            >
              Try again
            </button>
          </p>
        ) : empty ? (
          <p className="px-2 py-6 text-[0.88rem] leading-relaxed text-ink-50">
            Nothing written down yet. Tell the agent what you do and it will start here — you can
            watch it fill in.
          </p>
        ) : (
          // The document is 210mm wide and this panel is not, so it is scaled
          // down rather than reflowed: what you see is the page that prints,
          // and a preview that reflows is a preview of a different document.
          <div className="rd-panel origin-top">
            <ResumeDocument content={draft!.content} />
          </div>
        )}
      </div>
    </aside>
  );
}
