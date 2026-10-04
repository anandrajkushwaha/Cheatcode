"use client";

import { useEffect, useRef, useState } from "react";

/**
 * The form controls the builder is made of.
 *
 * Two rules from the PRD live in here rather than in every section that uses
 * them. Validation runs on blur, never on keystroke, because a red message
 * that appears while somebody is halfway through typing their email is noise
 * about a mistake they have not finished making. And no box is ever empty of
 * help: every field carries either an example or a hint, so nobody is left
 * looking at a blank textarea wondering what belongs in it.
 */

const BASE =
  "w-full rounded-xl border border-ink-15 bg-paper px-3.5 py-2.5 text-[16px] outline-none transition-colors placeholder:text-ink-30 focus:border-ink-50 sm:text-[0.92rem]";

export function Label({ children, hint }: { children: React.ReactNode; hint?: string }) {
  return (
    <div className="mb-1.5 flex items-baseline justify-between gap-3">
      <span className="text-[0.82rem] font-medium text-ink">{children}</span>
      {hint && <span className="text-[0.74rem] text-ink-30">{hint}</span>}
    </div>
  );
}

export function Text({
  label,
  value,
  onChange,
  placeholder,
  hint,
  type = "text",
  validate,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  hint?: string;
  type?: string;
  /** Returns a message, or null when the value is fine. Run on blur only. */
  validate?: (v: string) => string | null;
}) {
  const [error, setError] = useState<string | null>(null);

  return (
    <div>
      <Label hint={hint}>{label}</Label>
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(e) => {
          onChange(e.target.value);
          if (error) setError(null);
        }}
        onBlur={(e) => setError(validate ? validate(e.target.value) : null)}
        aria-invalid={error ? true : undefined}
        className={`${BASE} ${error ? "border-[#c0392b]" : ""}`}
      />
      {error && <p className="mt-1 text-[0.76rem] text-[#c0392b]">{error}</p>}
    </div>
  );
}

export function Area({
  label,
  value,
  onChange,
  placeholder,
  hint,
  rows = 4,
  /** The PRD's character guidance: a target, not a limit. */
  target,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  hint?: string;
  rows?: number;
  target?: number;
}) {
  const n = value.trim().length;
  return (
    <div>
      <Label hint={hint}>{label}</Label>
      <textarea
        value={value}
        rows={rows}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className={`${BASE} resize-y leading-relaxed`}
      />
      {target && (
        <p className="mt-1 text-[0.74rem] text-ink-30">
          {n < target
            ? `${target - n} more characters for a recruiter-length answer`
            : "Good length"}
        </p>
      )}
    </div>
  );
}

/**
 * Chips, for skills.
 *
 * Comma and Enter both commit, because people type lists both ways, and a
 * duplicate is swallowed rather than refused — being told off for typing
 * "React" twice is not worth a message.
 */
export function Chips({
  label,
  values,
  onChange,
  placeholder,
  suggestions = [],
}: {
  label: string;
  values: string[];
  onChange: (v: string[]) => void;
  placeholder?: string;
  suggestions?: string[];
}) {
  const [draft, setDraft] = useState("");
  const add = (raw: string) => {
    const v = raw.trim().replace(/,$/, "");
    if (!v) return;
    if (!values.some((x) => x.toLowerCase() === v.toLowerCase())) onChange([...values, v]);
    setDraft("");
  };
  const open = suggestions.filter(
    (s) => !values.some((v) => v.toLowerCase() === s.toLowerCase()),
  );

  return (
    <div>
      <Label>{label}</Label>
      <div className="flex flex-wrap gap-1.5 rounded-xl border border-ink-15 bg-paper p-2">
        {values.map((v, i) => (
          <span
            key={`${v}-${i}`}
            className="inline-flex items-center gap-1.5 rounded-lg bg-ink-04 px-2.5 py-1 text-[0.82rem]"
          >
            {v}
            <button
              type="button"
              aria-label={`Remove ${v}`}
              onClick={() => onChange(values.filter((_, j) => j !== i))}
              className="text-ink-30 transition-colors hover:text-ink"
            >
              ×
            </button>
          </span>
        ))}
        <input
          value={draft}
          placeholder={values.length ? "" : placeholder}
          onChange={(e) => {
            if (e.target.value.endsWith(",")) add(e.target.value);
            else setDraft(e.target.value);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add(draft);
            } else if (e.key === "Backspace" && !draft && values.length) {
              onChange(values.slice(0, -1));
            }
          }}
          onBlur={() => add(draft)}
          className="min-w-[8rem] flex-1 bg-transparent px-1 py-1 text-[16px] outline-none sm:text-[0.92rem]"
        />
      </div>
      {open.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {open.slice(0, 10).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => add(s)}
              className="rounded-lg border border-dashed border-ink-15 px-2.5 py-1 text-[0.8rem] text-ink-50 transition-colors hover:border-ink-30 hover:text-ink"
            >
              + {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * The bullet editor — the one place people give up.
 *
 * So it does three things a plain textarea does not: it counts towards a
 * length a recruiter actually reads, it offers lines drawn from a curated
 * list for the role rather than from a model (free, instant, and it cannot
 * invent a number somebody did not achieve), and it never makes you find a
 * delete control for an empty line — an emptied bullet removes itself.
 */
export function Bullets({
  values,
  onChange,
  suggestions = [],
}: {
  values: string[];
  onChange: (v: string[]) => void;
  suggestions?: string[];
}) {
  const set = (i: number, v: string) => onChange(values.map((x, j) => (j === i ? v : x)));
  const open = suggestions.filter((s) => !values.includes(s));

  return (
    <div className="space-y-2">
      {values.map((v, i) => (
        <div key={i} className="flex items-start gap-2">
          <span aria-hidden="true" className="pt-3 text-ink-30">
            •
          </span>
          <div className="min-w-0 flex-1">
            <textarea
              value={v}
              rows={2}
              placeholder="What you did, and what changed because of it"
              onChange={(e) => set(i, e.target.value)}
              onBlur={() => {
                if (!v.trim()) onChange(values.filter((_, j) => j !== i));
              }}
              className={`${BASE} resize-y leading-relaxed`}
            />
            {v.trim().length > 0 && v.trim().length < 60 && (
              <p className="mt-1 text-[0.74rem] text-ink-30">
                Recruiter tip: {60 - v.trim().length} more characters tends to read as a result
                rather than a duty
              </p>
            )}
          </div>
          <button
            type="button"
            aria-label="Remove bullet"
            onClick={() => onChange(values.filter((_, j) => j !== i))}
            className="pt-2.5 text-ink-30 transition-colors hover:text-ink"
          >
            ×
          </button>
        </div>
      ))}

      <button
        type="button"
        onClick={() => onChange([...values, ""])}
        className="text-[0.84rem] font-medium text-ink underline underline-offset-2"
      >
        + Add bullet
      </button>

      {open.length > 0 && (
        <div className="rounded-xl border border-dashed border-ink-15 p-3">
          <p className="text-[0.76rem] text-ink-30">Common lines for this role — tap to use</p>
          <div className="mt-2 space-y-1.5">
            {open.slice(0, 4).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => onChange([...values.filter((v) => v.trim()), s])}
                className="block w-full text-left text-[0.82rem] leading-relaxed text-ink-70 transition-colors hover:text-ink"
              >
                + {s}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/** Up and down rather than drag: the PRD asks for reorder that works on a phone. */
export function Move({
  onUp,
  onDown,
  onDuplicate,
  onRemove,
  first,
  last,
}: {
  onUp: () => void;
  onDown: () => void;
  onDuplicate: () => void;
  onRemove: () => void;
  first: boolean;
  last: boolean;
}) {
  const btn =
    "grid size-7 place-items-center rounded-lg border border-ink-15 text-ink-50 transition-colors hover:border-ink hover:text-ink disabled:opacity-30";
  return (
    <div className="flex items-center gap-1.5">
      <button type="button" aria-label="Move up" onClick={onUp} disabled={first} className={btn}>
        ↑
      </button>
      <button type="button" aria-label="Move down" onClick={onDown} disabled={last} className={btn}>
        ↓
      </button>
      <button type="button" aria-label="Duplicate" onClick={onDuplicate} className={btn}>
        ⧉
      </button>
      <button type="button" aria-label="Remove" onClick={onRemove} className={btn}>
        ×
      </button>
    </div>
  );
}

/** Focus the first invalid or empty field when a section opens on mobile. */
export function useScrollIntoView(active: boolean) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (active && ref.current && window.matchMedia("(max-width: 1023px)").matches) {
      ref.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [active]);
  return ref;
}

export const isEmail = (v: string) =>
  !v || /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim()) ? null : "That email looks incomplete.";

export const isPhone = (v: string) =>
  !v || v.replace(/\D/g, "").length >= 10 ? null : "An Indian mobile number is 10 digits.";
