"use client";

import { useState } from "react";

/**
 * The small, boring parts of the government-jobs forms.
 *
 * Extracted not to save typing but to make one promise hold across both
 * forms: a label, its hint and its input stay together, and a hint is part
 * of the field rather than a paragraph above the section. Most of what makes
 * this panel usable is the hints — "as the notification writes it", "leave
 * blank if the notice does not say" — and they only work next to the box.
 */

export function Field({
  label,
  hint,
  children,
  wide = false,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <label className={`block ${wide ? "sm:col-span-2" : ""}`}>
      <span className="block text-[0.72rem] font-medium uppercase tracking-[0.14em] text-ink-30">
        {label}
      </span>
      {hint && <span className="mt-1 block text-[0.76rem] leading-relaxed text-ink-30">{hint}</span>}
      <span className="mt-2 block">{children}</span>
    </label>
  );
}

const BOX =
  "w-full rounded-xl border border-ink-15 bg-paper px-3 py-2 text-[0.85rem] outline-none transition-colors focus:border-ink-30 disabled:opacity-50";

export function Text(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={BOX} />;
}

export function Area(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={`${BOX} min-h-[88px] resize-y leading-relaxed`} />;
}

export function Select({
  options,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement> & {
  options: { value: string; label: string }[];
}) {
  return (
    <select {...props} className={BOX}>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

/**
 * A closed list, as buttons.
 *
 * Checkboxes for eight qualifications and thirty-six states would be a wall;
 * a multi-select listbox on a phone is worse. Buttons that look pressed are
 * the one shape that works at both sizes, and because the list is closed the
 * value can never be a typo that matches no filter.
 */
export function Chips({
  options,
  value,
  onChange,
  columns = false,
}: {
  options: { value: string; label: string }[];
  value: string[];
  onChange: (next: string[]) => void;
  columns?: boolean;
}) {
  const toggle = (v: string) =>
    onChange(value.includes(v) ? value.filter((x) => x !== v) : [...value, v]);

  return (
    <span className={`flex flex-wrap gap-1.5 ${columns ? "max-h-[11rem] overflow-y-auto" : ""}`}>
      {options.map((o) => {
        const on = value.includes(o.value);
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => toggle(o.value)}
            aria-pressed={on}
            className={`rounded-full border px-3 py-1.5 text-[0.78rem] transition-colors ${
              on
                ? "border-ink bg-ink text-paper"
                : "border-ink-15 text-ink-50 hover:border-ink-30 hover:text-ink"
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </span>
  );
}

export function Group({
  title,
  note,
  children,
}: {
  title: string;
  note?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-ink-08 p-5 sm:p-6">
      <h2 className="text-[0.72rem] font-medium uppercase tracking-[0.16em] text-ink-30">{title}</h2>
      {note && <p className="mt-2 max-w-[70ch] text-[0.8rem] leading-relaxed text-ink-50">{note}</p>}
      <div className="mt-5 grid gap-5 sm:grid-cols-2">{children}</div>
    </section>
  );
}

export function Problem({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-[0.82rem] leading-relaxed text-red-700">
      {children}
    </p>
  );
}

export const BUTTON =
  "rounded-full bg-ink px-5 py-2.5 text-[0.85rem] font-medium text-paper transition-opacity hover:opacity-90 disabled:opacity-40";

export const BUTTON_QUIET =
  "rounded-full border border-ink-15 px-4 py-2.5 text-[0.85rem] font-medium text-ink-50 transition-colors hover:border-ink-30 hover:text-ink disabled:opacity-40";

/**
 * One way to talk to the admin API.
 *
 * Returns the error as a string rather than throwing, because every failure
 * on these screens has the same correct outcome: the form stays exactly as it
 * was, with a sentence above the button saying what to fix. Nothing is
 * cleared, nothing is navigated — losing a half-typed notification to a
 * validation message is how people stop using a tool.
 */
export function usePost(url: string) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function post<T = Record<string, unknown>>(
    payload: Record<string, unknown>,
  ): Promise<(T & { ok: true }) | null> {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string } & T;
      if (!data.ok) {
        setError(data.error ?? "That didn't save.");
        return null;
      }
      return data as T & { ok: true };
    } catch {
      setError("Could not reach the server. Nothing was saved — try again.");
      return null;
    } finally {
      setBusy(false);
    }
  }

  return { busy, error, setError, post };
}
