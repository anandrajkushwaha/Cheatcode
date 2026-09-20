"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

/**
 * Which role are you interviewing for.
 *
 * Asked rather than inferred. The previous screen guessed from the job feed
 * and offered a graphic designer six software engineering roles, which is a
 * worse failure than a question — a wrong guess made in public reads as a
 * product that does not know you.
 *
 * Two modes, one component: a blocking card when nothing is set yet, and a
 * dialog behind the pencil once it is. The suggestions come from whatever the
 * profile and resume already know, so most people press one chip and never
 * type anything.
 */
export function RolePicker({
  current,
  suggestions,
  open: openProp = false,
  onClose,
}: {
  current: string | null;
  suggestions: string[];
  open?: boolean;
  onClose?: () => void;
}) {
  const router = useRouter();
  const [value, setValue] = useState(current ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const box = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (openProp) box.current?.focus();
  }, [openProp]);

  async function save(role: string) {
    const clean = role.trim();
    if (clean.length < 2) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/app/interview/role", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: clean }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!data.ok) {
        setError(data.error ?? "Could not save that.");
        setBusy(false);
        return;
      }
      onClose?.();
      router.refresh();
    } catch {
      setError("Could not reach the server.");
      setBusy(false);
    }
  }

  const form = (
    <>
      <div className="flex flex-wrap gap-2">
        {suggestions.map((s) => (
          <button
            key={s}
            type="button"
            disabled={busy}
            onClick={() => void save(s)}
            className="rounded-full border border-ink-15 bg-paper px-3.5 py-1.5 text-[0.82rem] transition-colors hover:border-ink hover:bg-ink hover:text-paper disabled:opacity-50"
          >
            {s}
          </button>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2.5">
        <input
          ref={box}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              void save(value);
            }
          }}
          placeholder={suggestions.length ? "Or type another role" : "e.g. Graphic Designer"}
          className="min-w-[220px] flex-1 rounded-xl border border-ink-15 bg-paper px-3.5 py-2.5 text-[0.88rem] outline-none transition-colors placeholder:text-ink-30 focus:border-ink-30"
        />
        <button
          type="button"
          disabled={busy || value.trim().length < 2}
          onClick={() => void save(value)}
          className="rounded-full bg-ink px-5 py-2.5 text-[0.85rem] font-medium text-paper transition-opacity hover:opacity-90 disabled:opacity-40"
        >
          {busy ? "Saving…" : "Continue"}
        </button>
      </div>

      {error && <p className="mt-3 text-[0.8rem] text-red-600">{error}</p>}
    </>
  );

  // Dialog mode — changing a role that is already set.
  if (openProp) {
    return (
      <div
        className="fixed inset-0 z-50 grid place-items-center bg-ink/30 px-4"
        onClick={() => onClose?.()}
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Change role"
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-[460px] rounded-2xl border border-ink-08 bg-paper p-6"
        >
          <p className="text-[1.05rem] font-semibold tracking-[-0.02em]">
            Which role are you preparing for?
          </p>
          <p className="mt-1.5 text-[0.84rem] leading-relaxed text-ink-50">
            Every question is written for this role.
          </p>
          <div className="mt-5">{form}</div>
        </div>
      </div>
    );
  }

  // First-run mode — nothing set yet, so this is the screen.
  return (
    <div className="rounded-2xl border border-ink-08 bg-paper p-7 sm:p-9">
      <p className="text-[1.25rem] font-semibold tracking-[-0.025em]">
        Which role are you preparing for?
      </p>
      <p className="mt-2 max-w-[52ch] text-[0.89rem] leading-relaxed text-ink-50">
        Every question is written for this role — so pick the one you are
        actually applying to, not the one on your last payslip. You can change
        it any time.
      </p>
      <div className="mt-6">{form}</div>
    </div>
  );
}
