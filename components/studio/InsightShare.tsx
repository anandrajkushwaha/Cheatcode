"use client";

import { useEffect, useState } from "react";
import type { Insight } from "@/lib/insights/query";
import { EVENTS, track } from "@/lib/analytics/events";

/**
 * Share an insight as a picture or as a link.
 *
 * The picture is the card from /api/insights/<id>/card — headline, 70 words,
 * source and the Cheatcode name on it — sized for a WhatsApp status or an
 * Instagram story. The link goes to the public page on cheatcodeapp.com,
 * whose preview in a chat is that same card.
 *
 * On a phone "Share" hands the image itself to the system sheet, so it can
 * go straight into WhatsApp or a story. A desktop browser usually cannot
 * share files, so there it is download and copy instead.
 */
export function InsightShare({ item, onClose }: { item: Insight; onClose: () => void }) {
  const card = `/api/insights/${item.id}/card`;
  const [link, setLink] = useState("");
  const [canShareFile, setCanShareFile] = useState(false);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    setLink(`${window.location.origin}/insights/${item.id}`);
    try {
      const probe = new File([new Blob()], "x.png", { type: "image/png" });
      setCanShareFile(Boolean(navigator.canShare?.({ files: [probe] })));
    } catch {
      setCanShareFile(false);
    }
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [item.id, onClose]);

  const caption = `${item.title}\n\nRead more on Cheatcode: ${link}`;

  // Counted against the insight's own public page, so the admin's per-page
  // share numbers line up with the path a reader would actually land on.
  const record = (where: string) =>
    track(EVENTS.CONTENT_SHARE, { label: `/insights/${item.id}`, location: where });

  async function image(): Promise<File | null> {
    const res = await fetch(card);
    if (!res.ok) return null;
    const blob = await res.blob();
    return new File([blob], "cheatcode-insight.png", { type: "image/png" });
  }

  async function shareImage() {
    record("image");
    setBusy(true);
    setNote(null);
    try {
      const file = await image();
      if (!file) throw new Error("no image");
      await navigator.share({ files: [file], title: item.title, text: caption });
    } catch (e) {
      if (!(e instanceof DOMException && e.name === "AbortError")) setNote("Couldn't share the image — try Download.");
    } finally {
      setBusy(false);
    }
  }

  async function download() {
    record("download");
    setBusy(true);
    setNote(null);
    try {
      const file = await image();
      if (!file) throw new Error("no image");
      const url = URL.createObjectURL(file);
      const a = document.createElement("a");
      a.href = url;
      a.download = file.name;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setNote("Saved. Add it to your WhatsApp status or story.");
    } catch {
      setNote("Couldn't make the image. Try again.");
    } finally {
      setBusy(false);
    }
  }

  async function copy() {
    record("link");
    try {
      await navigator.clipboard.writeText(link);
      setNote("Link copied.");
    } catch {
      setNote(link);
    }
  }

  const btn =
    "flex items-center justify-center gap-2 rounded-full px-4 py-2.5 text-[0.85rem] font-medium transition-opacity hover:opacity-90 disabled:opacity-50";

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-black/50 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Share this insight"
        onClick={(e) => e.stopPropagation()}
        className="max-h-[92dvh] w-full max-w-[420px] overflow-y-auto rounded-3xl bg-paper shadow-2xl"
      >
        <div className="flex items-center justify-between px-5 pt-4">
          <p className="text-[0.95rem] font-semibold">Share</p>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="grid size-8 place-items-center rounded-full text-ink-50 hover:bg-ink-04"
          >
            ✕
          </button>
        </div>

        <div className="px-5 pt-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={card}
            alt={item.title}
            className="aspect-[4/5] w-full rounded-2xl border border-ink-08 bg-[#fcfaee] object-cover"
          />
        </div>

        <div className="grid grid-cols-2 gap-2 p-5">
          {canShareFile ? (
            <button type="button" onClick={shareImage} disabled={busy} className={`${btn} col-span-2 bg-ink text-paper`}>
              {busy ? "Preparing…" : "Share image"}
            </button>
          ) : (
            <button type="button" onClick={download} disabled={busy} className={`${btn} col-span-2 bg-ink text-paper`}>
              {busy ? "Preparing…" : "Download image"}
            </button>
          )}
          <a
            href={`https://wa.me/?text=${encodeURIComponent(caption)}`}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => record("whatsapp")}
            className={`${btn} bg-[#25d366] text-white`}
          >
            WhatsApp
          </a>
          <button type="button" onClick={copy} className={`${btn} border border-ink-15 text-ink`}>
            Copy link
          </button>
          {canShareFile && (
            <button
              type="button"
              onClick={download}
              disabled={busy}
              className="col-span-2 text-[0.8rem] text-ink-50 underline underline-offset-4"
            >
              Download image instead
            </button>
          )}
          {note && <p className="col-span-2 text-center text-[0.78rem] text-ink-50">{note}</p>}
        </div>
      </div>
    </div>
  );
}
