"use client";

import { useState } from "react";
import { AgentOverlay } from "@/components/app/AgentOverlay";

/**
 * "Talk this through with the agent."
 *
 * A report tells you what was weak. The question people actually have next is
 * "yes, but how do I say it" — and that is a conversation, not a document.
 * This is the one place on the report where the answer can keep going.
 *
 * It opens the same agent as the orb, with the question already in the box
 * and unsent. Nothing is spent until they press send, which matters because
 * a button that quietly bills you for pressing it is a button people learn
 * not to press.
 *
 * `requirePro` is not passed: this button only exists on a finished report,
 * and reaching one already means the interview was allowed.
 */
export function AskAgent({
  topic,
  weakest,
}: {
  topic: string;
  weakest: string | null;
}) {
  const [origin, setOrigin] = useState<{ x: number; y: number } | null>(null);

  const seed = weakest
    ? `I just did a mock interview for ${topic} and my ${weakest} came out weakest. Help me work out what to say instead.`
    : `I just did a mock interview for ${topic}. Help me work on the answers that came out weakest.`;

  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
          setOrigin({ x: r.left + r.width / 2, y: r.top + r.height / 2 });
        }}
        className="flex w-full items-center justify-center gap-2 rounded-full border border-ink-15 bg-paper px-5 py-2.5 text-[0.85rem] font-medium transition-colors hover:border-ink-30"
      >
        <ChatIcon />
        Talk it through with the agent
      </button>

      {origin && (
        <AgentOverlay origin={origin} onClose={() => setOrigin(null)} seed={seed} />
      )}
    </>
  );
}

function ChatIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden
      className="size-[15px]"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M20 12a8 8 0 0 1-11.6 7.1L4 20l.9-4.4A8 8 0 1 1 20 12Z" />
    </svg>
  );
}
