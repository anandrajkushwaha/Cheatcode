"use client";

import { useState } from "react";
import { AgentOrb } from "@/components/app/AgentOrb";
import { MicIcon, PlusIcon, SendIcon } from "@/components/studio/icons";

/**
 * The message box.
 *
 * Presentation only for now — it captures a draft and clears it. Wiring it to
 * the agent is a separate change, and doing it here would mean this component
 * knew about conversations, models and usage limits before the shell around
 * it was even settled.
 *
 * The orb beside it is the real one: the same component the rest of the app
 * puts in the corner, the same ai-orb.json, the same full-screen overlay when
 * pressed. It is placed inline rather than fixed because that is where the
 * design has it — and because two orbs on one screen, one in the corner and
 * one here, would be two ways into the same conversation.
 */
export function Composer({
  suggestions,
  onSubmit,
}: {
  suggestions: { label: string }[];
  onSubmit?: (text: string) => void;
}) {
  const [value, setValue] = useState("");

  function submit() {
    const text = value.trim();
    if (!text) return;
    onSubmit?.(text);
    setValue("");
  }

  return (
    <div className="w-full">
      {/* On a narrow screen these scroll sideways rather than stacking into
          three rows and eating the height the conversation needs. */}
      <div className="-mx-1 flex gap-2.5 overflow-x-auto px-1 pb-1 sm:flex-wrap sm:overflow-visible">
        {suggestions.map((s) => (
          <button
            key={s.label}
            type="button"
            onClick={() => setValue(s.label)}
            className="shrink-0 whitespace-nowrap rounded-full bg-paper/30 px-4 py-2.5 text-[0.95rem] font-medium text-studio-muted shadow-studio transition-colors hover:text-ink-70 sm:px-5 sm:py-3 sm:text-studio-chip"
          >
            {s.label}
          </button>
        ))}
      </div>

      <div className="mt-3 flex items-center gap-2 sm:gap-3">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
          className="flex min-w-0 flex-1 items-center gap-2 rounded-full border border-studio-edge bg-paper px-4 py-2.5 sm:gap-3 sm:px-5 sm:py-3"
        >
          <button
            type="button"
            aria-label="Add an attachment"
            className="shrink-0 text-ink-50 transition-colors hover:text-ink-70"
          >
            <PlusIcon className="size-5 sm:size-6" />
          </button>

          <input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="Type something here..."
            aria-label="Message"
            className="min-w-0 flex-1 bg-transparent text-[1rem] text-ink-70 outline-none placeholder:text-studio-faint sm:text-studio-chip"
          />

          <button
            type="button"
            aria-label="Speak instead"
            className="shrink-0 text-ink-50 transition-colors hover:text-ink-70"
          >
            <MicIcon className="size-5 sm:size-6" />
          </button>

          <button
            type="submit"
            aria-label="Send"
            disabled={!value.trim()}
            className="shrink-0 text-ink-70 transition-opacity disabled:opacity-30"
          >
            <SendIcon className="size-5 sm:size-6" />
          </button>
        </form>

        <AgentOrb placement="inline" />
      </div>
    </div>
  );
}
