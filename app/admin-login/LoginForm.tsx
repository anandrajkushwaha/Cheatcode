"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") || "/admin";

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error ?? "Sign in failed.");
        setLoading(false);
        return;
      }
      router.replace(next);
      router.refresh();
    } catch {
      setError("Network error. Try again.");
      setLoading(false);
    }
  }

  const field =
    "w-full rounded-xl border border-ink-15 bg-paper px-4 py-3 text-[0.95rem] outline-none placeholder:text-ink-30 focus:border-ink";

  return (
    <form onSubmit={onSubmit} className="mt-8 space-y-3">
      <div>
        <label htmlFor="u" className="sr-only">Username</label>
        <input
          id="u"
          name="username"
          autoComplete="username"
          required
          placeholder="Username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          className={field}
        />
      </div>
      <div>
        <label htmlFor="p" className="sr-only">Password</label>
        <input
          id="p"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className={field}
        />
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-xl bg-ink py-3 text-[0.95rem] font-medium text-paper disabled:opacity-60"
      >
        {loading ? "Signing in…" : "Sign in"}
      </button>

      {error && (
        <p role="alert" className="pt-1 text-[0.85rem] text-ink-70">
          {error}
        </p>
      )}
    </form>
  );
}
