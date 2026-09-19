"use client";

import { useState } from "react";
import { MicIcon, PlusIcon, SendIcon } from "@/components/studio/icons";

/**
 * The message box.
 *
 * Presentation only for now — it captures a draft and clears it. Wiring it to
 * the agent is a separate change, and doing it here would mean this component
 * knew about conversations, models and usage limits before the shell around
 * it was even settled.
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
      <div className="flex flex-wrap items-center gap-3">
        {suggestions.map((s) => (
          <button
            key={s.label}
            type="button"
            onClick={() => setValue(s.label)}
            className="rounded-full bg-paper/30 px-5 py-3 text-studio-chip font-medium text-studio-muted shadow-studio transition-colors hover:text-ink-70"
          >
            {s.label}
          </button>
        ))}
      </div>

      <div className="mt-4 flex items-center gap-3">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
          className="flex min-w-0 flex-1 items-center gap-3 rounded-full border border-studio-edge bg-paper px-5 py-3"
        >
          <button
            type="button"
            aria-label="Add an attachment"
            className="shrink-0 text-ink-50 transition-colors hover:text-ink-70"
          >
            <PlusIcon className="size-6" />
          </button>

          <input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="Type something here..."
            aria-label="Message"
            className="min-w-0 flex-1 bg-transparent text-studio-chip text-ink-70 outline-none placeholder:text-studio-faint"
          />

          <button
            type="button"
            aria-label="Speak instead"
            className="shrink-0 text-ink-50 transition-colors hover:text-ink-70"
          >
            <MicIcon className="size-6" />
          </button>

          <button
            type="submit"
            aria-label="Send"
            disabled={!value.trim()}
            className="shrink-0 text-ink-70 transition-opacity disabled:opacity-30"
          >
            <SendIcon className="size-6" />
          </button>
        </form>

        {/* The orb. A gradient rather than the design's bitmap, so it stays
            sharp at any size and costs no request. */}
        <span
          aria-hidden
          className="size-14 shrink-0 rounded-full bg-[radial-gradient(circle_at_30%_30%,#ffd9a0,#ff9d4d_45%,#f4703a)] shadow-studio"
        />
      </div>
    </div>
  );
}
