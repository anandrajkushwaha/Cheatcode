import { ExtractError, extractResume, type Extracted } from "@/lib/tools/extract";

/**
 * Reading a file for the agent, which is the same pipeline with eyes.
 *
 * All the format knowledge lives in lib/tools/extract.ts now — one table, one
 * size cap, one error type. What is left here is the part that could not live
 * there: turning pages into pictures, and asking the server to look at them.
 *
 * That split is the point rather than an accident. Everything in the extractor
 * happens on the device and nothing leaves it, which matters for a document
 * carrying somebody's phone number, address and salary history. Everything in
 * this file costs a model call and sends those pages somewhere, so it is
 * opt-in — and the callers that must not spend money on an anonymous visitor,
 * the public ATS checker among them, simply do not pass it in.
 *
 * This module used to be 362 lines with its own copy of the format table, and
 * the copies drifted exactly as you would expect: .odt was added here and not
 * there, so the same file read fine in a conversation and was refused on the
 * resume page. One table now, and that class of bug with it.
 */

export { ExtractError };

/**
 * One error type, under the name the overlay already catches.
 *
 * There were two, and nothing ever distinguished them at a catch site — both
 * meant "this file could not be read, here is a sentence explaining why".
 */
export const ReadError = ExtractError;

export type ReadResult = {
  text: string;
  /** What it turned out to be, for the line shown to the person. */
  kind: string;
  /** True when the text had to be recovered by looking at the pages. */
  read: boolean;
  /**
   * Layout facts, when the file had a layout to measure.
   *
   * Only PDFs and DOCX produce these, and only they can be scored honestly:
   * an ATS score derived from a photograph would be a number about our
   * transcription rather than about their document.
   */
  facts?: Extracted;
};

/** Twelve rather than eight: a photograph of a page is a bigger file. */
const MAX_BYTES = 12 * 1024 * 1024;

export async function readAnyFile(file: File): Promise<ReadResult> {
  const out = await extractResume(file, {
    maxBytes: MAX_BYTES,
    transcribe: readImages,
    render: renderPdfPages,
  });

  return {
    text: out.text,
    kind: out.kind,
    read: out.transcribed,
    ...(out.scorable ? { facts: out } : {}),
  };
}

/* ------------------------------------------------------------------ eyes */

/**
 * A PDF's pages, as pictures.
 *
 * Only ever reached for a PDF that turned out to have no text in it, which is
 * to say a scan. Rendering a text PDF and reading the pictures would be paying
 * a model to do worse than the parser already did for free.
 */
async function renderPdfPages(file: File, limit: number): Promise<string[]> {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

  const task = pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) });
  const out: string[] = [];

  try {
    const doc = await task.promise;
    const pages = Math.min(doc.numPages, limit);

    for (let i = 1; i <= pages; i++) {
      const page = await doc.getPage(i);
      // 1.6x: enough for small print to survive, not so much that four pages
      // become a payload nobody wants to upload on mobile data.
      const viewport = page.getViewport({ scale: 1.6 });
      const canvas = document.createElement("canvas");
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      const context = canvas.getContext("2d");
      if (!context) break;
      await page.render({ canvas, canvasContext: context, viewport }).promise;
      out.push(canvas.toDataURL("image/jpeg", 0.82));
    }
  } catch {
    /* Whatever rendered is still worth reading. */
  } finally {
    await task.destroy().catch(() => {});
  }

  return out;
}

/** Ask the server to look at the pages and type out what they say. */
async function readImages(images: string[]): Promise<string> {
  const res = await fetch("/api/app/agent/read-file", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ images }),
  });

  const json = (await res.json().catch(() => ({}))) as {
    ok?: boolean;
    text?: string;
    error?: string;
  };
  if (!res.ok || !json.ok || !json.text) {
    throw new ExtractError(json.error ?? "I couldn't read that one. Try a clearer photo, or a PDF.");
  }
  return json.text;
}
