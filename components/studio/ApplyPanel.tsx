"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { Application } from "@/lib/jobs/applications";

/**
 * Prepare, then apply. Before a pack exists this is one button and a list of
 * what it makes; after, it is the pack in the order somebody uses it:
 * resume, cover letter, answers, then the company's own form.
 */

const STEPS = ["Reading the job posting", "Tailoring your resume", "Writing your cover letter", "Reviewing everything"];

export function ApplyPanel({
  jobId,
  applyUrl,
  company,
  hasResume,
  initial,
  left,
  freeLimit,
  roles,
}: {
  jobId: string;
  applyUrl: string;
  company: string;
  hasResume: boolean;
  initial: Application | null;
  /** Null means unlimited. */
  left: number | null;
  freeLimit: number;
  /** "Title — Company" for each role in the resume, by index. */
  roles: string[];
}) {
  const router = useRouter();
  const [app, setApp] = useState<Application | null>(initial);
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState(0);
  const [error, setError] = useState<{ text: string; upgrade?: boolean; resume?: boolean } | null>(null);

  useEffect(() => {
    if (!busy) return;
    setStep(0);
    const t = setInterval(() => setStep((s) => Math.min(STEPS.length - 1, s + 1)), 9000);
    return () => clearInterval(t);
  }, [busy]);

  async function prepare(regenerate = false) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/app/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId, regenerate }),
      });
      const json = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        application?: Application;
        error?: string;
        upgrade?: boolean;
        needsResume?: boolean;
      };
      if (!json.ok || !json.application) {
        setError({ text: json.error ?? "That didn't work. Try again.", upgrade: json.upgrade, resume: json.needsResume });
        return;
      }
      setApp(json.application);
      router.refresh();
    } catch {
      setError({ text: "No connection. Check your internet and try again." });
    } finally {
      setBusy(false);
    }
  }

  if (!app?.pack) {
    return (
      <section className="rounded-3xl border border-ink-08 bg-paper p-6 sm:p-8">
        <h2 className="text-[1.15rem] font-semibold tracking-[-0.02em]">Get this application ready in a minute</h2>
        <ul className="mt-4 grid gap-2.5 text-[0.9rem] text-ink-70 sm:grid-cols-2">
          {[
            "Your fit for this job — strengths and gaps",
            "Your resume, tailored to this posting",
            "A cover letter written for this company",
            "Answers to the questions the form will ask",
          ].map((x) => (
            <li key={x} className="flex gap-2">
              <span className="text-[#1a7f37]">✓</span>
              {x}
            </li>
          ))}
        </ul>
        <p className="mt-4 text-[0.8rem] leading-relaxed text-ink-30">
          Built only from what your resume says — nothing is made up. A second pass reviews it before you see it.
        </p>

        {error && <Trouble error={error} />}

        {!hasResume ? (
          <Link
            href="/app/resume"
            className="mt-6 inline-flex rounded-full bg-ink px-5 py-3 text-[0.9rem] font-medium text-paper"
          >
            Add your resume first →
          </Link>
        ) : busy ? (
          <div className="mt-6 space-y-2">
            {STEPS.map((s, i) => (
              <p key={s} className={`flex items-center gap-2 text-[0.86rem] ${i <= step ? "text-ink" : "text-ink-30"}`}>
                <span className={i < step ? "text-[#1a7f37]" : i === step ? "animate-pulse" : ""}>
                  {i < step ? "✓" : "●"}
                </span>
                {s}…
              </p>
            ))}
          </div>
        ) : (
          <div className="mt-6 flex flex-wrap items-center gap-4">
            <button
              type="button"
              onClick={() => void prepare()}
              disabled={left === 0}
              className="rounded-full bg-ink px-5 py-3 text-[0.9rem] font-medium text-paper transition-opacity hover:opacity-90 disabled:opacity-40"
            >
              Prepare my application
            </button>
            {left !== null && (
              <span className="text-[0.8rem] text-ink-30">
                {left} of {freeLimit} free this month ·{" "}
                <Link href="/app/upgrade" className="underline underline-offset-2">
                  Pro is unlimited
                </Link>
              </span>
            )}
          </div>
        )}
      </section>
    );
  }

  const p = app.pack;
  return (
    <div className="space-y-5">
      {/* ------------------------------------------------------------ fit */}
      <section className="rounded-3xl border border-ink-08 bg-paper p-6 sm:p-7">
        <div className="flex items-start gap-5">
          <div className="grid h-16 w-16 shrink-0 place-items-center rounded-full bg-ink-04 text-[1.3rem] font-semibold tabular-nums">
            {p.fit_score}
          </div>
          <div className="min-w-0">
            <p className="text-[0.75rem] uppercase tracking-[0.12em] text-ink-30">Your fit</p>
            <p className="mt-1 text-[0.95rem] leading-relaxed">{p.verdict}</p>
          </div>
        </div>
        <div className="mt-5 grid gap-5 sm:grid-cols-2">
          <List title="Strengths" items={p.strengths} mark="✓" color="text-[#1a7f37]" />
          <List title="Gaps to address" items={p.gaps} mark="!" color="text-[#9a6400]" />
        </div>
      </section>

      {/* --------------------------------------------------------- resume */}
      <Step n={1} title="Your tailored resume">
        {p.headline && <p className="font-medium">{p.headline}</p>}
        {p.summary && <p className="mt-2 text-[0.9rem] leading-relaxed text-ink-70">{p.summary}</p>}
        {p.skills.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-1.5">
            {p.skills.slice(0, 14).map((s) => (
              <span key={s} className="rounded-md bg-ink-04 px-2 py-0.5 text-[0.76rem] text-ink-70">
                {s}
              </span>
            ))}
          </div>
        )}
        {p.roles.slice(0, 2).map((r) => (
          <div key={r.index} className="mt-4">
            <p className="text-[0.82rem] font-medium">{roles[r.index] ?? "Experience"}</p>
            <ul className="mt-1.5 list-disc space-y-1 pl-5 text-[0.86rem] leading-relaxed text-ink-70">
              {r.highlights.map((h) => (
                <li key={h}>{h}</li>
              ))}
            </ul>
          </div>
        ))}
        {p.keywords_missing.length > 0 && (
          <p className="mt-4 rounded-xl bg-[#fff8eb] px-3.5 py-2.5 text-[0.8rem] leading-relaxed text-[#7a5200]">
            Not added, because your resume doesn&apos;t show them: {p.keywords_missing.join(", ")}. If you do have
            them, add them to your resume and prepare again.
          </p>
        )}
        <ResumeActions applicationId={app.id} company={company} />
      </Step>

      {/* ---------------------------------------------------- cover letter */}
      <Step n={2} title="Cover letter">
        <p className="whitespace-pre-wrap text-[0.9rem] leading-relaxed text-ink-70">{p.cover_letter}</p>
        <Copy text={p.cover_letter} label="Copy cover letter" />
      </Step>

      {/* --------------------------------------------------------- answers */}
      {p.answers.length > 0 && (
        <Step n={3} title="Answers for the application form">
          <div className="space-y-4">
            {p.answers.map((a) => (
              <div key={a.question}>
                <p className="text-[0.84rem] font-medium">{a.question}</p>
                <p className="mt-1 text-[0.88rem] leading-relaxed text-ink-70">{a.answer}</p>
                <Copy text={a.answer} label="Copy" small />
              </div>
            ))}
          </div>
        </Step>
      )}

      {/* ----------------------------------------------------------- apply */}
      <Step n={p.answers.length ? 4 : 3} title={`Apply on ${company}'s site`}>
        <p className="text-[0.88rem] leading-relaxed text-ink-50">
          Upload the tailored resume, paste the cover letter and answers, and submit. We&apos;ll keep track of it
          in your applications.
        </p>
        <ApplyButton app={app} applyUrl={applyUrl} company={company} onApplied={(a) => setApp(a)} />
      </Step>

      {p.review_notes.length > 0 && (
        <details className="rounded-2xl border border-ink-08 bg-paper px-5 py-4 text-[0.84rem] text-ink-50">
          <summary className="cursor-pointer font-medium text-ink-70">What the review pass improved</summary>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            {p.review_notes.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
        </details>
      )}

      {error && <Trouble error={error} />}
      <div className="flex flex-wrap items-center justify-between gap-3 text-[0.82rem]">
        <Link href="/app/applications" className="underline underline-offset-4">
          All my applications →
        </Link>
        <button
          type="button"
          disabled={busy}
          onClick={() => void prepare(true)}
          className="text-ink-30 underline underline-offset-4 hover:text-ink disabled:opacity-40"
        >
          {busy ? "Preparing again…" : "Prepare again"}
        </button>
      </div>
    </div>
  );
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-3xl border border-ink-08 bg-paper p-6 sm:p-7">
      <p className="text-[0.75rem] uppercase tracking-[0.12em] text-ink-30">Step {n}</p>
      <h2 className="mb-3 mt-1 text-[1.08rem] font-semibold tracking-[-0.02em]">{title}</h2>
      {children}
    </section>
  );
}

function List({ title, items, mark, color }: { title: string; items: string[]; mark: string; color: string }) {
  if (!items.length) return null;
  return (
    <div>
      <p className="text-[0.82rem] font-medium">{title}</p>
      <ul className="mt-2 space-y-1.5 text-[0.86rem] leading-relaxed text-ink-70">
        {items.map((x) => (
          <li key={x} className="flex gap-2">
            <span className={`${color} font-semibold`}>{mark}</span>
            {x}
          </li>
        ))}
      </ul>
    </div>
  );
}

function Copy({ text, label, small }: { text: string; label: string; small?: boolean }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        void navigator.clipboard?.writeText(text).then(() => {
          setDone(true);
          setTimeout(() => setDone(false), 1500);
        });
      }}
      className={
        small
          ? "mt-1 text-[0.76rem] text-ink-30 underline underline-offset-2 hover:text-ink"
          : "mt-4 rounded-full border border-ink-15 px-4 py-2 text-[0.82rem] transition-colors hover:border-ink"
      }
    >
      {done ? "Copied ✓" : label}
    </button>
  );
}

function ResumeActions({ applicationId, company }: { applicationId: string; company: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState<null | "pdf" | "edit">(null);
  const [error, setError] = useState<string | null>(null);

  async function draft(edit: boolean): Promise<string> {
    const res = await fetch(`/api/app/apply/${applicationId}/resume`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ edit }),
    });
    const json = (await res.json().catch(() => ({}))) as { ok?: boolean; draftId?: string; error?: string };
    if (!json.ok || !json.draftId) throw new Error(json.error ?? "That didn't work.");
    return json.draftId;
  }

  async function download() {
    setBusy("pdf");
    setError(null);
    try {
      const id = await draft(false);
      const res = await fetch("/api/app/resume/pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, flow: true }),
      });
      if (!res.ok) throw new Error("The PDF could not be built.");
      const url = URL.createObjectURL(await res.blob());
      const a = document.createElement("a");
      a.href = url;
      a.download = `Resume - ${company.replace(/[^\p{L}\p{N} ._-]/gu, "").trim() || "tailored"}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "That didn't work.");
    } finally {
      setBusy(null);
    }
  }

  async function edit() {
    setBusy("edit");
    setError(null);
    try {
      await draft(true);
      router.push("/app/resume/builder");
    } catch (e) {
      setError(e instanceof Error ? e.message : "That didn't work.");
      setBusy(null);
    }
  }

  return (
    <div className="mt-5">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => void download()}
          disabled={Boolean(busy)}
          className="rounded-full bg-ink px-4 py-2 text-[0.84rem] font-medium text-paper transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {busy === "pdf" ? "Preparing PDF…" : "Download tailored resume (PDF)"}
        </button>
        <button
          type="button"
          onClick={() => void edit()}
          disabled={Boolean(busy)}
          className="rounded-full border border-ink-15 px-4 py-2 text-[0.84rem] transition-colors hover:border-ink disabled:opacity-50"
        >
          {busy === "edit" ? "Opening…" : "Edit before downloading"}
        </button>
      </div>
      {error && <p className="mt-2 text-[0.8rem] text-[#c0392b]">{error}</p>}
    </div>
  );
}

function ApplyButton({
  app,
  applyUrl,
  company,
  onApplied,
}: {
  app: Application;
  applyUrl: string;
  company: string;
  onApplied: (a: Application) => void;
}) {
  const applied = app.status !== "prepared";
  return (
    <div className="mt-4 flex flex-wrap items-center gap-3">
      <a
        href={applyUrl}
        target="_blank"
        rel="noopener noreferrer nofollow"
        onClick={() => {
          if (applied) return;
          void fetch(`/api/app/apply/${app.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status: "applied" }),
          }).then((r) => r.ok && onApplied({ ...app, status: "applied", applied_at: new Date().toISOString() }));
        }}
        className="rounded-full bg-ink px-5 py-2.5 text-[0.88rem] font-medium text-paper transition-opacity hover:opacity-90"
      >
        Open {company} application ↗
      </a>
      {applied && (
        <span className="rounded-full bg-[#e7f6ec] px-3 py-1 text-[0.78rem] font-medium capitalize text-[#1a7f37]">
          {app.status}
        </span>
      )}
    </div>
  );
}

function Trouble({ error }: { error: { text: string; upgrade?: boolean; resume?: boolean } }) {
  return (
    <p className="mt-4 rounded-xl border border-ink-30 p-3 text-[0.85rem] leading-relaxed">
      {error.text}{" "}
      {error.upgrade && (
        <Link href="/app/upgrade" className="font-medium underline underline-offset-2">
          See Pro
        </Link>
      )}
      {error.resume && (
        <Link href="/app/resume" className="font-medium underline underline-offset-2">
          Add resume
        </Link>
      )}
    </p>
  );
}
