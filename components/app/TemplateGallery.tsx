"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ResumeDocument } from "@/components/app/ResumeDocument";
import { TEMPLATES } from "@/lib/app/resume-templates";
import type { Resume } from "@/lib/app/resume-schema";

/**
 * The wall of templates, with the person's own resume inside every one.
 *
 * The obvious build is Canva's: a grid of pictures of a stranger's CV, and you
 * pick the one you like the look of. That is the right design when the gallery
 * is the front door and the visitor has given you nothing yet — Canva cannot
 * show you your own resume because it has never seen it.
 *
 * We have. By the time anybody reaches this screen there is a draft, seeded
 * from the file they uploaded, with their name and their jobs in it. So each
 * card renders the real document at a smaller scale, and choosing a template
 * is looking at five versions of your own resume rather than five strangers'.
 * It removes the whole "will it look like that with my content in it" step,
 * which is the step where template galleries usually lose people.
 *
 * The previews are the real component, not images. Five live documents on a
 * page is cheap because they are text, and it means a template can never look
 * one way on the card and another way in the editor.
 */

const CARD_WIDTH = 260;
/** 210mm at 96dpi. The document renders at full size and is then scaled down. */
const PAGE_PX = 794;

export function TemplateGallery({
  content,
  draftId,
  current,
}: {
  content: Resume;
  draftId: string;
  current: string;
}) {
  const router = useRouter();
  const [chosen, setChosen] = useState(current);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function choose(id: string) {
    // Paint first. The choice is a visual one and waiting on a round trip to
    // show it makes a click feel like a submit.
    setChosen(id);
    setSaving(id);
    setError(null);

    try {
      const res = await fetch("/api/app/resume/draft", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: draftId, content, template: id }),
      });
      const json = (await res.json()) as { ok?: boolean; error?: string };
      if (!json.ok) throw new Error(json.error ?? "That didn't save.");
      router.push("/app/resume/builder");
    } catch (e) {
      // Put the selection back where it was. A card showing as chosen when
      // nothing was stored is the kind of lie somebody only discovers later.
      setChosen(current);
      setError(e instanceof Error ? e.message : "That didn't save.");
    } finally {
      setSaving(null);
    }
  }

  return (
    <>
      {error && (
        <p className="mb-5 rounded-xl border border-ink-15 bg-ink-04 px-4 py-3 text-[0.85rem]">
          {error}
        </p>
      )}

      <div className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-x-6 gap-y-8">
        {TEMPLATES.map((t) => {
          const isChosen = t.id === chosen;
          const isSaving = saving === t.id;

          return (
            <button
              key={t.id}
              type="button"
              onClick={() => choose(t.id)}
              disabled={saving !== null}
              aria-pressed={isChosen}
              className="group block w-full text-left disabled:cursor-wait"
            >
              <div
                className={[
                  "relative overflow-hidden rounded-xl border bg-white transition-all",
                  isChosen
                    ? "border-ink ring-2 ring-ink ring-offset-2 ring-offset-paper"
                    : "border-ink-15 group-hover:-translate-y-0.5 group-hover:border-ink-30 group-hover:shadow-lg",
                ].join(" ")}
                style={{ aspectRatio: "210 / 297" }}
              >
                {/* The real document, rendered at full page width and scaled
                    to fit. Transform rather than a smaller font size, so what
                    is on the card is exactly what prints. */}
                <div
                  aria-hidden
                  className="pointer-events-none origin-top-left"
                  style={{
                    width: PAGE_PX,
                    transform: `scale(${CARD_WIDTH / PAGE_PX})`,
                  }}
                >
                  <ResumeDocument content={content} template={t.id} />
                </div>

                {isSaving && (
                  <div className="absolute inset-0 grid place-items-center bg-white/70 text-[0.8rem] font-medium">
                    Opening…
                  </div>
                )}
              </div>

              <div className="mt-3 flex items-baseline gap-2">
                <p className="text-[0.95rem] font-medium">{t.name}</p>
                {isChosen && (
                  <span className="text-[0.72rem] uppercase tracking-[0.1em] text-ink-50">
                    In use
                  </span>
                )}
              </div>
              <p className="mt-1 text-[0.82rem] leading-relaxed text-ink-50">{t.blurb}</p>
            </button>
          );
        })}
      </div>
    </>
  );
}
