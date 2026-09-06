"use client";

import { useMemo } from "react";
import {
  estimateAll,
  AUDIO_IN_TOKENS_PER_MIN,
  AUDIO_OUT_TOKENS_PER_MIN,
  SYSTEM_TOKENS,
  PART_ORDER,
  type Chosen,
  type Estimate,
  type PartKey,
} from "@/lib/app/voice-estimate";

/**
 * What a minute of the agent costs, on the models chosen right below this.
 *
 * The dashboard reports what was spent. This is the number you need *before*
 * you price a plan or hand somebody free minutes, and it recomputes as the
 * dropdowns change — so switching the voice row from the flagship to the mini
 * shows you the effect on unit economics in the same breath as the choice.
 *
 * ------------------------------------------------------- what is a "chart"
 *
 * Three headline numbers is a KPI row of stat tiles, not a three-bar chart.
 * The bars below them are doing a different job — part-to-whole, where the
 * money goes — and they share one scale across all three profiles, so the
 * power user's bar is visibly longer rather than each being normalised to its
 * own total. Bars normalised separately look identical and compare nothing;
 * that mistake has already been made once on the spend page.
 *
 * Every segment is direct-labelled with its value. Three of the five hues sit
 * below 3:1 against this surface, and the palette rule is that colour then has
 * to be backed by a visible label rather than carrying identity alone.
 */

const INR_PER_USD = 88;

/**
 * Fixed slots, assigned in order and never cycled — and bound to *what a
 * segment is*, not to where it happens to rank in a given bar.
 *
 * The first version keyed off array position after sorting each bar
 * biggest-first, so blue meant "speaking" on one row and "re-sent context" on
 * the next. A legend cannot mean two things at once; this is the rule that
 * stops it.
 */
const SERIES: Record<PartKey, string> = {
  audioOut: "#2a78d6",
  audioIn: "#eb6834",
  cached: "#1baf7a",
  transcripts: "#eda100",
  textCalls: "#e87ba4",
};

const PART_LABELS: Record<PartKey, string> = {
  audioOut: "Speaking (audio out)",
  audioIn: "Listening (audio in)",
  cached: "Re-sent conversation (cached)",
  transcripts: "Transcripts and instructions",
  textCalls: "Résumé and text calls",
};

const rupees = (usd: number) => usd * INR_PER_USD;

const money = (usd: number): string => {
  const inr = rupees(usd);
  return inr >= 10 ? `₹${inr.toFixed(0)}` : inr >= 1 ? `₹${inr.toFixed(1)}` : `₹${inr.toFixed(2)}`;
};

export function CostEstimate({ chosen, voiceOn }: { chosen: Chosen; voiceOn: boolean }) {
  // Recomputed on every keystroke in the price table above it, which is the
  // point: a corrected rate should move this number while you are still
  // looking at it.
  const rows = useMemo(() => estimateAll(chosen, INR_PER_USD), [chosen]);

  const priced = rows.filter((r) => r.usd !== null);
  // One scale for all three. Without this the bars would be three separate
  // part-to-whole charts that cannot be compared with each other.
  const biggest = Math.max(...priced.map((r) => r.usd ?? 0), 0);

  const unpriced = [...new Set(rows.flatMap((r) => r.unpriced))];

  return (
    <section className="mb-8">
      <h2 className="text-[0.72rem] font-medium uppercase tracking-[0.16em] text-ink-30">
        Estimated cost per minute
      </h2>
      <p className="mb-4 mt-2 max-w-[70ch] text-[0.8rem] leading-relaxed text-ink-30">
        What one conversation costs on the models selected below — worked out from the published
        token rates, not from past spend. A spoken minute is not a flat rate: the whole
        conversation is re-sent to the model on every reply, so a twenty-minute call costs more
        per minute than a three-minute one. These are estimates and never reach the spend table.
      </p>

      {!voiceOn && (
        <p className="mb-4 rounded-xl border border-ink-15 px-4 py-3 text-[0.82rem] text-ink-50">
          Voice is switched off below, so nobody is spending this today. The figures show what a
          call would cost if you switched it back on.
        </p>
      )}

      {unpriced.length > 0 && (
        <p className="mb-4 rounded-xl border border-ink-15 px-4 py-3 text-[0.82rem] text-ink-50">
          No estimate for {unpriced.map((m) => <code key={m}>{m}</code>).reduce((a, b) => <>{a}, {b}</>)}{" "}
          — set its rate in the table below and this fills in. A missing <b>cached input</b> rate
          alone is enough to stop it: re-sent conversation is most of a long call&apos;s input, and
          pricing that half at zero would give you a confident, badly low number.
        </p>
      )}

      {/* -------------------------------------------------- the three numbers */}
      <div className="grid gap-3 sm:grid-cols-3">
        {rows.map((r) => (
          <div key={r.profile.key} className="rounded-2xl border border-ink-08 p-4">
            <div className="text-[0.82rem] font-medium">{r.profile.label}</div>
            <div className="mt-2 flex items-baseline gap-1.5">
              <span className="text-[1.6rem] font-semibold tracking-[-0.03em] tabular-nums">
                {r.perMinuteUsd === null ? "—" : money(r.perMinuteUsd)}
              </span>
              <span className="text-[0.78rem] text-ink-30">per minute</span>
            </div>
            <div className="mt-1 text-[0.76rem] text-ink-50 tabular-nums">
              {r.usd === null
                ? "no rate"
                : `${money(r.usd)} for a ${r.profile.minutes}-minute call · $${r.usd.toFixed(3)}`}
            </div>
            <p className="mt-2 text-[0.72rem] leading-relaxed text-ink-30">{r.profile.note}</p>
          </div>
        ))}
      </div>

      {/* ------------------------------------------------- where the money goes */}
      {priced.length > 0 && (
        <div className="mt-4 rounded-2xl border border-ink-08 p-4 sm:p-5">
          <div className="text-[0.82rem] font-medium">Where a call&apos;s cost goes</div>
          <p className="mt-1 text-[0.74rem] text-ink-30">
            One scale across all three, so the bars are comparable with each other rather than
            each filling its own row.
          </p>

          <div className="mt-4 space-y-3">
            {priced.map((r) => (
              <Bar key={r.profile.key} row={r} biggest={biggest} />
            ))}
          </div>

          <Legend rows={priced} />
        </div>
      )}

      <Assumptions rows={rows} />
    </section>
  );
}

/**
 * One call, split by where its money went.
 *
 * A 2px gap between segments, because touching fills of similar lightness read
 * as one shape — the surface showing through is what separates them.
 */
function Bar({ row, biggest }: { row: Estimate; biggest: number }) {
  const width = biggest > 0 ? ((row.usd ?? 0) / biggest) * 100 : 0;
  return (
    <div>
      <div className="flex items-baseline justify-between text-[0.76rem]">
        <span>{row.profile.label}</span>
        <span className="tabular-nums text-ink-50">
          {money(row.usd ?? 0)} · {row.profile.minutes} min
        </span>
      </div>
      <div className="mt-1 h-3 w-full">
        <div className="flex h-full gap-[2px]" style={{ width: `${width}%` }}>
          {row.parts.map((p, i) => (
            <div
              key={p.key}
              title={`${p.label}: ${money(p.usd)}`}
              style={{
                width: `${((row.usd ?? 0) > 0 ? (p.usd / (row.usd ?? 1)) * 100 : 0)}%`,
                background: SERIES[p.key],
                borderRadius:
                  i === row.parts.length - 1 ? "0 4px 4px 0" : i === 0 ? "4px 0 0 4px" : 0,
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

/** Identity is never colour alone: every slot is named and valued. */
function Legend({ rows }: { rows: Estimate[] }) {
  // Every key any row actually used, in the fixed order — so the legend reads
  // the same way round as the bars do.
  const used = new Set(rows.flatMap((r) => r.parts.map((p) => p.key)));
  return (
    <ul className="mt-4 flex flex-wrap gap-x-4 gap-y-1.5 text-[0.74rem] text-ink-50">
      {PART_ORDER.filter((k) => used.has(k)).map((key) => (
        <li key={key} className="flex items-center gap-1.5">
          <span
            aria-hidden
            className="h-2.5 w-2.5 shrink-0 rounded-[3px]"
            style={{ background: SERIES[key] }}
          />
          {PART_LABELS[key]}
        </li>
      ))}
    </ul>
  );
}

/**
 * The numbers behind the numbers.
 *
 * On the screen rather than in a comment, because an estimate whose
 * assumptions are hidden is a figure people quote without knowing what it
 * rests on — and the ones here are arguable on purpose.
 */
function Assumptions({ rows }: { rows: Estimate[] }) {
  return (
    <details className="mt-3">
      <summary className="cursor-pointer text-[0.78rem] text-ink-50">
        What this assumes
      </summary>
      <div className="mt-2 max-w-[75ch] space-y-2 text-[0.76rem] leading-relaxed text-ink-30">
        <p>
          Audio is billed by duration, not by words: {AUDIO_IN_TOKENS_PER_MIN} tokens per minute of
          what the microphone sends and {AUDIO_OUT_TOKENS_PER_MIN} per minute of what the agent
          says. <b>The microphone streams the whole time</b>, so silence costs the same as speech
          on the way in — modelling only talk-time would undercount a real bill by about a third.
        </p>
        <p>
          The system instruction and tool schemas are taken as {SYSTEM_TOKENS.toLocaleString()}{" "}
          tokens, charged once and cached thereafter. Re-sent conversation is priced at the
          model&apos;s cached-input rate, which is where most of a long call&apos;s input sits.
        </p>
        <ul className="ml-4 list-disc space-y-1">
          {rows.map((r) => (
            <li key={r.profile.key}>
              <b>{r.profile.label}:</b> {r.profile.minutes} minute call, agent speaking{" "}
              {Math.round(r.profile.agentTalkShare * 100)}% of it, the person speaking{" "}
              {Math.round(r.profile.userTalkShare * 100)}% at {r.profile.wordsPerMinute} words a
              minute, {r.profile.turnsPerMinute} replies a minute
              {r.profile.textCalls.length > 0 && (
                <>
                  , plus{" "}
                  {r.profile.textCalls.reduce((t, c) => t + c.count, 0)} text-model calls for
                  reading and writing the résumé
                </>
              )}
              .
            </li>
          ))}
        </ul>
        <p>
          These are stated behaviours, not measurements — the honest weak point of the whole
          section. Every one of them is now recorded per call in <code>ai_usage</code>, so once
          there are real sessions to average, replace them with what actually happened.
        </p>
      </div>
    </details>
  );
}
