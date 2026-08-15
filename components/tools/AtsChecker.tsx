"use client";

import Link from "next/link";
import { useCallback, useRef, useState } from "react";
import { EVENTS, track } from "@/lib/analytics/events";
import { analyseResume, type AtsResult, type Check } from "@/lib/tools/ats";
import { ExtractError, extractResume } from "@/lib/tools/extract";

type State =
  | { phase: "idle" }
  | { phase: "reading"; name: string }
  | { phase: "done"; name: string; result: AtsResult }
  | { phase: "error"; message: string };

const ACCEPT = ".pdf,.docx,.txt";

export function AtsChecker() {
  const [state, setState] = useState<State>({ phase: "idle" });
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const run = useCallback(async (file: File) => {
    setState({ phase: "reading", name: file.name });
    try {
      const facts = await extractResume(file);

      if (facts.text.replace(/\s/g, "").length < 60) {
        setState({
          phase: "error",
          message:
            "Almost no text came out of that file. It's very likely an image or a scan — which is exactly what an ATS sees too. Export a real PDF from your editor and try again.",
        });
        track(EVENTS.TOOL_COMPUTE, { label: "resume-ats-checker", outcome: "no-text" });
        return;
      }

      const result = analyseResume(facts);
      setState({ phase: "done", name: file.name, result });

      track(EVENTS.TOOL_COMPUTE, {
        label: "resume-ats-checker",
        value: result.score,
        file_type: facts.fileType,
        pages: facts.pages,
        words: result.wordCount,
        failing: result.checks.filter((c) => c.status === "fail").length,
      });
    } catch (err) {
      const message =
        err instanceof ExtractError
          ? err.message
          : "Something went wrong reading that file. Try a different export, or a PDF.";
      setState({ phase: "error", message });
      track(EVENTS.TOOL_COMPUTE, { label: "resume-ats-checker", outcome: "error" });
    }
  }, []);

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) void run(file);
  };

  // ------------------------------------------------------------- uploader
  if (state.phase !== "done") {
    return (
      <div>
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          className={`rounded-3xl border border-dashed p-10 text-center transition-colors sm:p-16 ${
            dragging ? "border-ink bg-ink-04" : "border-ink-15"
          }`}
        >
          <p className="text-[1.35rem] font-medium tracking-[-0.02em]">
            {state.phase === "reading" ? "Reading it now…" : "Drop your resume here"}
          </p>
          <p className="mx-auto mt-3 max-w-[46ch] text-[0.95rem] leading-relaxed text-ink-50">
            {state.phase === "reading"
              ? state.name
              : "PDF, DOCX or TXT. It is read inside your browser — the file is never uploaded, and nothing is stored."}
          </p>

          {state.phase !== "reading" && (
            <>
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                data-ev="tool_input"
                data-ev-label="resume-ats-checker-choose"
                className="mt-8 rounded-full bg-ink px-7 py-3.5 text-[0.95rem] font-medium text-paper transition-transform duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] hover:scale-[1.03] active:scale-[0.97]"
              >
                Choose a file
              </button>
              <input
                ref={inputRef}
                type="file"
                accept={ACCEPT}
                className="sr-only"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void run(f);
                  e.target.value = "";
                }}
              />
            </>
          )}
        </div>

        {state.phase === "error" && (
          <div className="mt-5 rounded-2xl border border-ink-30 p-6">
            <p className="text-[0.95rem] font-medium">That didn&apos;t work</p>
            <p className="mt-2 max-w-[62ch] text-[0.92rem] leading-relaxed text-ink-50">
              {state.message}
            </p>
            <button
              type="button"
              onClick={() => setState({ phase: "idle" })}
              className="mt-4 text-[0.88rem] underline underline-offset-4"
            >
              Try another file
            </button>
          </div>
        )}
      </div>
    );
  }

  // ------------------------------------------------------------- results
  const { result, name } = state;
  const failing = result.checks.filter((c) => c.status === "fail");
  const warning = result.checks.filter((c) => c.status === "warn");
  const passing = result.checks.filter((c) => c.status === "pass");

  return (
    <div>
      {/* score */}
      <div className="rounded-3xl border border-ink-08 p-8 sm:p-12">
        <div className="flex flex-col gap-8 sm:flex-row sm:items-center sm:gap-14">
          <div className="shrink-0">
            <p className="text-[0.72rem] uppercase tracking-[0.16em] text-ink-30">
              ATS score
            </p>
            <p className="mt-2 text-[4.5rem] font-semibold leading-none tracking-[-0.05em] tabular-nums">
              {result.score}
              <span className="text-[1.6rem] text-ink-30">/100</span>
            </p>
          </div>

          <div className="min-w-0">
            <p className="text-[1.35rem] font-medium leading-snug tracking-[-0.02em]">
              {result.verdict}
            </p>
            <p className="mt-3 max-w-[54ch] text-[0.98rem] leading-relaxed text-ink-50">
              {result.summary}
            </p>
          </div>
        </div>

        {/* group bars */}
        <ul className="mt-10 grid gap-x-10 gap-y-5 sm:grid-cols-2">
          {result.groups.map((g) => (
            <li key={g.id}>
              <div className="flex items-baseline justify-between gap-4">
                <span className="text-[0.9rem]">{g.label}</span>
                <span className="text-[0.82rem] tabular-nums text-ink-50">
                  {g.earned}/{g.weight}
                </span>
              </div>
              <span className="mt-2 block h-1 overflow-hidden rounded-full bg-ink-08">
                <span
                  className="block h-full rounded-full bg-ink"
                  style={{ width: `${(g.earned / g.weight) * 100}%` }}
                />
              </span>
            </li>
          ))}
        </ul>
      </div>

      {/* the actual findings */}
      {failing.length > 0 && (
        <Findings
          title="Fix these first"
          note="Each of these can remove you from a search before a person ever opens the file."
          checks={failing}
          emphasis
        />
      )}

      {warning.length > 0 && (
        <Findings
          title="Worth tightening"
          note="Nothing here is broken. This is the gap between being read and being shortlisted."
          checks={warning}
        />
      )}

      {passing.length > 0 && (
        <div className="mt-14">
          <h2 className="text-[0.72rem] font-medium uppercase tracking-[0.16em] text-ink-30">
            Already fine
          </h2>
          <ul className="mt-5 grid gap-2.5 sm:grid-cols-2">
            {passing.map((c) => (
              <li key={c.id} className="flex gap-3 text-[0.92rem] text-ink-50">
                <span aria-hidden="true" className="mt-[0.15rem] text-ink-30">
                  ✓
                </span>
                <span>{c.label}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* footer actions */}
      <div className="mt-14 flex flex-col gap-4 border-t border-ink-08 pt-8 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-[0.85rem] text-ink-30">
          Checked <span className="text-ink-50">{name}</span> · nothing was uploaded or stored
        </p>
        <div className="flex flex-wrap items-center gap-5">
          <button
            type="button"
            onClick={() => setState({ phase: "idle" })}
            className="text-[0.9rem] underline underline-offset-4"
          >
            Check another
          </button>
          <Link
            href="/#waitlist"
            data-ev="tool_result_cta"
            data-ev-location="ats-checker"
            data-ev-label="Get early access"
            className="rounded-full bg-ink px-6 py-3 text-[0.9rem] font-medium text-paper transition-transform duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] hover:scale-[1.03] active:scale-[0.97]"
          >
            Get the version that fixes it
          </Link>
        </div>
      </div>
    </div>
  );
}

function Findings({
  title,
  note,
  checks,
  emphasis = false,
}: {
  title: string;
  note: string;
  checks: Check[];
  emphasis?: boolean;
}) {
  return (
    <div className="mt-14">
      <h2 className="text-[0.72rem] font-medium uppercase tracking-[0.16em] text-ink-30">
        {title}
      </h2>
      <p className="mt-3 max-w-[58ch] text-[0.95rem] leading-relaxed text-ink-50">{note}</p>

      <ul className="mt-7 space-y-px overflow-hidden rounded-3xl border border-ink-08 bg-ink-08">
        {checks.map((c) => (
          <li key={c.id} className="bg-paper p-7 sm:p-8">
            <div className="flex items-start gap-4">
              <span
                aria-hidden="true"
                className={`mt-[0.45rem] size-2 shrink-0 rounded-full ${
                  emphasis ? "bg-ink" : "border border-ink-30"
                }`}
              />
              <div className="min-w-0">
                <p className="text-[1.05rem] font-medium tracking-[-0.02em]">{c.label}</p>
                <p className="mt-2 text-[0.93rem] leading-relaxed text-ink-50">{c.detail}</p>
                {c.fix && (
                  <p className="mt-3.5 max-w-[64ch] border-l border-ink-15 pl-4 text-[0.93rem] leading-relaxed text-ink-70">
                    {c.fix}
                  </p>
                )}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
