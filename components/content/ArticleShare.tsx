"use client";

import { useEffect, useState } from "react";
import { EVENTS, track } from "@/lib/analytics/events";

/**
 * Pass an article on.
 *
 * WhatsApp first, and deliberately: this audience shares job and salary
 * writing in group chats far more than anywhere else, and a share from a
 * chat arrives with a recommendation attached in a way a search result
 * never does.
 *
 * Every route fires content_share with the article's path, so the admin can
 * tell a page that is being passed around from one that is merely being
 * opened. The native sheet is offered only where the browser has one —
 * elsewhere it would be a button that does nothing.
 */
export function ArticleShare({ title, path }: { title: string; path: string }) {
  const [url, setUrl] = useState("");
  const [canShare, setCanShare] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    setUrl(window.location.origin + path);
    setCanShare(typeof navigator.share === "function");
  }, [path]);

  // The note is a confirmation, not a state worth keeping on screen.
  useEffect(() => {
    if (!note) return;
    const id = window.setTimeout(() => setNote(null), 2500);
    return () => window.clearTimeout(id);
  }, [note]);

  const text = `${title}\n\n${url}`;
  const record = (where: string) => track(EVENTS.CONTENT_SHARE, { label: path, location: where });

  async function native() {
    record("system");
    try {
      await navigator.share({ title, text: title, url });
    } catch {
      /* the person closed the sheet — not an error worth showing */
    }
  }

  async function copy() {
    record("link");
    try {
      await navigator.clipboard.writeText(url);
      setNote("Link copied.");
    } catch {
      // Clipboard is unavailable inside several in-app browsers; showing the
      // URL lets the person copy it by hand rather than hitting a dead end.
      setNote(url);
    }
  }

  const btn =
    "rounded-full border border-ink-15 px-4 py-2 text-[0.85rem] transition-colors hover:bg-ink-04";

  return (
    <div className="mt-12 border-t border-ink-08 pt-6">
      <div className="flex flex-wrap items-center gap-2.5">
        <p className="mr-1 text-[0.85rem] text-ink-50">Found this useful? Send it on.</p>
        <a
          href={`https://wa.me/?text=${encodeURIComponent(text)}`}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => record("whatsapp")}
          className="rounded-full bg-[#25d366] px-4 py-2 text-[0.85rem] font-medium text-white transition-opacity hover:opacity-90"
        >
          WhatsApp
        </a>
        <a
          href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => record("linkedin")}
          className={btn}
        >
          LinkedIn
        </a>
        {canShare && (
          <button type="button" onClick={native} className={btn}>
            Share
          </button>
        )}
        <button type="button" onClick={copy} className={btn}>
          Copy link
        </button>
      </div>
      {note && <p className="mt-2.5 break-all text-[0.8rem] text-ink-50">{note}</p>}
    </div>
  );
}
