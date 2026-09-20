"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

/**
 * Which role, and how many years.
 *
 * Both asked in one place rather than inferred. The previous screen guessed
 * the role from the job feed and offered a graphic designer six software
 * engineering postings; the questions were also pitched at nobody in
 * particular, so a fresher was asked to describe a team they had led.
 *
 * Experience is the half people skip if you let them, so it is not optional
 * here — but it is one press, and it is pre-filled from the profile whenever
 * the profile already knows.
 */

const LEVELS = [
  { years: 0, label: "Fresher" },
  { years: 1, label: "1 yr" },
  { years: 2, label: "2 yrs" },
  { years: 4, label: "3–5 yrs" },
  { years: 7, label: "6–9 yrs" },
  { years: 12, label: "10+ yrs" },
];

export function RolePicker({
  current,
  currentYears,
  suggestions,
  open: openProp = false,
  onClose,
}: {
  current: string | null;
  currentYears: number | null;
  suggestions: string[];
  open?: boolean;
  onClose?: () => void;
}) {
  const router = useRouter();
  const [role, setRole] = useState(current ?? "");
  const [years, setYears] = useState<number | null>(currentYears);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const box = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (openProp) box.current?.focus();
  }, [openProp]);

  const ready = role.trim().length >= 2 && years !== null;

  async function save() {
    if (!ready) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/app/interview/role", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: role.trim(), years }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!data.ok) {
        setError(data.error ?? "Could not save that.");
        setBusy(false);
        return;
      }
      onClose?.();
      router.refresh();
      // Reset even on success. In dialog mode onClose unmounts this and it
      // does not matter; on the first-run screen there is no onClose, so
      // without this the button sat on "Saving…" for ever and the page
      // looked stuck even though the save had worked.
      setBusy(false);
    } catch {
      setError("Could not reach the server.");
      setBusy(false);
    }
  }

  const form = (
    <div className="space-y-6">
      <div>
        <p className="text-[0.8rem] font-medium text-ink-50">The role</p>

        {suggestions.length > 0 && (
          <div className="mt-2.5 flex flex-wrap gap-2">
            {suggestions.map((s) => (
              <button
                key={s}
                type="button"
                disabled={busy}
                onClick={() => setRole(s)}
                aria-pressed={role.trim().toLowerCase() === s.toLowerCase()}
                className={`rounded-full border px-3.5 py-1.5 text-[0.82rem] transition-colors disabled:opacity-50 ${
                  role.trim().toLowerCase() === s.toLowerCase()
                    ? "border-ink bg-ink text-paper"
                    : "border-ink-15 text-ink-50 hover:border-ink-30 hover:text-ink"
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        )}

        <input
          ref={box}
          value={role}
          onChange={(e) => setRole(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && ready) {
              e.preventDefault();
              void save();
            }
          }}
          placeholder={suggestions.length ? "Or type another role" : "e.g. Graphic Designer"}
          className="mt-3 w-full rounded-xl border border-ink-15 bg-paper px-3.5 py-2.5 text-[0.88rem] outline-none transition-colors placeholder:text-ink-30 focus:border-ink-30"
        />
      </div>

      <div>
        <p className="text-[0.8rem] font-medium text-ink-50">Your experience</p>
        <p className="mt-1 text-[0.75rem] leading-relaxed text-ink-30">
          A fresher and a team lead get asked completely different things — this
          is what decides which.
        </p>
        <div className="mt-2.5 flex flex-wrap gap-2">
          {LEVELS.map((l) => (
            <button
              key={l.years}
              type="button"
              disabled={busy}
              onClick={() => setYears(l.years)}
              aria-pressed={years === l.years}
              className={`rounded-full border px-3.5 py-1.5 text-[0.82rem] transition-colors disabled:opacity-50 ${
                years === l.years
                  ? "border-ink bg-ink text-paper"
                  : "border-ink-15 text-ink-50 hover:border-ink-30 hover:text-ink"
              }`}
            >
              {l.label}
            </button>
          ))}
        </div>
      </div>

      {error && <p className="text-[0.8rem] text-red-600">{error}</p>}

      <button
        type="button"
        disabled={busy || !ready}
        onClick={() => void save()}
        className="rounded-full bg-ink px-6 py-2.5 text-[0.86rem] font-medium text-paper transition-opacity hover:opacity-90 disabled:opacity-40"
      >
        {busy ? "Saving…" : current ? "Save" : "Continue"}
      </button>
    </div>
  );

  // Dialog mode — changing something already set.
  if (openProp) {
    return (
      <div
        className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-ink/30 px-4 py-8"
        onClick={() => onClose?.()}
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Change role and experience"
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-[480px] rounded-2xl border border-ink-08 bg-paper p-6"
        >
          <p className="text-[1.05rem] font-semibold tracking-[-0.02em]">
            Who are we interviewing today?
          </p>
          <p className="mt-1.5 text-[0.84rem] leading-relaxed text-ink-50">
            Every question is written for this role, at this level.
          </p>
          <div className="mt-6">{form}</div>
        </div>
      </div>
    );
  }

  // First run — nothing set, so this is the screen.
  return (
    <div className="rounded-2xl border border-ink-08 bg-paper p-7 sm:p-9">
      <p className="text-[1.25rem] font-semibold tracking-[-0.025em]">
        Who are we interviewing today?
      </p>
      <p className="mt-2 max-w-[54ch] text-[0.89rem] leading-relaxed text-ink-50">
        Every question is written for this role, at this level — so pick the job
        you are actually applying to, not the one on your last payslip. You can
        change both any time.
      </p>
      <div className="mt-7">{form}</div>
    </div>
  );
}
