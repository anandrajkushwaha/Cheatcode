"use client";

import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { analyseResume, type AtsResult } from "@/lib/tools/ats";
import { ExtractError, extractResume } from "@/lib/tools/extract";
import type { ParsedResume } from "@/lib/app/account";
import { Chip, ScoreRing } from "./ui";

type State =
  | { phase: "idle" }
  | { phase: "reading"; name: string }
  | { phase: "thinking"; name: string; result: AtsResult }
  | { phase: "done"; name: string; result: AtsResult; parsed: ParsedResume | null; parseError: string | null }
  | { phase: "error"; message: string };

const ACCEPT = ".pdf,.docx,.txt";

/**
 * Upload once, get two things.
 *
 * The file is read in the browser — the same extractor the public tool uses —
 * and only the extracted text is sent to the server. That keeps a document
 * carrying someone's phone number and home address out of server logs, and it
 * means the ATS score appears instantly while the slower parse runs.
 */
export function ResumeUpload({ hasExisting }: { hasExisting: boolean }) {
  const router = useRouter();
  const [state, setState] = useState<State>({ phase: "idle" });
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const run = useCallback(
    async (file: File) => {
      setState({ phase: "reading", name: file.name });

      let result: AtsResult;
      let text: string;
      try {
        const facts = await extractResume(file);
        text = facts.text;

        if (text.replace(/\s/g, "").length < 60) {
          setState({
            phase: "error",
            message:
              "Almost no text came out of that file. It's very likely an image or a scan — " +
              "which is exactly what an applicant tracking system sees too. Export a real PDF " +
              "from your editor and try again.",
          });
          return;
        }

        result = analyseResume(facts);
      } catch (err) {
        setState({
          phase: "error",
          message:
            err instanceof ExtractError
              ? err.message
              : "Something went wrong reading that file. Try a different export, or a PDF.",
        });
        return;
      }

      // The score is ready — show it while the model reads the rest.
      setState({ phase: "thinking", name: file.name, result });

      try {
        const res = await fetch("/api/app/resume", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fileName: file.name,
            fileType: file.name.split(".").pop()?.toLowerCase(),
            text,
            atsScore: result.score,
            atsResult: result,
          }),
        });
        const json = await res.json();
        if (!json.ok) throw new Error(json.error ?? "Could not save.");

        setState({
          phase: "done",
          name: file.name,
          result,
          parsed: json.parsed ?? null,
          parseError: json.parseError ?? null,
        });
        router.refresh();
      } catch (e) {
        setState({
          phase: "done",
          name: file.name,
          result,
          parsed: null,
          parseError: e instanceof Error ? e.message : "Could not save the resume.",
        });
      }
    },
    [router],
  );

  const failing = state.phase === "done" || state.phase === "thinking"
    ? state.result.checks.filter((c) => c.status === "fail")
    : [];

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (f) void run(f);
        }}
      />

      {(state.phase === "idle" || state.phase === "error") && (
        <>
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              const f = e.dataTransfer.files?.[0];
              if (f) void run(f);
            }}
            className={`flex w-full flex-col items-center justify-center rounded-2xl border border-dashed px-6 py-14 text-center transition-colors ${
              dragging ? "border-ink bg-ink-04" : "border-ink-15 hover:border-ink-30"
            }`}
          >
            <span className="text-[1rem] font-medium">
              {hasExisting ? "Upload a newer resume" : "Drop your resume here"}
            </span>
            <span className="mt-2 text-[0.85rem] text-ink-30">
              PDF, DOCX or TXT · read in your browser, never uploaded as a file
            </span>
          </button>

          {state.phase === "error" && (
            <p className="mt-4 rounded-xl border border-ink-30 p-4 text-[0.88rem] leading-relaxed">
              {state.message}
            </p>
          )}
        </>
      )}

      {(state.phase === "reading" || state.phase === "thinking") && (
        <div className="rounded-2xl border border-ink-08 p-7">
          <p className="text-[0.95rem] font-medium">{state.name}</p>
          <p className="mt-2 text-[0.88rem] text-ink-50">
            {state.phase === "reading"
              ? "Reading the file…"
              : "Scored. Now working out your skills and experience…"}
          </p>
          {state.phase === "thinking" && (
            <div className="mt-6 flex items-center gap-5">
              <ScoreRing score={state.result.score} />
              <p className="text-[0.88rem] leading-relaxed text-ink-50">{state.result.verdict}</p>
            </div>
          )}
        </div>
      )}

      {state.phase === "done" && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-ink-08 p-7">
            <div className="flex flex-wrap items-center gap-6">
              <ScoreRing score={state.result.score} />
              <div className="min-w-0 flex-1">
                <p className="text-[1.05rem] font-medium">{state.result.verdict}</p>
                <p className="mt-1.5 text-[0.88rem] leading-relaxed text-ink-50">
                  {state.result.summary}
                </p>
              </div>
            </div>

            {failing.length > 0 && (
              <ul className="mt-6 space-y-2.5 border-t border-ink-08 pt-5">
                {failing.slice(0, 5).map((c) => (
                  <li key={c.id} className="flex gap-3 text-[0.88rem] leading-relaxed">
                    <span aria-hidden="true" className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-ink" />
                    <span>
                      <strong className="font-medium">{c.label}.</strong>{" "}
                      <span className="text-ink-50">{c.detail}</span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {state.parsed ? (
            <div className="rounded-2xl border border-ink-08 p-7">
              <p className="text-[0.72rem] uppercase tracking-[0.16em] text-ink-30">
                What we understood
              </p>
              <p className="mt-3 text-[1.05rem] font-medium">
                {state.parsed.headline ?? state.parsed.full_name ?? "Your profile"}
              </p>
              <p className="mt-1.5 text-[0.88rem] text-ink-50">
                {[
                  state.parsed.years_experience !== null && state.parsed.years_experience !== undefined
                    ? `${state.parsed.years_experience} years`
                    : null,
                  state.parsed.roles?.[0]?.company,
                  state.parsed.location,
                ]
                  .filter(Boolean)
                  .join(" · ") || "—"}
              </p>

              {(state.parsed.skills?.length ?? 0) > 0 && (
                <div className="mt-5 flex flex-wrap gap-2">
                  {state.parsed.skills!.slice(0, 18).map((s) => (
                    <Chip key={s}>{s}</Chip>
                  ))}
                </div>
              )}

              <p className="mt-6 border-t border-ink-08 pt-4 text-[0.8rem] leading-relaxed text-ink-30">
                This is what job matching will use. If something is wrong, fix it on your profile —
                the resume itself is never edited.
              </p>
            </div>
          ) : (
            <div className="rounded-2xl border border-ink-30 p-6">
              <p className="text-[0.9rem] font-medium">Saved, but we couldn&apos;t read the details</p>
              <p className="mt-2 text-[0.85rem] leading-relaxed text-ink-50">
                {state.parseError ?? "Something went wrong."} Your score is saved — you can try the
                upload again.
              </p>
            </div>
          )}

          <button
            type="button"
            onClick={() => setState({ phase: "idle" })}
            className="text-[0.85rem] text-ink-30 underline underline-offset-4 hover:text-ink"
          >
            Upload a different file
          </button>
        </div>
      )}
    </div>
  );
}
