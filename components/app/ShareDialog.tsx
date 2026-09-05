"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * Share, and mean it.
 *
 * The easy version of this dialog is a row of icons where "Copy link" copies
 * something that does not work yet. That is worse than no share button: it
 * fails at the one moment somebody is trying to send their resume to an
 * employer, and they find out from the employer.
 *
 * So everything here is real. Switching sharing on mints an unguessable
 * address and publishes the document at `/r/<id>`; switching it off takes it
 * down and keeps the address, so turning it back on later does not break a URL
 * already sitting in somebody's inbox. Inviting an email address writes a row
 * that the public route checks before it hands anybody a pen. WhatsApp and
 * email are that same link handed to the app that will send it, which is all
 * either of them can honestly be.
 *
 * Two grants, kept visibly apart, because they have completely different blast
 * radii. **People** is a list of named addresses — each one a decision about
 * one human being, each one revocable without touching the others. **The link**
 * is a single switch that applies to everybody it has ever been forwarded to,
 * which is why it says "Can view" unless somebody deliberately moves it and
 * why moving it prints a sentence saying what that means. Canva puts the same
 * two things in the same order, and it is the order people think in: who
 * specifically, and then everybody else.
 *
 * Download hands off to the editor, which asks the server for a real PDF
 * printed from the same renderer the screen uses. It is not a print dialog and
 * it is not a second renderer — those were the two ways this could have gone
 * wrong, and both of them end with a file that is not the document.
 */

type Role = "view" | "edit";
type Person = { id: string; email: string; role: Role };

type Props = {
  draftId: string;
  shareId: string | null;
  isPublic: boolean;
  linkRole: Role;
  /** Shown as "you" at the top of the list, the way every share sheet does. */
  ownerEmail: string | null;
  /** Unsaved edits would not be in the shared copy, so say so. */
  dirty: boolean;
  onSave: () => Promise<void>;
  /** Builds and saves the PDF. Owned by the editor, because it knows the design. */
  onDownload: () => void;
  onClose: () => void;
};

export function ShareDialog({
  draftId,
  shareId,
  isPublic,
  linkRole,
  ownerEmail,
  dirty,
  onSave,
  onDownload,
  onClose,
}: Props) {
  const [on, setOn] = useState(isPublic);
  const [role, setRole] = useState<Role>(linkRole);
  const [id, setId] = useState(shareId);
  const [people, setPeople] = useState<Person[]>([]);
  const [invitee, setInvitee] = useState("");
  const [inviteRole, setInviteRole] = useState<Role>("edit");
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // The guest list is read from the server rather than passed in, because it
  // is the one thing on this screen that another device could have changed
  // since the page was rendered.
  useEffect(() => {
    let live = true;
    void fetch(`/api/app/resume/people?id=${encodeURIComponent(draftId)}`)
      .then((r) => r.json())
      .then((json: { ok?: boolean; people?: Person[] }) => {
        if (live && json.ok) setPeople(json.people ?? []);
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [draftId]);

  const origin = typeof window === "undefined" ? "" : window.location.origin;
  const url = id ? `${origin}/r/${id}` : null;

  /**
   * One request for both switches.
   *
   * Publishing and "what does the link give you" are the same row in the
   * database, and sending them as two requests would leave the screen showing,
   * for a moment, either an edit link that is not published or a published
   * link whose role has not landed yet.
   */
  const publish = useCallback(
    async (next: { on?: boolean; role?: Role }) => {
      setBusy(true);
      setError(null);
      try {
        // Publish what is on screen, not what was last saved. Somebody who
        // edits and immediately shares would otherwise send the previous
        // version and have no way of knowing.
        if (next.on !== false && dirty) await onSave();

        const res = await fetch("/api/app/resume/share", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: draftId,
            on: next.on ?? on,
            linkRole: next.role ?? role,
          }),
        });
        const json = (await res.json()) as {
          ok?: boolean;
          error?: string;
          shareId?: string | null;
          isPublic?: boolean;
          linkRole?: Role;
          people?: Person[];
        };
        if (!json.ok) throw new Error(json.error ?? "That didn't work.");
        setId(json.shareId ?? null);
        setOn(Boolean(json.isPublic));
        setRole(json.linkRole === "edit" ? "edit" : "view");
        if (json.people) setPeople(json.people);
      } catch (e) {
        setError(e instanceof Error ? e.message : "That didn't work.");
      } finally {
        setBusy(false);
      }
    },
    [draftId, dirty, on, role, onSave],
  );

  /** Every guest-list action, so all three report the server's answer. */
  async function guests(body: Record<string, unknown>, said: string) {
    setBusy(true);
    setError(null);
    setNote(null);
    try {
      const res = await fetch("/api/app/resume/people", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: draftId, ...body }),
      });
      const json = (await res.json()) as { ok?: boolean; error?: string; people?: Person[] };
      if (!json.ok) throw new Error(json.error ?? "That didn't work.");
      setPeople(json.people ?? []);
      setNote(said);
    } catch (e) {
      setError(e instanceof Error ? e.message : "That didn't work.");
    } finally {
      setBusy(false);
    }
  }

  async function invite() {
    const email = invitee.trim();
    if (!email) return;
    // An invite nobody can act on is a dead end, so the link comes on with it.
    // The invited person still has to sign in as that address to use it.
    if (!on) await publish({ on: true });
    await guests(
      { email, role: inviteRole },
      inviteRole === "edit"
        ? `${email} can edit this resume once they sign in with that address.`
        : `${email} can view this resume.`,
    );
    setInvitee("");
  }

  async function copy() {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      setError("Couldn't copy. Select the link and copy it by hand.");
    }
  }

  return (
    <div
      className="no-print fixed inset-0 z-50 grid place-items-center bg-black/45 p-4 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-label="Share this resume"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="max-h-[92vh] w-full max-w-[468px] overflow-y-auto rounded-[20px] bg-paper p-5 shadow-[0_2px_8px_rgba(0,0,0,0.08),0_24px_64px_-16px_rgba(0,0,0,0.35)]">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-[1.02rem] font-semibold tracking-[-0.02em]">Share this resume</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="-m-1 rounded-full p-1.5 text-ink-30 transition-colors hover:bg-ink-04 hover:text-ink"
          >
            <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
              <path d="M4 4l8 8M12 4l-8 8" />
            </svg>
          </button>
        </div>

        {/* -------------------------------------------------------- invite */}
        <div className="mt-4 flex items-center gap-1 rounded-xl border border-ink-15 p-1 pl-3 transition-colors focus-within:border-ink-30">
          <svg viewBox="0 0 20 20" className="h-4 w-4 shrink-0 text-ink-30" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 5.5h14v9H3z" />
            <path d="m3 6 7 5 7-5" />
          </svg>
          <input
            type="email"
            value={invitee}
            onChange={(e) => setInvitee(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void invite();
              }
            }}
            placeholder="Add people by email"
            className="min-w-0 flex-1 bg-transparent py-2 text-[0.86rem] outline-none placeholder:text-ink-30"
          />
          <Choice
            value={inviteRole}
            onChange={setInviteRole}
            options={[
              ["edit", "Can edit"],
              ["view", "Can view"],
            ]}
          />
          <button
            type="button"
            onClick={() => void invite()}
            disabled={busy || !invitee.trim()}
            className="shrink-0 rounded-lg bg-ink px-3 py-1.5 text-[0.8rem] font-semibold text-paper transition-transform hover:scale-[1.03] disabled:opacity-35 disabled:hover:scale-100"
          >
            Invite
          </button>
        </div>

        {/* ------------------------------------------------ who has access */}
        <p className="mt-5 text-[0.72rem] font-semibold uppercase tracking-[0.08em] text-ink-30">
          People with access
        </p>

        <ul className="mt-2 space-y-0.5">
          <li className="flex items-center gap-3 rounded-lg px-1 py-1.5">
            <Avatar email={ownerEmail ?? "you"} />
            <span className="min-w-0 flex-1 truncate text-[0.86rem] font-medium">
              {ownerEmail ?? "You"} <span className="font-normal text-ink-30">(you)</span>
            </span>
            <span className="shrink-0 pr-1 text-[0.8rem] text-ink-50">Owner</span>
          </li>

          {people.map((p) => (
            <li key={p.id} className="flex items-center gap-3 rounded-lg px-1 py-1.5">
              <Avatar email={p.email} />
              <span className="min-w-0 flex-1 truncate text-[0.86rem]">{p.email}</span>
              <Choice
                value={p.role}
                onChange={(v) =>
                  void guests({ email: p.email, role: v }, `${p.email} can now ${v} this resume.`)
                }
                options={[
                  ["edit", "Can edit"],
                  ["view", "Can view"],
                ]}
              />
              <button
                type="button"
                aria-label={`Remove ${p.email}`}
                onClick={() => void guests({ action: "remove", personId: p.id }, `${p.email} removed.`)}
                className="shrink-0 rounded-md p-1 text-ink-30 transition-colors hover:bg-ink-04 hover:text-ink"
              >
                <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
                  <path d="M4 4l8 8M12 4l-8 8" />
                </svg>
              </button>
            </li>
          ))}
        </ul>

        {/* ---------------------------------------------------- the link */}
        <p className="mt-5 text-[0.72rem] font-semibold uppercase tracking-[0.08em] text-ink-30">
          Access level
        </p>

        <div className="mt-2 flex items-center gap-1 rounded-xl border border-ink-08 bg-ink-04 px-3 py-2">
          <svg viewBox="0 0 20 20" className="h-4 w-4 shrink-0 text-ink-50" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M8.6 11.4a3 3 0 0 0 4.2 0l2.4-2.4a3 3 0 1 0-4.2-4.2l-.7.7" />
            <path d="M11.4 8.6a3 3 0 0 0-4.2 0l-2.4 2.4a3 3 0 1 0 4.2 4.2l.7-.7" />
          </svg>

          <Choice
            value={on ? "on" : "off"}
            onChange={(v) => void publish({ on: v === "on" })}
            options={[
              ["on", "Anyone with the link"],
              ["off", "Only people I invite"],
            ]}
          />

          <span className="flex-1" />

          {on && (
            <Choice
              value={role}
              onChange={(v) => void publish({ role: v })}
              options={[
                ["view", "Can view"],
                ["edit", "Can edit"],
              ]}
            />
          )}
        </div>

        {on && role === "edit" && (
          <p className="mt-2 text-[0.78rem] leading-relaxed text-ink-50">
            Anybody holding this link can change the resume, not only the people you invited. They
            have to sign in first, so every change has a name on it — but if you meant one person,
            invite them above and leave this on <b>Can view</b>.
          </p>
        )}

        {on && url && (
          <div className="mt-3 flex items-center gap-2">
            <input
              readOnly
              value={url}
              onFocus={(e) => e.currentTarget.select()}
              className="min-w-0 flex-1 rounded-xl border border-ink-08 bg-paper px-3 py-2.5 text-[0.8rem] text-ink-50 outline-none"
            />
            <button
              type="button"
              onClick={() => void copy()}
              className="shrink-0 rounded-xl bg-ink px-4 py-2.5 text-[0.82rem] font-semibold text-paper transition-transform hover:scale-[1.03]"
            >
              {copied ? "Copied" : "Copy link"}
            </button>
          </div>
        )}

        {on && dirty && (
          <p className="mt-2 text-[0.78rem] text-ink-50">
            You have unsaved changes. Save before sending the link, or it will show the last saved
            version.
          </p>
        )}

        {error && <p className="mt-3 text-[0.82rem] text-ink">{error}</p>}
        {!error && note && <p className="mt-3 text-[0.82rem] text-ink-50">{note}</p>}

        {/* --------------------------------------------------------- ways */}
        <div className="mt-5 grid grid-cols-5 gap-1 border-t border-ink-08 pt-4">
          <Way label="Download" onClick={onDownload}>
            <path d="M10 3v9m0 0 3.5-3.5M10 12 6.5 8.5" />
            <path d="M3.5 14v2.5h13V14" />
          </Way>

          <Way label="Print" onClick={() => window.print()}>
            <path d="M6 8V3.5h8V8" />
            <path d="M4.5 8h11v5h-2v3.5h-7V13h-2z" />
          </Way>

          <Way
            label="WhatsApp"
            disabled={!on || !url}
            onClick={() =>
              url &&
              window.open(
                `https://wa.me/?text=${encodeURIComponent(`My resume: ${url}`)}`,
                "_blank",
                "noopener,noreferrer",
              )
            }
          >
            <path d="M4 16l1-3a6 6 0 1 1 2.4 2.2L4 16Z" />
          </Way>

          <Way
            label="Email"
            disabled={!on || !url}
            onClick={() => {
              if (!url) return;
              // A mail draft, not a sent message. Nothing leaves without the
              // person pressing send in their own client.
              window.location.href = `mailto:?subject=${encodeURIComponent("My resume")}&body=${encodeURIComponent(url)}`;
            }}
          >
            <path d="M3 5.5h14v9H3z" />
            <path d="m3 6 7 5 7-5" />
          </Way>

          <Way
            label="Open link"
            disabled={!on || !url}
            onClick={() => url && window.open(url, "_blank", "noopener,noreferrer")}
          >
            <path d="M11 4h5v5" />
            <path d="M16 4 9 11" />
            <path d="M15 12v4H4V5h4" />
          </Way>

        </div>

        {!on && (
          <p className="mt-3 text-[0.78rem] leading-relaxed text-ink-30">
            Download and print work either way. Sending needs a link, so switch it on above.
          </p>
        )}
      </div>
    </div>
  );
}

/**
 * A dropdown that reads as a word.
 *
 * A native `<select>` with its arrow suppressed rather than a hand-built
 * popover, because this sits inside a list that scrolls and a dialog that
 * already traps focus — a custom listbox here would be three accessibility
 * bugs and a z-index argument, and on a phone the native wheel beats anything
 * worth building.
 */
function Choice<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: [T, string][];
}) {
  return (
    <span className="relative shrink-0">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as T)}
        className="cursor-pointer appearance-none rounded-lg bg-transparent py-1.5 pl-2 pr-6 text-[0.8rem] font-medium outline-none transition-colors hover:bg-ink-08"
      >
        {options.map(([v, label]) => (
          <option key={v} value={v}>
            {label}
          </option>
        ))}
      </select>
      <svg
        viewBox="0 0 12 12"
        aria-hidden
        className="pointer-events-none absolute right-1.5 top-1/2 h-2.5 w-2.5 -translate-y-1/2 text-ink-50"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      >
        <path d="m3 4.5 3 3 3-3" />
      </svg>
    </span>
  );
}

/** A letter in a circle. The colour comes from the address, so it is stable. */
function Avatar({ email }: { email: string }) {
  const hues = [12, 45, 145, 200, 262, 322];
  let sum = 0;
  for (const ch of email) sum = (sum + ch.charCodeAt(0)) % 997;
  return (
    <span
      aria-hidden
      className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-[0.72rem] font-semibold text-white"
      style={{ background: `hsl(${hues[sum % hues.length]} 52% 46%)` }}
    >
      {email.slice(0, 1).toUpperCase()}
    </span>
  );
}

function Way({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex flex-col items-center gap-1.5 rounded-xl px-1 py-2.5 text-[0.72rem] font-medium transition-colors hover:bg-ink-04 disabled:opacity-30 disabled:hover:bg-transparent"
    >
      <span className="grid h-9 w-9 place-items-center rounded-full bg-ink-04">
        <svg viewBox="0 0 20 20" className="h-[17px] w-[17px]" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          {children}
        </svg>
      </span>
      {label}
    </button>
  );
}
