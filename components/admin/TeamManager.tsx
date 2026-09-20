"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Section } from "@/lib/admin/roles";
import type { TeamMember } from "@/lib/admin/users";
import type { MemberActivity } from "@/lib/admin/activity";

/**
 * The team screen.
 *
 * Two jobs: make a login, and change what an existing one can reach.
 *
 * The password is shown exactly once, when it is created, with a copy button
 * — it is a hash in the database a moment later and there is no way to read
 * it back. Saying so on the screen is the difference between somebody copying
 * it and somebody closing the tab and asking you for it.
 */

const WHEN = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "short",
  timeZone: "Asia/Kolkata",
});

const field =
  "w-full rounded-xl border border-ink-15 px-3 py-2 text-[0.85rem] outline-none focus:border-ink-30";

export function TeamManager({
  team,
  sections,
  activity,
}: {
  team: TeamMember[];
  sections: Section[];
  /** Keyed by member id. Missing means they have written nothing. */
  activity: Record<string, MemberActivity>;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // New-person form
  const [username, setUsername] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [picked, setPicked] = useState<string[]>(["articles"]);
  const [created, setCreated] = useState<{ username: string; password: string } | null>(null);

  async function send(payload: Record<string, unknown>) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/team", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string; password?: string };
      if (!data.ok) {
        setError(data.error ?? "That didn't work.");
        return null;
      }
      router.refresh();
      return data;
    } catch {
      setError("Could not reach the server.");
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function suggest() {
    const data = await send({ action: "suggest" });
    if (data?.password) setPassword(data.password);
  }

  async function create() {
    const data = await send({
      action: "create",
      username,
      name: name || null,
      password,
      sections: picked,
    });
    if (!data) return;
    // Shown once, here, and never again.
    setCreated({ username: username.trim().toLowerCase(), password });
    setUsername("");
    setName("");
    setPassword("");
    setPicked(["articles"]);
  }

  const toggle = (key: string) =>
    setPicked((p) => (p.includes(key) ? p.filter((k) => k !== key) : [...p, key]));

  return (
    <div className="space-y-10">
      {/* ------------------------------------------------- the new password */}
      {created && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6">
          <p className="text-[0.95rem] font-semibold text-emerald-900">
            Login created. Send them these now.
          </p>
          <p className="mt-1.5 text-[0.82rem] leading-relaxed text-emerald-800">
            The password is stored scrambled, so this is the only time it can be
            shown. Close this box and it is gone for good — you would have to
            set a new one.
          </p>

          <div className="mt-4 space-y-2">
            <Copyable label="Username" value={created.username} />
            <Copyable label="Password" value={created.password} />
            <Copyable label="Sign in at" value="cheatcodeapp.com/admin-login" />
          </div>

          <button
            type="button"
            onClick={() => setCreated(null)}
            className="mt-4 text-[0.82rem] text-emerald-900 underline underline-offset-4"
          >
            I have sent them
          </button>
        </div>
      )}

      {/* ------------------------------------------------------- new person */}
      <section className="rounded-2xl border border-ink-08 p-6">
        <h2 className="text-[0.72rem] font-medium uppercase tracking-[0.16em] text-ink-30">
          Add someone
        </h2>

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1.5 block text-[0.78rem] text-ink-50">Username</span>
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="instinct"
              autoComplete="off"
              className={field}
            />
            <span className="mt-1 block text-[0.72rem] text-ink-30">
              Lowercase, no spaces. This is what they type to sign in.
            </span>
          </label>

          <label className="block">
            <span className="mb-1.5 block text-[0.78rem] text-ink-50">
              Name <span className="text-ink-30">— for your own reference</span>
            </span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Instinct — content agency"
              className={field}
            />
          </label>
        </div>

        <div className="mt-4">
          <span className="mb-1.5 block text-[0.78rem] text-ink-50">Password</span>
          <div className="flex flex-wrap items-center gap-2.5">
            <input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 10 characters, letters and numbers"
              autoComplete="new-password"
              className={`${field} flex-1`}
            />
            <button
              type="button"
              onClick={() => void suggest()}
              disabled={busy}
              className="shrink-0 rounded-full border border-ink-15 px-4 py-2 text-[0.8rem] transition-colors hover:border-ink-30 disabled:opacity-40"
            >
              Generate
            </button>
          </div>
        </div>

        <div className="mt-6">
          <span className="block text-[0.78rem] text-ink-50">What can they reach?</span>
          <div className="mt-3 grid gap-2.5 sm:grid-cols-2">
            {sections.map((s) => (
              <label
                key={s.key}
                className={`flex cursor-pointer gap-3 rounded-xl border p-3.5 transition-colors ${
                  picked.includes(s.key) ? "border-ink bg-ink-04" : "border-ink-08 hover:border-ink-15"
                }`}
              >
                <input
                  type="checkbox"
                  checked={picked.includes(s.key)}
                  onChange={() => toggle(s.key)}
                  className="mt-0.5 size-4 shrink-0 accent-black"
                />
                <span className="min-w-0">
                  <span className="block text-[0.85rem] font-medium">{s.label}</span>
                  <span className="mt-0.5 block text-[0.75rem] leading-relaxed text-ink-50">
                    {s.detail}
                  </span>
                </span>
              </label>
            ))}
          </div>
        </div>

        {error && (
          <p className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-[0.8rem] text-red-700">
            {error}
          </p>
        )}

        <button
          type="button"
          onClick={() => void create()}
          disabled={busy || username.trim().length < 3 || password.length < 10 || picked.length === 0}
          className="mt-6 rounded-full bg-ink px-5 py-2.5 text-[0.85rem] font-medium text-paper transition-opacity hover:opacity-90 disabled:opacity-40"
        >
          {busy ? "Creating…" : "Create login"}
        </button>
      </section>

      {/* ----------------------------------------------------------- people */}
      <section>
        <h2 className="text-[0.72rem] font-medium uppercase tracking-[0.16em] text-ink-30">
          People with access
        </h2>

        {team.length === 0 ? (
          <p className="mt-5 text-[0.85rem] leading-relaxed text-ink-30">
            Nobody yet. You are the only one who can get in.
          </p>
        ) : (
          <ul className="mt-5 space-y-3">
            {team.map((m) => (
              <Member
                key={m.id}
                member={m}
                sections={sections}
                busy={busy}
                send={send}
                activity={activity[m.id]}
              />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

/* ---------------------------------------------------------------- pieces */

function Member({
  member,
  sections,
  busy,
  send,
  activity,
}: {
  member: TeamMember;
  sections: Section[];
  busy: boolean;
  send: (payload: Record<string, unknown>) => Promise<unknown>;
  activity?: MemberActivity;
}) {
  const [open, setOpen] = useState(false);
  const [showWork, setShowWork] = useState(false);
  const [picked, setPicked] = useState<string[]>(member.sections);
  const [newPassword, setNewPassword] = useState("");

  const toggle = (key: string) =>
    setPicked((p) => (p.includes(key) ? p.filter((k) => k !== key) : [...p, key]));

  const labels = sections
    .filter((s) => member.sections.includes(s.key))
    .map((s) => s.label);

  return (
    <li className="rounded-2xl border border-ink-08 p-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-2 text-[0.9rem] font-semibold">
            {member.username}
            {!member.isActive && (
              <span className="rounded-full bg-ink-04 px-2 py-0.5 text-[0.68rem] font-medium text-ink-50">
                Switched off
              </span>
            )}
          </p>
          {member.name && <p className="text-[0.78rem] text-ink-50">{member.name}</p>}
          <p className="mt-1.5 text-[0.76rem] text-ink-30">
            {labels.length ? labels.join(" · ") : "No access"}
          </p>
          <p className="mt-0.5 text-[0.72rem] text-ink-30">
            {member.lastLoginAt
              ? `Last signed in ${WHEN.format(new Date(member.lastLoginAt))}`
              : "Never signed in"}
          </p>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setShowWork((v) => !v)}
            className="rounded-lg border border-ink-08 px-2.5 py-1.5 text-[0.75rem] text-ink-50 transition-colors hover:bg-ink-04 hover:text-ink"
          >
            {showWork ? "Hide work" : "See work"}
          </button>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="rounded-lg border border-ink-08 px-2.5 py-1.5 text-[0.75rem] text-ink-50 transition-colors hover:bg-ink-04 hover:text-ink"
          >
            {open ? "Close" : "Change"}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void send({ action: "update", id: member.id, isActive: !member.isActive })}
            className="rounded-lg border border-ink-08 px-2.5 py-1.5 text-[0.75rem] text-ink-50 transition-colors hover:bg-ink-04 hover:text-ink disabled:opacity-40"
          >
            {member.isActive ? "Switch off" : "Switch on"}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              if (!confirm(`Remove ${member.username}? They lose access immediately.`)) return;
              void send({ action: "delete", id: member.id });
            }}
            className="rounded-lg border border-ink-08 px-2.5 py-1.5 text-[0.75rem] text-ink-30 transition-colors hover:border-red-200 hover:bg-red-50 hover:text-red-700 disabled:opacity-40"
          >
            Remove
          </button>
        </div>
      </div>

      {/* What they have actually put on the site. Four numbers and a
          fortnight of bars — enough to answer "are they keeping up" without
          opening anything. */}
      {activity && activity.total > 0 && (
        <div className="mt-4 border-t border-ink-08 pt-4">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
            <Count label="Today" value={activity.today} />
            <Count label="7 days" value={activity.week} />
            <Count label="30 days" value={activity.month} />
            <Count label="All time" value={activity.total} />
            <Sparkline daily={activity.daily} />
          </div>
        </div>
      )}

      {showWork && (
        <div className="mt-4 border-t border-ink-08 pt-4">
          {!activity || activity.recent.length === 0 ? (
            <p className="text-[0.82rem] leading-relaxed text-ink-30">
              Nothing published yet.
            </p>
          ) : (
            <ul className="space-y-2">
              {activity.recent.map((post) => (
                <li
                  key={post.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-ink-04 px-3.5 py-2.5"
                >
                  <span className="min-w-0">
                    <a
                      href={`/admin/posts/${post.slug}`}
                      className="block truncate text-[0.84rem] font-medium hover:underline"
                    >
                      {post.title}
                    </a>
                    <span className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[0.73rem] text-ink-30">
                      <span>{WHEN.format(new Date(post.createdAt))}</span>
                      <span>·</span>
                      <span>{post.words.toLocaleString("en-IN")} words</span>
                      {post.editedByOther && (
                        <>
                          <span>·</span>
                          <span>edited by someone else since</span>
                        </>
                      )}
                    </span>
                  </span>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-[0.7rem] font-medium ${
                      post.status === "published"
                        ? "bg-emerald-50 text-emerald-700"
                        : "bg-ink-08 text-ink-50"
                    }`}
                  >
                    {post.status === "published" ? "Live" : "Draft"}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-3 text-[0.72rem] leading-relaxed text-ink-30">
            Counted by the day the article was created, in IST. Last 90 days.
          </p>
        </div>
      )}

      {open && (
        <div className="mt-4 border-t border-ink-08 pt-4">
          <span className="block text-[0.78rem] text-ink-50">What they can reach</span>
          <div className="mt-2.5 flex flex-wrap gap-2">
            {sections.map((s) => (
              <button
                key={s.key}
                type="button"
                onClick={() => toggle(s.key)}
                aria-pressed={picked.includes(s.key)}
                className={`rounded-full border px-3 py-1.5 text-[0.79rem] transition-colors ${
                  picked.includes(s.key)
                    ? "border-ink bg-ink text-paper"
                    : "border-ink-15 text-ink-50 hover:border-ink-30 hover:text-ink"
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2.5">
            <input
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Set a new password (optional)"
              autoComplete="new-password"
              className={`${field} max-w-[280px] flex-1`}
            />
            <button
              type="button"
              disabled={busy}
              onClick={async () => {
                await send({
                  action: "update",
                  id: member.id,
                  sections: picked,
                  password: newPassword || undefined,
                });
                setNewPassword("");
                setOpen(false);
              }}
              className="rounded-full bg-ink px-4 py-2 text-[0.82rem] font-medium text-paper transition-opacity hover:opacity-90 disabled:opacity-40"
            >
              Save
            </button>
          </div>
          <p className="mt-2 text-[0.72rem] leading-relaxed text-ink-30">
            Changes apply the next time they load a page — they do not have to
            sign in again.
          </p>
        </div>
      )}
    </li>
  );
}

function Count({ label, value }: { label: string; value: number }) {
  return (
    <span>
      <span className="block text-[0.68rem] uppercase tracking-[0.12em] text-ink-30">
        {label}
      </span>
      <span className="block text-[1.1rem] font-semibold tabular-nums leading-tight">
        {value}
      </span>
    </span>
  );
}

/**
 * Fourteen bars, one per day.
 *
 * Deliberately not a chart library. The question is "have they gone quiet",
 * and fourteen divs answer it as well as an axis and a tooltip would, at no
 * cost to the bundle.
 */
function Sparkline({ daily }: { daily: { date: string; count: number }[] }) {
  if (daily.length === 0) return null;
  const peak = Math.max(1, ...daily.map((d) => d.count));

  return (
    <span className="ml-auto flex h-9 items-end gap-[3px]" aria-hidden>
      {daily.map((d) => (
        <span
          key={d.date}
          title={`${d.date}: ${d.count}`}
          className={`w-[7px] rounded-sm ${d.count ? "bg-ink" : "bg-ink-08"}`}
          style={{ height: d.count ? `${Math.max(18, (d.count / peak) * 100)}%` : "3px" }}
        />
      ))}
    </span>
  );
}

function Copyable({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-emerald-200 bg-paper px-3 py-2">
      <span className="min-w-0">
        <span className="block text-[0.7rem] uppercase tracking-[0.12em] text-ink-30">
          {label}
        </span>
        <span className="block truncate font-mono text-[0.85rem]">{value}</span>
      </span>
      <button
        type="button"
        onClick={() => {
          void navigator.clipboard?.writeText(value);
          setCopied(true);
          window.setTimeout(() => setCopied(false), 1600);
        }}
        className="shrink-0 rounded-full border border-ink-15 px-3 py-1.5 text-[0.75rem] transition-colors hover:border-ink-30"
      >
        {copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
}
