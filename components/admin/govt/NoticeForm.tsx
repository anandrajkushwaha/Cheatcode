"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { KIND_LABEL, NOTICE_KINDS, type NoticeKind } from "@/lib/govt/types";
import type { PanelNotice } from "@/lib/govt/admin";
import {
  Area,
  BUTTON,
  BUTTON_QUIET,
  Field,
  Group,
  Problem,
  Select,
  Text,
  usePost,
} from "@/components/admin/govt/fields";

/**
 * Posting one notice.
 *
 * Five fields, in the order they come off the page being read: what kind of
 * notice, what it is called, where it is, when it was put out, and which
 * recruitment it belongs to. Everything else about this screen is in service
 * of that taking under a minute, because a tool that takes five minutes a
 * notice will be used for a week.
 *
 * The title is typed, not generated. The boards write their own notices
 * better than any summary of them — "SSC CGL 2026 Notification Out" is what
 * somebody is searching for — and a person reading the page can copy it in
 * four seconds.
 */
export function NoticeForm({
  notice,
  exams,
  defaultKind,
  today,
}: {
  notice?: PanelNotice;
  exams: { id: string; label: string }[];
  defaultKind?: NoticeKind;
  today: string;
}) {
  const router = useRouter();
  const { busy, error, setError, post } = usePost("/api/admin/govt/notice");

  const [kind, setKind] = useState<string>(notice?.kind ?? defaultKind ?? "job");
  const [title, setTitle] = useState(notice?.title ?? "");
  const [officialUrl, setOfficialUrl] = useState(notice?.officialUrl ?? "");
  // A new notice is dated today unless told otherwise. Almost every notice
  // posted here went up on the board the same morning, and a date typed from
  // habit is more reliable than a blank one left behind.
  const [publishedOn, setPublishedOn] = useState(notice?.publishedOn ?? (notice ? "" : today));
  const [summary, setSummary] = useState(notice?.summary ?? "");
  const [examId, setExamId] = useState(notice?.examId ?? "");
  const [status, setStatus] = useState(notice?.status ?? "published");

  async function save() {
    const done = await post<{ id: string }>({
      action: "save",
      id: notice?.id,
      kind,
      title,
      summary,
      publishedOn,
      officialUrl,
      examId: examId || null,
      status,
    });
    if (!done) return;
    router.push("/admin/govt");
    router.refresh();
  }

  async function remove() {
    const done = await post({ action: "delete", id: notice?.id });
    if (!done) return;
    router.push("/admin/govt");
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <Group
        title={notice ? "Edit notice" : "New notice"}
        note="Copy the title and the link from the board itself. The link is what a reader taps to check us — a notice without it is a claim, so it is the one field with no way around."
      >
        <Field label="Kind" hint="Which tab it appears under.">
          <Select
            value={kind}
            onChange={(e) => setKind(e.target.value)}
            options={NOTICE_KINDS.map((k) => ({ value: k, label: KIND_LABEL[k] }))}
          />
        </Field>

        <Field label="Date on the notice" hint="Leave blank if the board does not say.">
          <Text type="date" value={publishedOn} onChange={(e) => setPublishedOn(e.target.value)} />
        </Field>

        <Field
          label="Title"
          hint="Word for word, as the notification writes it."
          wide
        >
          <Text
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="SSC Combined Graduate Level 2026 — Notification Out"
            maxLength={240}
          />
        </Field>

        <Field label="Official link" hint="The page or PDF on the board's own site." wide>
          <Text
            value={officialUrl}
            onChange={(e) => setOfficialUrl(e.target.value)}
            placeholder="https://ssc.gov.in/..."
            inputMode="url"
          />
        </Field>

        <Field
          label="One line (optional)"
          hint="Only if it adds something the title does not. Skip it otherwise."
          wide
        >
          <Area
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            maxLength={600}
            placeholder="17,727 posts. Online form from 12 March."
          />
        </Field>

        <Field
          label="Part of a recruitment"
          hint="Links this notice into that recruitment's timeline. Leave unattached if there is no page for it."
          wide
        >
          <Select
            value={examId}
            onChange={(e) => setExamId(e.target.value)}
            options={[{ value: "", label: "Not attached" }, ...exams.map((e) => ({ value: e.id, label: e.label }))]}
          />
        </Field>

        <Field label="Status" hint="Published is live on the public page immediately.">
          <Select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            options={[
              { value: "published", label: "Published — live" },
              { value: "draft", label: "Draft — not public" },
              { value: "withdrawn", label: "Withdrawn — taken off the page" },
            ]}
          />
        </Field>
      </Group>

      {error && <Problem>{error}</Problem>}

      <div className="flex flex-wrap items-center gap-3">
        <button type="button" onClick={() => void save()} disabled={busy} className={BUTTON}>
          {busy ? "Saving…" : notice ? "Save changes" : "Post notice"}
        </button>
        <Link href="/admin/govt" className={BUTTON_QUIET}>
          Cancel
        </Link>
        {notice && (
          <ConfirmDelete
            busy={busy}
            onConfirm={() => void remove()}
            onBlocked={() =>
              setError("Only the owner can delete. Set the status to Withdrawn to take it off the page.")
            }
          />
        )}
        {notice?.postedBy && (
          <span className="text-[0.78rem] text-ink-30">
            Posted by {notice.postedBy}
            {notice.manual ? "" : " · came from the monitor"}
          </span>
        )}
      </div>
    </div>
  );
}

/**
 * Delete, behind one press.
 *
 * Not a browser confirm(): a dialog blocks the page and reads as a bug on a
 * phone. Two presses with the second one labelled is the same protection and
 * stays inside the screen. The API refuses this for anybody but the owner
 * anyway — this is the courtesy, not the control.
 */
function ConfirmDelete({
  busy,
  onConfirm,
}: {
  busy: boolean;
  onConfirm: () => void;
  onBlocked: () => void;
}) {
  const [armed, setArmed] = useState(false);

  if (!armed) {
    return (
      <button
        type="button"
        onClick={() => setArmed(true)}
        className="text-[0.82rem] text-ink-30 underline underline-offset-2 hover:text-red-700"
      >
        Delete
      </button>
    );
  }

  return (
    <span className="flex items-center gap-2 text-[0.82rem]">
      <button
        type="button"
        disabled={busy}
        onClick={onConfirm}
        className="rounded-full border border-red-200 bg-red-50 px-3 py-1.5 font-medium text-red-700 disabled:opacity-40"
      >
        Delete for good
      </button>
      <button type="button" onClick={() => setArmed(false)} className="text-ink-30 underline underline-offset-2">
        Keep it
      </button>
    </span>
  );
}
