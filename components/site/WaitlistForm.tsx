"use client";

import { useState } from "react";

type Status = "idle" | "loading" | "success" | "error";

type WaitlistFormProps = {
  source: string;
  size?: "lg" | "md";
  className?: string;
};

export function WaitlistForm({
  source,
  size = "lg",
  className = "",
}: WaitlistFormProps) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState("");

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (status === "loading") return;

    setStatus("loading");
    setMessage("");

    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, source }),
      });

      const data = (await res.json()) as { ok: boolean; error?: string };

      if (!res.ok || !data.ok) {
        setStatus("error");
        setMessage(data.error ?? "Something broke. Try again in a moment.");
        return;
      }

      setStatus("success");
      setEmail("");
    } catch {
      setStatus("error");
      setMessage("Network hiccup. Try again.");
    }
  }

  const isLarge = size === "lg";

  if (status === "success") {
    return (
      <div
        className={`flex items-center gap-3 rounded-full border border-ink bg-ink px-6 py-4 text-paper ${className}`}
        role="status"
      >
        <svg
          viewBox="0 0 20 20"
          className="size-5 shrink-0"
          fill="none"
          aria-hidden="true"
        >
          <path
            d="M4 10.5l4 4 8-9"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        <p className="text-sm font-medium sm:text-base">
          You&apos;re on the list. We&apos;ll email you before we open the doors.
        </p>
      </div>
    );
  }

  return (
    <div className={className}>
      <form
        onSubmit={handleSubmit}
        className={`flex w-full flex-col gap-2 sm:flex-row sm:items-center sm:gap-0 sm:rounded-full sm:border sm:border-ink-15 sm:bg-paper sm:p-1.5 sm:shadow-[0_1px_2px_rgba(0,0,0,0.04)] sm:transition-colors sm:focus-within:border-ink`}
      >
        <label htmlFor={`waitlist-${source}`} className="sr-only">
          Email address
        </label>
        <input
          id={`waitlist-${source}`}
          type="email"
          name="email"
          required
          autoComplete="email"
          inputMode="email"
          placeholder="you@college.edu"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={`w-full rounded-full border border-ink-15 bg-paper px-5 outline-none placeholder:text-ink-30 focus:border-ink sm:flex-1 sm:border-0 sm:bg-transparent sm:focus:border-0 ${
            isLarge ? "py-4 text-base" : "py-3 text-sm"
          }`}
        />
        <button
          type="submit"
          disabled={status === "loading"}
          className={`shrink-0 rounded-full bg-ink font-medium text-paper transition-transform duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] hover:scale-[1.02] active:scale-[0.98] disabled:opacity-60 ${
            isLarge ? "px-7 py-4 text-base" : "px-5 py-3 text-sm"
          }`}
        >
          {status === "loading" ? "Adding…" : "Get early access"}
        </button>
      </form>

      {status === "error" && (
        <p className="mt-3 text-sm text-ink-70" role="alert">
          {message}
        </p>
      )}
    </div>
  );
}
