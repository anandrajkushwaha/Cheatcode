"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createAppBrowserClient } from "@/lib/supabase/app-client";
import type { Profile } from "@/lib/app/account";
import { CANONICAL_CITIES } from "@/lib/geo/cities";


/**
 * Written straight to Supabase from the browser rather than through an API
 * route. That is safe here and only here: the update policy on `profiles`
 * pins the row to auth.uid() and freezes the plan columns, so the database
 * refuses anything this form should not be able to do. Adding a route in
 * front would just be a second place to get the same rules wrong.
 */
export function ProfileForm({
  profile,
  resumeHint,
}: {
  profile: Profile;
  resumeHint: { title: string | null; company: string | null; years: number | null } | null;
}) {
  const router = useRouter();
  const [form, setForm] = useState({
    full_name: profile.full_name ?? "",
    headline: profile.headline ?? "",
    current_title: profile.current_title ?? resumeHint?.title ?? "",
    current_company: profile.current_company ?? resumeHint?.company ?? "",
    years_experience: profile.years_experience ?? resumeHint?.years ?? null,
    expected_ctc: profile.expected_ctc,
    notice_period_days: profile.notice_period_days,
    target_roles: profile.target_roles ?? [],
    preferred_cities: profile.preferred_cities ?? [],
    open_to_remote: profile.open_to_remote,
  });
  const [rolesText, setRolesText] = useState((profile.target_roles ?? []).join(", "));
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);

  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const toggleCity = (city: string) =>
    set(
      "preferred_cities",
      form.preferred_cities.includes(city)
        ? form.preferred_cities.filter((c) => c !== city)
        : [...form.preferred_cities, city],
    );

  async function save() {
    setBusy(true);
    setNote(null);
    try {
      const supabase = createAppBrowserClient();
      const roles = rolesText
        .split(",")
        .map((r) => r.trim())
        .filter(Boolean)
        .slice(0, 10);

      const { error } = await supabase
        .from("profiles")
        .update({
          full_name: form.full_name.trim() || null,
          headline: form.headline.trim() || null,
          current_title: form.current_title.trim() || null,
          current_company: form.current_company.trim() || null,
          years_experience: form.years_experience,
          expected_ctc: form.expected_ctc,
          notice_period_days: form.notice_period_days,
          target_roles: roles,
          preferred_cities: form.preferred_cities,
          open_to_remote: form.open_to_remote,
          onboarded_at: profile.onboarded_at ?? new Date().toISOString(),
        })
        .eq("id", profile.id);

      if (error) throw error;
      setForm((f) => ({ ...f, target_roles: roles }));
      setNote({ ok: true, text: "Saved." });
      router.refresh();
    } catch (e) {
      setNote({ ok: false, text: e instanceof Error ? e.message : "Could not save." });
    } finally {
      setBusy(false);
    }
  }

  const field =
    "w-full rounded-xl border border-ink-15 px-3.5 py-2.5 text-[0.92rem] outline-none focus:border-ink-30";
  const label = "text-[0.75rem] text-ink-50";

  /** Empty means "not answered", which is different from zero. */
  const numberOrNull = (v: string) => {
    const n = Number(v.replace(/[^\d.]/g, ""));
    return v.trim() === "" || Number.isNaN(n) ? null : n;
  };

  return (
    <div className="space-y-8">
      <section className="space-y-4">
        <h2 className="text-[0.72rem] font-medium uppercase tracking-[0.16em] text-ink-30">You</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className={label}>Name</span>
            <input
              value={form.full_name}
              onChange={(e) => set("full_name", e.target.value)}
              className={`mt-1.5 ${field}`}
            />
          </label>
          <label className="block">
            <span className={label}>Years of experience</span>
            <input
              inputMode="decimal"
              value={form.years_experience ?? ""}
              onChange={(e) => set("years_experience", numberOrNull(e.target.value))}
              placeholder="0 if you're a fresher"
              className={`mt-1.5 ${field}`}
            />
          </label>
        </div>

        <label className="block">
          <span className={label}>Headline</span>
          <input
            value={form.headline}
            onChange={(e) => set("headline", e.target.value)}
            placeholder="Backend engineer, 3 years, Java and Spring"
            className={`mt-1.5 ${field}`}
          />
        </label>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className={label}>Current title</span>
            <input
              value={form.current_title}
              onChange={(e) => set("current_title", e.target.value)}
              className={`mt-1.5 ${field}`}
            />
          </label>
          <label className="block">
            <span className={label}>Current company</span>
            <input
              value={form.current_company}
              onChange={(e) => set("current_company", e.target.value)}
              className={`mt-1.5 ${field}`}
            />
          </label>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-[0.72rem] font-medium uppercase tracking-[0.16em] text-ink-30">
          What you want
        </h2>

        <label className="block">
          <span className={label}>Target roles · comma separated</span>
          <input
            value={rolesText}
            onChange={(e) => setRolesText(e.target.value)}
            placeholder="Backend Engineer, Java Developer, SDE 1"
            className={`mt-1.5 ${field}`}
          />
        </label>

        <div>
          <span className={label}>Cities you would work in</span>
          <div className="mt-2 flex flex-wrap gap-2">
            {CANONICAL_CITIES.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => toggleCity(c)}
                className={`rounded-full px-3.5 py-1.5 text-[0.8rem] transition-colors ${
                  form.preferred_cities.includes(c)
                    ? "bg-ink text-paper"
                    : "border border-ink-15 text-ink-50 hover:border-ink-30"
                }`}
              >
                {c}
              </button>
            ))}
          </div>
          <label className="mt-4 flex items-center gap-2.5 text-[0.88rem]">
            <input
              type="checkbox"
              checked={form.open_to_remote}
              onChange={(e) => set("open_to_remote", e.target.checked)}
              className="h-4 w-4 accent-black"
            />
            Also open to remote
          </label>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className={label}>Expected CTC · ₹ per year</span>
            <input
              inputMode="numeric"
              value={form.expected_ctc ?? ""}
              onChange={(e) => set("expected_ctc", numberOrNull(e.target.value))}
              placeholder="1200000"
              className={`mt-1.5 ${field}`}
            />
          </label>
          <label className="block">
            <span className={label}>Notice period · days</span>
            <input
              inputMode="numeric"
              value={form.notice_period_days ?? ""}
              onChange={(e) => set("notice_period_days", numberOrNull(e.target.value))}
              placeholder="60"
              className={`mt-1.5 ${field}`}
            />
          </label>
        </div>
        <p className="text-[0.78rem] leading-relaxed text-ink-30">
          Your expected CTC is only ever used to filter jobs for you. It is never shown to anyone
          and never sent to an employer.
        </p>
      </section>

      <div className="flex items-center gap-4 border-t border-ink-08 pt-6">
        <button
          type="button"
          onClick={() => void save()}
          disabled={busy}
          className="rounded-full bg-ink px-5 py-2.5 text-[0.88rem] font-medium text-paper disabled:opacity-40"
        >
          {busy ? "Saving…" : "Save"}
        </button>
        {note && (
          <span className={`text-[0.85rem] ${note.ok ? "text-ink-50" : "text-ink"}`}>
            {note.text}
          </span>
        )}
      </div>
    </div>
  );
}
