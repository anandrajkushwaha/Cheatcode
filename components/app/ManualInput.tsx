"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { fieldValue, patchFromFields, type FieldSpec, type Resume } from "@/lib/app/resume-schema";

/**
 * The things nobody should have to say out loud.
 *
 * Reading an email address to a voice agent and hearing it back wrong is where
 * people give up on talking to software. So the agent can put a box on screen
 * instead — it names fields, the server resolves them against the resume
 * schema, and this renders whatever came back.
 *
 * Two decisions worth stating.
 *
 * **The call keeps running.** This is a panel over a conversation, not a
 * different screen. Somebody can type their email while still talking, and the
 * agent is told what arrived rather than asking again.
 *
 * **The boxes arrive filled in.** Somebody correcting a misheard email needs
 * to see what is there; an empty box asking for something we already have
 * reads as the software forgetting. Blanking a box is how you delete a value,
 * so that has to work too.
 */

export function ManualInput({
  fields,
  reason,
  onSubmit,
  onDismiss,
}: {
  fields: FieldSpec[];
  reason?: string;
  /** Save these and tell the agent. Resolves when it has landed. */
  onSubmit: (patch: Partial<Resume>, labels: string[]) => Promise<void>;
  onDismiss: () => void;
}) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [current, setCurrent] = useState<Resume | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const first = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);

  // Pre-fill from what is already saved, then focus the first box. Focusing
  // after the fetch rather than on mount: focusing an input and then replacing
  // its value under the cursor is how you lose what somebody already typed.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/app/resume/draft");
        const json = (await res.json()) as { ok?: boolean; draft?: { content: Resume } | null };
        if (cancelled || !json.ok || !json.draft) return;
        setCurrent(json.draft.content);
        const filled: Record<string, string> = {};
        for (const f of fields) filled[f.name] = fieldValue(f.name, json.draft.content);
        setValues(filled);
      } catch {
        /* An empty form is still a usable one. */
      } finally {
        if (!cancelled) first.current?.focus();
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [fields]);

  const submit = useCallback(async () => {
    if (busy) return;

    const missing = fields.filter((f) => f.required && !values[f.name]?.trim());
    if (missing.length) {
      setError(`${missing.map((f) => f.label).join(" and ")} still needed.`);
      return;
    }

    setBusy(true);
    setError(null);
    try {
      // The form's shape and the document's shape differ on purpose — one box
      // called "LinkedIn" is a better question than a table of labels and
      // urls — and the schema owns that translation.
      const patch = patchFromFields(values, current ?? ({} as Resume));
      const touched = fields.filter((f) => values[f.name]?.trim()).map((f) => f.label);
      await onSubmit(patch, touched);
    } catch (e) {
      setError(e instanceof Error ? e.message : "That didn't save. Try again.");
      setBusy(false);
    }
  }, [busy, current, fields, onSubmit, values]);

  return (
    <div className="cc-fade-in fixed inset-x-0 bottom-0 z-[62] flex justify-center px-3 pb-3 sm:px-5 sm:pb-5">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
        onKeyDown={(e) => {
          if (e.key === "Escape") onDismiss();
        }}
        className="w-full max-w-[520px] rounded-2xl border border-ink-15 bg-paper p-5 shadow-[0_24px_60px_-24px_rgba(0,0,0,0.4)]"
        aria-label="Fill these in"
      >
        <div className="flex items-baseline justify-between gap-4">
          <p className="text-[0.72rem] uppercase tracking-[0.16em] text-ink-30">
            Easier to type
          </p>
          <button
            type="button"
            onClick={onDismiss}
            className="text-[0.78rem] text-ink-30 underline-offset-4 hover:text-ink hover:underline"
          >
            Not now
          </button>
        </div>

        {reason && (
          <p className="mt-2 text-[0.88rem] leading-relaxed text-ink-70">{reason}</p>
        )}

        <div className="mt-4 flex flex-col gap-3.5">
          {fields.map((f, i) => (
            <label key={f.name} className="block">
              <span className="block text-[0.8rem] font-medium text-ink-70">
                {f.label}
                {f.required && <span className="text-ink-30"> · needed</span>}
              </span>

              {f.type === "list" || f.type === "textarea" ? (
                <textarea
                  ref={i === 0 ? (el) => { first.current = el; } : undefined}
                  rows={f.type === "list" ? 3 : 4}
                  value={values[f.name] ?? ""}
                  onChange={(e) => setValues((v) => ({ ...v, [f.name]: e.target.value }))}
                  className="mt-1.5 w-full resize-y rounded-xl border border-ink-15 bg-paper px-3 py-2 text-[0.92rem] outline-none transition-colors focus:border-ink"
                />
              ) : (
                <input
                  ref={i === 0 ? (el) => { first.current = el; } : undefined}
                  type={f.type === "number" ? "number" : f.type}
                  // The right keyboard on a phone, which is most of the value
                  // of asking in writing at all.
                  inputMode={
                    f.type === "email" ? "email" : f.type === "tel" ? "tel" : f.type === "url" ? "url" : undefined
                  }
                  autoComplete={
                    f.name === "email" ? "email" : f.name === "phone" ? "tel" : f.name === "full_name" ? "name" : "off"
                  }
                  value={values[f.name] ?? ""}
                  onChange={(e) => setValues((v) => ({ ...v, [f.name]: e.target.value }))}
                  className="mt-1.5 w-full rounded-xl border border-ink-15 bg-paper px-3 py-2 text-[0.92rem] outline-none transition-colors focus:border-ink"
                />
              )}

              {f.hint && <span className="mt-1 block text-[0.75rem] text-ink-30">{f.hint}</span>}
            </label>
          ))}
        </div>

        {error && <p className="mt-3 text-[0.82rem] leading-relaxed text-ink-70">{error}</p>}

        <div className="mt-5 flex items-center gap-4">
          <button
            type="submit"
            disabled={busy}
            className="rounded-full bg-ink px-5 py-2.5 text-[0.85rem] font-semibold text-paper transition-transform hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {busy ? "Saving…" : "Save"}
          </button>
          <p className="text-[0.75rem] leading-relaxed text-ink-30">
            The call keeps running — carry on talking while you type.
          </p>
        </div>
      </form>
    </div>
  );
}
