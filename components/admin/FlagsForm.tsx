"use client";

import { useEffect, useMemo, useState } from "react";
import { rateFor, type Feature, type Rate } from "@/lib/app/ai-cost";
import type { Flags } from "@/lib/app/flags";
import type { ListedModel, ModelList } from "@/lib/app/model-list";

/**
 * The settings that actually do something.
 *
 * One row per agentic feature: whether it is on, and which model answers it.
 *
 * The list is fetched from the providers rather than written here, because a
 * hard-coded list is wrong the week after it is written and because the only
 * true answer is what *this* key can reach. It arrives after the page does —
 * two upstream calls that can be slow or down should not hold up a settings
 * screen, least of all the one you would use to move off a provider that is
 * having an outage.
 *
 * Models we cannot price are offered anyway, marked. Hiding them would mean
 * the picker silently refuses a model the person can see in their own console;
 * the honest version offers it and says what it costs you — its spend shows on
 * the dashboard as unpriced until a rate is added to `ai-cost.ts`.
 *
 * Nothing saves as you type. One Save for the whole form, because half a
 * configuration applied while you were still deciding is worse than none.
 */

type Props = {
  initial: Flags;
  features: { key: Feature; label: string }[];
  /** Which providers have a key on this deployment. */
  configured: Record<string, boolean>;
  /** Models that actually ran recently, and how much of that went unpriced. */
  seen: { model: string; provider: string; calls: number; unpriced: number }[];
};

const PROVIDER_LABEL: Record<string, string> = {
  openai: "OpenAI",
  gemini: "Gemini",
  sarvam: "Sarvam",
};

/**
 * Which kind of model each feature needs.
 *
 * Live voice speaks a duplex protocol; everything else is a request and a
 * reply. Offering `gpt-realtime` for reading a résumé would be offering a
 * choice that cannot work, which is worse than not offering it.
 */
const KIND: Record<Feature, "chat" | "realtime"> = {
  voice_conversation: "realtime",
  agent_chat: "chat",
  resume_extraction: "chat",
  document_read: "chat",
  ats_analysis: "chat",
  resume_generation: "chat",
  resume_rewrite: "chat",
};

export function FlagsForm({ initial, features, configured, seen }: Props) {
  const [flags, setFlags] = useState<Flags>(initial);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [list, setList] = useState<ModelList | null>(null);
  const [loadingList, setLoadingList] = useState(true);

  useEffect(() => {
    let live = true;
    void fetch("/api/admin/models")
      .then((r) => r.json())
      .then((json: { ok?: boolean } & ModelList) => {
        if (live && json.ok) setList({ models: json.models, problems: json.problems, static: json.static });
      })
      .catch(() => {})
      .finally(() => live && setLoadingList(false));
    return () => {
      live = false;
    };
  }, []);

  const dirty = useMemo(() => JSON.stringify(flags) !== JSON.stringify(initial), [flags, initial]);

  function set(feature: Feature, patch: Partial<Flags["agent"][Feature]>) {
    setSaved(false);
    setFlags((f) => ({ ...f, agent: { ...f.agent, [feature]: { ...f.agent[feature], ...patch } } }));
  }

  /**
   * One field of one model's price. Empty clears it back to the built-in.
   *
   * `currency` comes from the model's built-in rate rather than defaulting to
   * USD. Sarvam publishes in rupees, and stamping USD on a corrected Sarvam
   * price would have recorded it at 88 times its real value — the exact shape
   * of the mistake this whole screen exists to let somebody fix.
   */
  function setRate(model: string, field: keyof Rate, value: string, currency: "USD" | "INR") {
    setSaved(false);
    setFlags((f) => {
      const rates = { ...f.rates };
      const row: Rate = { ...(rates[model] ?? {}), currency };
      const n = Number.parseFloat(value);
      if (value.trim() === "" || !Number.isFinite(n) || n < 0) delete row[field];
      else (row as Record<string, unknown>)[field] = n;

      const priced = (["input", "output", "audioInput", "audioOutput", "perMinute"] as const).some(
        (k) => row[k] !== undefined,
      );
      if (priced) rates[model] = row;
      else delete rates[model];
      return { ...f, rates };
    });
  }

  /**
   * Every model worth showing a price for: the ones selected above, and the
   * ones that have actually been billed recently. Not the whole provider
   * catalogue — a hundred rows of models nobody runs is a form nobody reads.
   */
  const priceable = useMemo(() => {
    const names = new Map<string, { calls: number; unpriced: number }>();
    for (const s of seen) names.set(s.model, { calls: s.calls, unpriced: s.unpriced });
    for (const f of features) {
      const m = flags.agent[f.key].model;
      if (m && !names.has(m)) names.set(m, { calls: 0, unpriced: 0 });
    }
    return [...names.entries()]
      .map(([model, stat]) => ({ model, ...stat, built: rateFor(model) }))
      .sort(
        (a, b) =>
          Number(Boolean(b.built === null)) - Number(Boolean(a.built === null)) ||
          b.unpriced - a.unpriced ||
          b.calls - a.calls,
      );
  }, [seen, features, flags]);

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
    <>
      {list?.problems.length ? (
        <p className="mb-3 rounded-xl border border-ink-15 px-4 py-3 text-[0.82rem] text-ink-50">
          {list.problems.map((p) => `${PROVIDER_LABEL[p.provider] ?? p.provider}: ${p.reason}`).join(" · ")}
        </p>
      ) : null}

      <div className="rounded-2xl border border-ink-08">
        <ul className="divide-y divide-ink-08">
          {features.map(({ key, label }) => {
            const row = flags.agent[key];
            const kind = KIND[key];
            const options = (list?.models ?? []).filter((m) => m.kind === kind);
            const chosen = row.model ? `${row.provider ?? providerOf(row.model, options)}:${row.model}` : "";
            const unpriced =
              row.model && options.find((m) => m.model === row.model)?.price === null;

            return (
              <li key={key} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start sm:gap-4 sm:p-5">
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
                      <code className="block truncate text-[0.7rem] text-ink-30">
                        {key}
                        {kind === "realtime" && " · live voice"}
                      </code>
                    </span>
                  </label>
                </div>

                <div className="sm:w-[22rem] sm:shrink-0">
                  <select
                    value={chosen}
                    disabled={!row.enabled}
                    onChange={(e) => {
                      if (!e.target.value) return set(key, { provider: null, model: null });
                      const at = e.target.value.indexOf(":");
                      set(key, {
                        provider: e.target.value.slice(0, at) as never,
                        model: e.target.value.slice(at + 1),
                      });
                    }}
                    aria-label={`Model for ${label}`}
                    className="w-full rounded-lg border border-ink-15 bg-paper px-3 py-2 text-[0.82rem] outline-none transition-colors focus:border-ink-30 disabled:opacity-40"
                  >
                    <option value="">Follow the environment</option>

                    {/* A model chosen before, that this key no longer lists.
                        Kept as an option so opening the page does not silently
                        reset somebody's configuration to the default. */}
                    {row.model && !options.some((m) => m.model === row.model) && (
                      <option value={chosen}>
                        {row.model} — not in this key&apos;s list
                      </option>
                    )}

                    {groupBy(options).map(([provider, models]) => (
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
                            {m.model}
                            {priceLabel(m.price)}
                          </option>
                        ))}
                      </optgroup>
                    ))}
                  </select>

                  {loadingList && (
                    <p className="mt-1.5 text-[0.72rem] text-ink-30">Asking the providers…</p>
                  )}
                  {!row.enabled && (
                    <p className="mt-1.5 text-[0.72rem] text-ink-30">
                      Off. This feature will refuse rather than fall back to another model.
                    </p>
                  )}
                  {row.enabled && unpriced && (
                    <p className="mt-1.5 text-[0.72rem] text-ink-50">
                      No rate for this one — its spend shows on the dashboard as unpriced until you
                      add it to <code>ai-cost.ts</code>.
                    </p>
                  )}
                  {row.enabled && row.model && !unpriced && (
                    <p className="mt-1.5 text-[0.72rem] text-ink-30">
                      Only this model is used. If it fails, the call fails — it is not swapped.
                    </p>
                  )}
                </div>
              </li>
            );
          })}
        </ul>

      </div>

      {priceable.length > 0 && (
        <section className="mt-8">
          <h2 className="text-[0.72rem] font-medium uppercase tracking-[0.16em] text-ink-30">
            Model prices
          </h2>
          <p className="mb-3 mt-2 max-w-[70ch] text-[0.8rem] leading-relaxed text-ink-30">
            Per million tokens, each in <b>its own model&apos;s currency</b> — the symbol on each
            field says which, and Sarvam bills in rupees. Blank means the built-in rate is used;
            type a number to override it. This exists because a price you cannot correct without a
            deploy is a price that stays wrong — and the cost column is only worth reading if it
            is right.
            Changing a rate here affects <b>calls made from now on</b>: rows already written keep
            the number they were costed with, so history stays reconcilable against an invoice.
          </p>

          <div className="overflow-x-auto rounded-2xl border border-ink-08">
            <table className="w-full min-w-[38rem] table-fixed border-collapse text-[0.8rem]">
              <thead>
                <tr className="border-b border-ink-08 text-left text-[0.7rem] uppercase tracking-[0.08em] text-ink-30">
                  <th className="w-[26%] px-3 py-3 font-medium">Model</th>
                  <th className="w-[14.8%] px-2 py-3 font-medium">In</th>
                  <th className="w-[14.8%] px-2 py-3 font-medium">Out</th>
                  <th className="w-[14.8%] px-2 py-3 font-medium">Audio in</th>
                  <th className="w-[14.8%] px-2 py-3 font-medium">Audio out</th>
                  <th className="w-[14.8%] px-2 py-3 font-medium">Per min</th>
                </tr>
              </thead>
              <tbody>
                {priceable.map(({ model, built, calls, unpriced }) => {
                  const over = flags.rates[model];
                  // The model's own currency, not the form's. Sarvam is in
                  // rupees and always was; the column header cannot say "USD"
                  // for every row without lying about a quarter of them.
                  const currency = (over?.currency ?? built?.currency ?? "USD") as "USD" | "INR";
                  const sym = currency === "INR" ? "₹" : "$";
                  return (
                    <tr key={model} className="border-b border-ink-08 last:border-b-0">
                      <td className="px-3 py-3 align-middle">
                        <code className="block break-all text-[0.76rem]">{model}</code>
                        <span className="text-[0.7rem] text-ink-30">
                          {currency === "INR" && "priced in ₹ · "}
                          {calls > 0 ? `${calls} call${calls === 1 ? "" : "s"}` : "not used yet"}
                          {unpriced > 0 && ` · ${unpriced} unpriced`}
                          {!built && !over && " · no built-in rate"}
                        </span>
                      </td>
                      {(["input", "output", "audioInput", "audioOutput", "perMinute"] as const).map(
                        (field) => (
                          <td key={field} className="px-1.5 py-3 align-middle">
                            <label className="flex items-center gap-1">
                              <span className="text-[0.72rem] text-ink-30">{sym}</span>
                              <input
                                inputMode="decimal"
                                aria-label={`${field} rate for ${model}`}
                                value={over?.[field] ?? ""}
                                onChange={(e) => setRate(model, field, e.target.value, currency)}
                                placeholder={
                                  built?.[field] !== undefined ? String(built[field]) : "—"
                                }
                                className="w-full min-w-0 rounded-lg border border-ink-15 bg-paper px-1.5 py-1.5 text-[0.78rem] tabular-nums outline-none transition-colors focus:border-ink-30"
                              />
                            </label>
                          </td>
                        ),
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <p className="mt-2 text-[0.76rem] leading-relaxed text-ink-30">
            A greyed number is the built-in rate; typing replaces it. A model billed by the minute
            — translation and transcription are — should have{" "}
            <b>only</b> its per-minute rate set: those calls are costed from the recorded duration,
            not from tokens. If a model uses a kind of token you have left blank, the call is
            recorded as unpriced rather than counted at a rate that would be too low.
          </p>
        </section>
      )}

      {/* One Save for models and prices together. Two buttons would let
          somebody pin a model and leave its price unsaved, which is exactly
          the half-applied configuration this form exists to avoid. */}
      <div className="sticky bottom-0 mt-4 flex flex-col gap-3 rounded-2xl border border-ink-15 bg-paper p-4 shadow-[0_-8px_24px_-12px_rgba(0,0,0,0.25)] sm:flex-row sm:items-center sm:p-5">
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
            "Saved — live within about five seconds"
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

      {list?.static.length ? (
        <p className="mt-3 text-[0.76rem] leading-relaxed text-ink-30">
          {list.static.map((p) => PROVIDER_LABEL[p] ?? p).join(", ")} has no model-listing endpoint,
          so its models come from the rate table in <code>ai-cost.ts</code> rather than from the
          provider. Add a name there and it appears here.
        </p>
      ) : null}
    </>
  );
}

/**
 * What one model costs, said in the terms that decide the bill.
 *
 * For a realtime model the audio rate is the number that matters — a spoken
 * session spends almost nothing on text — so audio leads and text follows.
 * Showing `$4/24` for a voice model, as this did, quietly reports a twentieth
 * of what the session will actually cost.
 */
function priceLabel(price: ListedModel["price"]): string {
  if (!price) return " · no rate";
  const sym = price.currency === "INR" ? "₹" : "$";

  // Per-token figures share one "per M"; a per-minute rate is its own unit and
  // must not inherit it.
  const perMillion: string[] = [];
  if (price.audioInput !== undefined || price.audioOutput !== undefined) {
    perMillion.push(`audio ${sym}${price.audioInput ?? "—"}/${price.audioOutput ?? "—"}`);
  }
  if (price.input !== undefined || price.output !== undefined) {
    perMillion.push(`text ${sym}${price.input ?? "—"}/${price.output ?? "—"}`);
  }

  const parts: string[] = [];
  if (price.perMinute !== undefined) parts.push(`${sym}${price.perMinute} per minute`);
  if (perMillion.length) parts.push(`${perMillion.join(" · ")} per M`);
  return parts.length ? ` · ${parts.join(" · ")}` : " · no rate";
}

function groupBy(models: ListedModel[]): [string, ListedModel[]][] {
  const groups = new Map<string, ListedModel[]>();
  for (const m of models) {
    const list = groups.get(m.provider);
    if (list) list.push(m);
    else groups.set(m.provider, [m]);
  }
  return [...groups.entries()];
}

/** Which provider serves this model, when only the name was stored. */
function providerOf(model: string, models: ListedModel[]): string {
  return models.find((m) => m.model === model)?.provider ?? "openai";
}
