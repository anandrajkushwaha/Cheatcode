"use client";

import { useMemo, useState } from "react";
import type { CatalogueEntry, Feature } from "@/lib/app/ai-cost";
import type { Flags } from "@/lib/app/flags";

/**
 * The settings that actually do something.
 *
 * One row per agentic feature. Each row says whether the feature is on, and
 * which model answers it. The model list is the price table — you cannot pick
 * something we do not know how to cost, because a model with no rate reports
 * every one of its calls as unpriced spend, which is exactly the failure that
 * kept the Sarvam price wrong for weeks.
 *
 * Models whose provider has no API key on this deployment are shown and
 * disabled rather than hidden. Hiding them turns "we have no Gemini key" into
 * "Gemini does not exist", and the person wondering why their model vanished
 * has nothing to go on.
 *
 * Nothing saves as you type. The whole form is one Save, because half a
 * configuration applied while you were still deciding is worse than none.
 */

type Props = {
  initial: Flags;
  features: { key: Feature; label: string }[];
  catalogue: CatalogueEntry[];
  /** Which providers have a key on this deployment. */
  configured: Record<string, boolean>;
};

const PROVIDER_LABEL: Record<string, string> = {
  openai: "OpenAI",
  gemini: "Gemini",
  sarvam: "Sarvam",
};

export function FlagsForm({ initial, features, catalogue, configured }: Props) {
  const [flags, setFlags] = useState<Flags>(initial);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /** Dirty is compared against what the server gave us, not tracked by hand. */
  const dirty = useMemo(
    () => JSON.stringify(flags) !== JSON.stringify(initial),
    [flags, initial],
  );

  const byProvider = useMemo(() => {
    const groups = new Map<string, CatalogueEntry[]>();
    for (const e of catalogue) {
      const list = groups.get(e.provider);
      if (list) list.push(e);
      else groups.set(e.provider, [e]);
    }
    return [...groups.entries()];
  }, [catalogue]);

  function set(feature: Feature, patch: Partial<Flags["agent"][Feature]>) {
    setSaved(false);
    setFlags((f) => ({
      ...f,
      agent: { ...f.agent, [feature]: { ...f.agent[feature], ...patch } },
    }));
  }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/flags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ flags, note: note.trim() || undefined }),
      });
      const json = (await res.json()) as { ok?: boolean; error?: string };
      if (!json.ok) throw new Error(json.error ?? "That didn't save.");
      setSaved(true);
      setNote("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "That didn't save.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-2xl border border-ink-08">
      <ul className="divide-y divide-ink-08">
        {features.map(({ key, label }) => {
          const row = flags.agent[key];
          // A model belongs to a provider; picking one implies the other, so
          // the two controls are one choice stored as two fields.
          const value = row.model ? `${row.provider ?? providerOf(row.model, catalogue)}:${row.model}` : "";

          return (
            <li key={key} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:gap-4 sm:p-5">
              <div className="min-w-0 flex-1">
                <label className="flex cursor-pointer items-center gap-3">
                  <input
                    type="checkbox"
                    checked={row.enabled}
                    onChange={(e) => set(key, { enabled: e.target.checked })}
                    className="h-4 w-4 shrink-0 accent-black"
                  />
                  <span className="min-w-0">
                    <span className="block text-[0.88rem] font-medium">{label}</span>
                    <code className="block truncate text-[0.7rem] text-ink-30">{key}</code>
                  </span>
                </label>
              </div>

              <div className="sm:w-[19rem] sm:shrink-0">
                <select
                  value={value}
                  disabled={!row.enabled}
                  onChange={(e) => {
                    if (!e.target.value) return set(key, { provider: null, model: null });
                    const [provider, model] = e.target.value.split(":");
                    set(key, { provider: provider as never, model });
                  }}
                  aria-label={`Model for ${label}`}
                  className="w-full rounded-lg border border-ink-15 bg-paper px-3 py-2 text-[0.82rem] outline-none transition-colors focus:border-ink-30 disabled:opacity-40"
                >
                  <option value="">Follow the environment</option>
                  {byProvider.map(([provider, models]) => (
                    <optgroup
                      key={provider}
                      label={`${PROVIDER_LABEL[provider] ?? provider}${
                        configured[provider] ? "" : " — no API key on this deployment"
                      }`}
                    >
                      {models.map((m) => (
                        <option
                          key={m.model}
                          value={`${m.provider}:${m.model}`}
                          disabled={!configured[provider]}
                        >
                          {m.model} · {m.currency === "INR" ? "₹" : "$"}
                          {m.input}/{m.output} per M{m.audio ? " · audio" : ""}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>

                {!row.enabled && (
                  <p className="mt-1.5 text-[0.72rem] text-ink-30">
                    Off. This feature will refuse rather than fall back to another model.
                  </p>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      <div className="flex flex-col gap-3 border-t border-ink-08 p-4 sm:flex-row sm:items-center sm:p-5">
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Why (optional) — shows up next to the change"
          className="min-w-0 flex-1 rounded-lg border border-ink-15 px-3 py-2 text-[0.82rem] outline-none focus:border-ink-30"
        />
        <span className="text-[0.78rem] text-ink-30">
          {error ? (
            <span className="text-ink">{error}</span>
          ) : saved ? (
            "Saved — live within about 30 seconds"
          ) : dirty ? (
            "Not saved"
          ) : (
            ""
          )}
        </span>
        <button
          type="button"
          onClick={() => void save()}
          disabled={saving || !dirty}
          className="shrink-0 rounded-full bg-ink px-5 py-2 text-[0.84rem] font-semibold text-paper transition-transform hover:scale-[1.02] disabled:opacity-40 disabled:hover:scale-100"
        >
          {saving ? "Saving…" : "Save"}
        </button>
      </div>
    </div>
  );
}

/** Which provider serves this model, when only the name was stored. */
function providerOf(model: string, catalogue: CatalogueEntry[]): string {
  return catalogue.find((e) => e.model === model)?.provider ?? "openai";
}
