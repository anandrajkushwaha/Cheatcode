"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/**
 * Anything that opens an interview.
 *
 * One component for the topic chips, the job cards and the big button,
 * because all three do exactly the same thing: POST, wait through a model
 * call, then navigate. Three copies of that would be three places to forget
 * the error handling.
 *
 * The wait is real — writing four questions takes a few seconds — so the
 * button says what is happening rather than just going grey.
 */
export function StartButton({
  topic,
  jobId,
  kind = "topic",
  className = "",
  children,
  busyLabel = "Writing your questions…",
}: {
  topic?: string;
  jobId?: string;
  kind?: "topic" | "role" | "job";
  className?: string;
  children: React.ReactNode;
  busyLabel?: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function start() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/app/interview/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic, jobId, kind }),
      });
      const data = (await res.json()) as { ok?: boolean; id?: string; error?: string };
      if (!data.ok || !data.id) {
        setError(data.error ?? "Could not start that interview.");
        setBusy(false);
        return;
      }
      router.push(`/app/interviews/${data.id}`);
    } catch {
      setError("Could not reach the server.");
      setBusy(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={start}
        disabled={busy}
        className={`${className} disabled:opacity-60`}
      >
        {busy ? busyLabel : children}
      </button>
      {error && (
        <p className="mt-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-[0.78rem] leading-relaxed text-red-700">
          {error}
        </p>
      )}
    </>
  );
}
