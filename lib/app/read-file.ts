import { extractResume, ExtractError } from "@/lib/tools/extract";
import type { ResumeFacts } from "@/lib/tools/ats";

/**
 * Reading whatever somebody drops into the conversation.
 *
 * Deliberately separate from lib/tools/extract.ts, which serves the ATS
 * checker and is strict on purpose: there, "that's an image, an ATS gets
 * nothing from it" *is* the answer, and softening it would remove the finding.
 * Here the person has dropped a file into a chat and wants to be talked to
 * about it, so this reads almost anything and only gives up when there is
 * genuinely nothing to read.
 *
 * Everything that can be done in the browser is done in the browser. A resume
 * carries a phone number, an address and a salary history, and the honest
 * default for a document like that is one the server never receives. Only
 * text crosses the wire — and only when a scan or a photo leaves no text to
 * find does an image go anywhere, which the person is told about.
 */

export class ReadError extends Error {}

const MAX_BYTES = 12 * 1024 * 1024;

/** Below this a PDF is a picture of a resume rather than a resume. */
const TOO_LITTLE_TEXT = 200;

/** Enough to cover a two-page resume; more is a document, not a CV. */
const MAX_OCR_PAGES = 4;

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
  facts?: ResumeFacts;
};

export async function readAnyFile(file: File): Promise<ReadResult> {
  if (file.size > MAX_BYTES) {
    throw new ReadError("That file is over 12 MB. Send a lighter version and I'll read it.");
  }
  if (file.size === 0) throw new ReadError("That file is empty.");

  const name = file.name.toLowerCase();
  const ext = name.slice(name.lastIndexOf(".") + 1);
  const mime = file.type.toLowerCase();

  // ---------------------------------------------------------------- images
  if (mime.startsWith("image/") || /^(png|jpe?g|webp|heic|heif|gif|bmp|tiff?)$/.test(ext)) {
    const text = await readImages([await toDataUrl(file)]);
    return { text, kind: "image", read: true };
  }

  // ------------------------------------------------------------------- pdf
  if (ext === "pdf" || mime === "application/pdf") {
    const facts = await extractResume(fileAs(file, "resume.pdf"));
    if (facts.text.replace(/\s/g, "").length >= TOO_LITTLE_TEXT) {
      return { text: facts.text, kind: "PDF", read: false, facts };
    }
    // A scan. The extractor found nothing because there is nothing to find.
    const pages = await renderPdfPages(file, MAX_OCR_PAGES);
    if (!pages.length) {
      throw new ReadError("That PDF has no text in it and its pages could not be rendered.");
    }
    return { text: await readImages(pages), kind: "scanned PDF", read: true };
  }

  // ------------------------------------------------------------------ docx
  if (ext === "docx" || mime.includes("wordprocessingml")) {
    const facts = await extractResume(fileAs(file, "resume.docx"));
    return { text: facts.text, kind: "DOCX", read: false, facts };
  }

  // ------------------------------------------------------------------- odt
  if (ext === "odt" || mime.includes("opendocument.text")) {
    return { text: await extractOdt(file), kind: "ODT", read: false };
  }

  // ------------------------------------------------------------------- rtf
  if (ext === "rtf" || mime.includes("rtf")) {
    return { text: stripRtf(await file.text()), kind: "RTF", read: false };
  }

  // ------------------------------------------------------------------ html
  if (/^(html?|xhtml)$/.test(ext) || mime.includes("html")) {
    return { text: stripHtml(await file.text()), kind: "HTML", read: false };
  }

  // --------------------------------------------------------- the old .doc
  if (ext === "doc") {
    throw new ReadError(
      "The old .doc format can't be read in a browser. Open it and save as .docx or PDF — " +
        "worth doing anyway, since a lot of application systems can't read .doc either.",
    );
  }

  // ---------------------------------------------------------- text of any kind
  //
  // Markdown, plain text, CSV, JSON, a pasted LaTeX source. Rather than keeping
  // a list of extensions that will always be one short, this reads the bytes
  // and asks whether they look like text.
  const guess = await file.text().catch(() => "");
  if (looksLikeText(guess)) {
    return { text: guess, kind: ext ? ext.toUpperCase() : "text", read: false };
  }

  throw new ReadError(
    `I can't read a ${ext ? `.${ext} ` : ""}file. Send a PDF, DOCX, ODT, RTF, text file, or a photo of it.`,
  );
}

/* ------------------------------------------------------------------ shapes */

/**
 * The ATS extractor routes on the filename, so a file that arrived with the
 * right bytes and a wrong name still gets read correctly.
 */
function fileAs(file: File, name: string): File {
  return file.name.toLowerCase().endsWith(name.slice(name.lastIndexOf(".")))
    ? file
    : new File([file], name, { type: file.type });
}

/** Mostly printable, not much of it binary rubble. */
function looksLikeText(s: string): boolean {
  if (s.trim().length < 20) return false;
  const sample = s.slice(0, 4000);
  // eslint-disable-next-line no-control-regex
  const odd = (sample.match(/[\u0000-\u0008\u000e-\u001f\ufffd]/g) ?? []).length;
  return odd / sample.length < 0.02;
}

/* -------------------------------------------------------------------- odt */

/** An ODT is a zip with the text in content.xml, the same shape as a DOCX. */
async function extractOdt(file: File): Promise<string> {
  const { unzipSync, strFromU8 } = await import("fflate");

  let xml: string;
  try {
    const zip = unzipSync(new Uint8Array(await file.arrayBuffer()));
    const content = zip["content.xml"];
    if (!content) throw new Error("no content.xml");
    xml = strFromU8(content);
  } catch {
    throw new ReadError("That ODT couldn't be opened. Try exporting it as a PDF.");
  }

  const text = xml
    // The delimiter is put back. Consuming it turned "<text:p>" into an
    // unterminated tag, and the tag-stripper below then ate the paragraph's
    // first words along with it — which read as "that ODT had no text in it".
    .replace(/<text:p([ >])/g, "\n<text:p$1")
    .replace(/<text:line-break\s*\/?>/g, "\n")
    .replace(/<text:tab\s*\/?>/g, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  if (!text) throw new ReadError("That ODT had no text in it.");
  return text;
}

/* -------------------------------------------------------------------- rtf */

/**
 * RTF, without a parser.
 *
 * Control words go, escaped hex becomes its character, braces go, and what is
 * left is the text. Not a general RTF implementation — a resume is prose in a
 * handful of paragraphs, and the shapes that would defeat this (embedded
 * objects, tables of images) are shapes that carry no text anyway.
 */
function stripRtf(rtf: string): string {
  const text = dropGroups(rtf, /^(pict|object|fonttbl|colortbl|stylesheet|info|generator|listtable|revtbl)$/i)
    .replace(/\\par[d]?\b/g, "\n")
    .replace(/\\line\b/g, "\n")
    .replace(/\\tab\b/g, " ")
    .replace(/\\'([0-9a-f]{2})/gi, (_, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/\\u(-?\d+)\??/g, (_, n) => String.fromCharCode(Number(n) & 0xffff))
    .replace(/\\[a-z]+-?\d* ?/gi, "")
    .replace(/[{}]/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  if (!text) throw new ReadError("That RTF had no text in it.");
  return text;
}

/**
 * Remove whole RTF groups by their leading control word.
 *
 * A regex cannot do this: `{\\fonttbl{\\f0 Times New Roman;}}` nests, and a
 * non-greedy match stops at the first closing brace — which left the font
 * names sitting in the middle of somebody's resume. Braces are counted
 * instead, and an escaped brace does not count.
 */
function dropGroups(rtf: string, names: RegExp): string {
  const kept: string[] = [];
  let i = 0;
  let from = 0;

  while (i < rtf.length) {
    if (rtf[i] !== "{") {
      i++;
      continue;
    }

    const word = rtf.slice(i, i + 40).match(/^\{(?:\\\*)?\\([a-z]+)/i)?.[1];
    if (!word || !names.test(word)) {
      i++;
      continue;
    }

    kept.push(rtf.slice(from, i));

    let depth = 0;
    let j = i;
    for (; j < rtf.length; j++) {
      const c = rtf[j];
      if (c === "\\") {
        j++; // an escape takes the next character with it, brace or not
        continue;
      }
      if (c === "{") depth++;
      else if (c === "}") {
        depth--;
        if (depth === 0) {
          j++;
          break;
        }
      }
    }

    i = j;
    from = j;
  }

  kept.push(rtf.slice(from));
  return kept.join("");
}

/* ------------------------------------------------------------------- html */

function stripHtml(html: string): string {
  return html
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|h[1-6]|tr)>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/* ------------------------------------------------------------ pictures */

/**
 * Turn a PDF's pages into images.
 *
 * Only reached when the text layer is empty, which means somebody scanned or
 * photographed their resume. pdfjs is already here for the ATS checker, so
 * this costs nothing extra to ship.
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

/**
 * A photo, shrunk to something worth uploading.
 *
 * Phone cameras produce 4000px images of an A4 page. Everything above about
 * 2000px on the long edge is detail the model does not use and the person
 * pays for in upload time.
 */
async function toDataUrl(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file).catch(() => null);
  if (!bitmap) {
    throw new ReadError("That image couldn't be opened. Try a PNG or a JPEG.");
  }

  const longest = Math.max(bitmap.width, bitmap.height);
  const scale = longest > 2000 ? 2000 / longest : 1;

  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const context = canvas.getContext("2d");
  if (!context) throw new ReadError("This browser can't process that image.");
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();

  return canvas.toDataURL("image/jpeg", 0.85);
}

/** Ask the server to look at the pages and type out what they say. */
async function readImages(images: string[]): Promise<string> {
  const res = await fetch("/api/app/agent/read-file", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ images }),
  });

  const json = (await res.json().catch(() => ({}))) as { ok?: boolean; text?: string; error?: string };
  if (!res.ok || !json.ok || !json.text) {
    throw new ReadError(json.error ?? "I couldn't read that one. Try a clearer photo, or a PDF.");
  }
  return json.text;
}

export { ExtractError };
