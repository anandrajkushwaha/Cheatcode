"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type State = "idle" | "running" | "done" | "error";

export function SeedButton({ hasPosts }: { hasPosts: boolean }) {
  const router = useRouter();
  const [state, setState] = useState<State>("idle");
  const [message, setMessage] = useState("");
  const [progress, setProgress] = useState(0);

  async function run() {
    setState("running");
    setMessage("Starting…");
    setProgress(0);

    let step: string | undefined = "taxonomy";
    let guard = 0;

    while (step && guard < 40) {
      guard += 1;
      try {
        const res: Response = await fetch("/api/admin/seed", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ step }),
        });
        const data = (await res.json()) as {
          ok: boolean;
          done?: boolean;
          next?: string;
          message?: string;
          progress?: number;
          error?: string;
        };

        if (!res.ok || !data.ok) {
          setState("error");
          setMessage(data.error ?? `Failed at step "${step}".`);
          return;
        }

        if (data.message) setMessage(data.message);
        if (typeof data.progress === "number") setProgress(data.progress);

        if (data.done) {
          setState("done");
          setProgress(100);
          router.refresh();
          return;
        }
        step = data.next;
      } catch {
        setState("error");
        setMessage("Network error. The deployment may have restarted — try again.");
        return;
      }
    }

    setState("error");
    setMessage("Stopped after too many steps. Run it again.");
  }

  return (
    <div className="rounded-2xl border border-ink-08 p-6">
      <p className="text-[1.05rem] font-medium tracking-[-0.02em]">
        {hasPosts ? "Re-sync content from the deployment" : "Load the launch content"}
      </p>
      <p className="mt-2 max-w-[62ch] text-[0.88rem] leading-relaxed text-ink-50">
        {hasPosts
          ? "Re-runs the import. Existing articles are updated in place, never duplicated."
          : "Imports 10 topics, 40 launch articles and 195 queued keywords from the files shipped with this deployment. Safe to run more than once."}
      </p>

      <button
        onClick={run}
        disabled={state === "running"}
        className="mt-5 rounded-full bg-ink px-5 py-2.5 text-[0.85rem] font-medium text-paper transition-opacity disabled:opacity-60"
      >
        {state === "running"
          ? "Importing…"
          : hasPosts
            ? "Re-sync content"
            : "Import content now"}
      </button>

      {state !== "idle" && (
        <div className="mt-5">
          <div className="h-1.5 overflow-hidden rounded-full bg-ink-08">
            <div
              className="h-full rounded-full bg-ink transition-[width] duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p
            className={`mt-3 text-[0.85rem] ${
              state === "error" ? "text-ink" : "text-ink-50"
            }`}
            role="status"
          >
            {state === "error" ? `Failed: ${message}` : message}
          </p>
          {state === "done" && (
            <p className="mt-1.5 text-[0.85rem] text-ink-50">
              The blog may take up to 5 minutes to show them, or redeploy from Vercel to see
              them immediately.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
