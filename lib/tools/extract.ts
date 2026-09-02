/**
 * Everything that turns a file into text, in one place.
 *
 * Nothing is uploaded unless it has to be. That is a deliberate product
 * decision as much as a technical one — people are being asked to hand over a
 * document with their phone number and salary history on it, and the honest
 * version of that is a tool that never receives the file at all. Text comes
 * out of PDFs, Word files, ODT, RTF, HTML and anything that looks like text,
 * entirely in the browser.
 *
 * The one exception is a document with no text in it: a scan, or a photograph.
 * Those can only be read by looking at them, which means a model, which means
 * the pages leave the device. So that path is opt-in — a caller passes a
 * `transcribe` function or it does not get one. The public ATS checker does
 * not pass one, and its refusal ("an ATS gets nothing from an image") is not a
 * limitation but the correct answer to the question being asked.
 *
 * This used to be two modules with two format tables, two size caps and two
 * error types: this one, and lib/app/read-file.ts, which handled everything
 * this one did plus four more formats and delegated the overlap back here.
 * A format supported in one and not the other was a bug waiting for the right
 * upload, and it happened — .odt worked in a conversation and failed on the
 * resume page.
 */

import type { ResumeFacts } from "./ats";

export class ExtractError extends Error {}

/** Under this much text, a document is a picture of one. */
const TOO_LITTLE_TEXT = 200;

/** Enough for a two-page resume. More than that is not a CV. */
const MAX_TRANSCRIBE_PAGES = 4;

const DEFAULT_MAX_BYTES = 8 * 1024 * 1024;

export type ExtractOptions = {
  /**
   * Recover text by looking at the pages, for files that have none.
   *
   * Given data URLs, returns what they say. Callers that cannot spend a model
   * call — anonymous tools, anything unmetered — leave this out, and scans and
   * photographs are then refused with an explanation rather than read.
   */
  transcribe?: (images: string[]) => Promise<string>;
  /** Render a PDF's pages to images, needed only alongside `transcribe`. */
  render?: (file: File, limit: number) => Promise<string[]>;
  maxBytes?: number;
};

export type Extracted = ResumeFacts & {
  /** What it turned out to be, for the line shown to the person. */
  kind: string;
  /** True when the text was recovered by looking rather than by reading. */
  transcribed: boolean;
  /**
   * Whether the layout facts are real.
   *
   * Only PDFs and DOCX have a measurable layout. Everything else gets
   * estimated page counts and a single column by assumption, and scoring that
   * would produce a number about our transcription rather than about their
   * document.
   */
  scorable: boolean;
};

export async function extractResume(
  file: File,
  options: ExtractOptions = {},
): Promise<Extracted> {
  const maxBytes = options.maxBytes ?? DEFAULT_MAX_BYTES;
  if (file.size > maxBytes) {
    throw new ExtractError(
      `That file is over ${Math.round(maxBytes / (1024 * 1024))} MB. Send a lighter version and I'll read it.`,
    );
  }
  if (file.size === 0) throw new ExtractError("That file is empty.");

  const name = file.name.toLowerCase();
  const ext = name.slice(name.lastIndexOf(".") + 1);
  const mime = file.type.toLowerCase();

  /* ------------------------------------------------------------- pictures */

  if (mime.startsWith("image/") || /^(png|jpe?g|webp|heic|heif|gif|bmp|tiff?)$/.test(ext)) {
    if (!options.transcribe) {
      throw new ExtractError(
        "That's an image. An ATS gets exactly nothing from an image — which is itself " +
          "the answer. Export a real PDF from your editor.",
      );
    }
    return loose(await options.transcribe([await toDataUrl(file)]), "image", "txt", true);
  }

  /* ------------------------------------------------------------------ pdf */

  if (ext === "pdf" || mime === "application/pdf") {
    const facts = await extractPdf(file);
    if (facts.text.replace(/\s/g, "").length >= TOO_LITTLE_TEXT) {
      return { ...facts, kind: "PDF", transcribed: false, scorable: true };
    }

    // Nothing to find, because there is nothing there: a scan.
    if (!options.transcribe || !options.render) {
      throw new ExtractError(
        "Almost no text came out of that file. It is very likely an image or a scan — " +
          "which is exactly what an applicant tracking system sees too. Export a real " +
          "PDF from your editor and try again.",
      );
    }

    const pages = await options.render(file, MAX_TRANSCRIBE_PAGES);
    if (!pages.length) {
      throw new ExtractError("That PDF has no text in it and its pages could not be rendered.");
    }
    // "pdf" and not "txt": it genuinely is a PDF, and the one check that
    // reads fileType should see what the person actually has.
    return loose(await options.transcribe(pages), "scanned PDF", "pdf", true);
  }

  /* ----------------------------------------------------------------- docx */

  if (ext === "docx" || mime.includes("wordprocessingml")) {
    const facts = await extractDocx(file);
    return { ...facts, kind: "DOCX", transcribed: false, scorable: true };
  }

  /* --------------------------------------------------- the rest, as text */

  if (ext === "odt" || mime.includes("opendocument.text")) {
    return loose(await extractOdt(file), "ODT", "txt", false);
  }

  if (ext === "rtf" || mime.includes("rtf")) {
    return loose(stripRtf(await file.text()), "RTF", "txt", false);
  }

  if (/^(html?|xhtml)$/.test(ext) || mime.includes("html")) {
    return loose(stripHtml(await file.text()), "HTML", "txt", false);
  }

  if (ext === "doc") {
    throw new ExtractError(
      "The old .doc format can't be read in a browser. Open it and save as .docx or PDF — " +
        "worth doing anyway, since a lot of application systems can't read .doc either.",
    );
  }

  // Markdown, plain text, CSV, JSON, a pasted LaTeX source. Rather than keeping
  // a list of extensions that will always be one short, this reads the bytes
  // and asks whether they look like text.
  const guess = await file.text().catch(() => "");
  if (looksLikeText(guess)) {
    return loose(guess, ext ? ext.toUpperCase() : "text", "txt", false);
  }

  throw new ExtractError(
    `I can't read a ${ext ? `.${ext} ` : ""}file. Send a PDF, DOCX, ODT, RTF, text file, or a photo of it.`,
  );
}

/**
 * Facts for something with no measurable layout.
 *
 * Page count is estimated from word count and the column count is assumed to
 * be one, which is why `scorable` is false: these numbers describe our reading
 * of the file, not the file. An ATS score built on them would be a number
 * about us.
 */
function loose(
  text: string,
  kind: string,
  fileType: ResumeFacts["fileType"],
  transcribed: boolean,
): Extracted {
  const clean = text.trim();
  const words = clean.split(/\s+/).filter(Boolean).length;
  const pages = Math.max(1, Math.round(words / 500));
  const chars = clean.replace(/\s/g, "").length;

  return {
    text: clean,
    fileType,
    pages,
    charsPerPage: Array.from({ length: pages }, () => Math.round(chars / pages)),
    multiColumnPages: 0,
    kind,
    transcribed,
    scorable: false,
  };
}

// ------------------------------------------------------------------- PDF

type TextItem = { str: string; transform: number[]; width: number };
type Row = { y: number; items: { x: number; end: number; str: string }[] };

async function extractPdf(file: File): Promise<ResumeFacts> {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

  const data = new Uint8Array(await file.arrayBuffer());

  const task = pdfjs.getDocument({ data });
  let doc;
  try {
    doc = await task.promise;
  } catch {
    throw new ExtractError(
      "That PDF couldn't be opened. If it's password protected, remove the password and try again.",
    );
  }

  const pageTexts: string[] = [];
  const charsPerPage: number[] = [];
  let multiColumnPages = 0;
  const pages = doc.numPages;

  for (let i = 1; i <= pages; i++) {
    const page = await doc.getPage(i);
    const viewport = page.getViewport({ scale: 1 });
    const content = await page.getTextContent();
    const items = content.items as unknown as TextItem[];

    const rows = groupIntoRows(items);
    const pageText = rows
      .map((r) =>
        r.items
          .map((i) => i.str)
          .join("")
          .replace(/\s+/g, " ")
          .trim(),
      )
      .filter(Boolean)
      .join("\n");

    pageTexts.push(pageText);
    charsPerPage.push(pageText.replace(/\s/g, "").length);

    if (looksMultiColumn(rows, viewport.width)) multiColumnPages++;
  }

  // Frees the worker; without this every re-check leaks one.
  await task.destroy();

  return {
    text: pageTexts.join("\n\n"),
    fileType: "pdf",
    pages,
    charsPerPage,
    multiColumnPages,
  };
}

/**
 * PDF text arrives as loose positioned fragments, not lines. Grouping by
 * y-coordinate rebuilds the reading order — without this, bullet detection and
 * "does this line start with a verb" are both meaningless.
 */
function groupIntoRows(items: TextItem[]): Row[] {
  const byY = new Map<number, Row["items"]>();

  for (const it of items) {
    if (!it.str || !it.str.trim()) continue;
    const y = it.transform[5];
    // Snap to a 3pt grid so a superscript doesn't start its own line.
    const key = Math.round(y / 3) * 3;
    const row = byY.get(key) ?? [];
    const x = it.transform[4];
    row.push({ x, end: x + (it.width || 0), str: it.str });
    byY.set(key, row);
  }

  return [...byY.entries()]
    .sort((a, b) => b[0] - a[0]) // PDF y grows upward
    .map(([y, its]) => ({ y, items: its.sort((a, b) => a.x - b.x) }));
}

/**
 * Column detection — the check this whole tool exists for, and the one that
 * needs two signals rather than one.
 *
 * PDF producers disagree about how to emit text. Word and LaTeX often place a
 * sidebar line and a main-column line at the same y, so they arrive in one row
 * with a wide gap between them. Chromium, Canva and most design tools give
 * every visual line its own y, so those rows never meet and the gap is
 * invisible — but then the two columns show up as two distinct left margins.
 *
 * Checking only one of the two misses half the templates in circulation, so
 * both run and either can raise the flag.
 */
function looksMultiColumn(rows: Row[], pageWidth: number): boolean {
  if (rows.length < 10 || pageWidth <= 0) return false;
  return hasGutterWithinRows(rows, pageWidth) || hasTwoLeftMargins(rows, pageWidth);
}

/** Signal one: a wide gap inside a row, recurring at the same x down the page. */
function hasGutterWithinRows(rows: Row[], pageWidth: number): boolean {
  const minGap = pageWidth * 0.1;
  const mids: number[] = [];

  for (const row of rows) {
    let widest = 0;
    let mid = 0;
    for (let i = 0; i < row.items.length - 1; i++) {
      const gap = row.items[i + 1].x - row.items[i].end;
      if (gap > widest) {
        widest = gap;
        mid = row.items[i].end + gap / 2;
      }
    }
    if (widest >= minGap) mids.push(mid);
  }

  if (mids.length < Math.max(5, rows.length * 0.2)) return false;

  // Gaps that wander are right-aligned dates, not a gutter.
  const mean = mids.reduce((a, b) => a + b, 0) / mids.length;
  const sd = Math.sqrt(mids.reduce((a, m) => a + (m - mean) ** 2, 0) / mids.length);
  return sd < pageWidth * 0.06;
}

/**
 * Signal two: the page's lines start at two clearly separated left margins,
 * and both sides carry real text.
 *
 * The "real text" condition is what keeps right-aligned dates out. A column of
 * dates also sits at its own x, but it is a handful of short strings; a genuine
 * column holds a meaningful share of the page's characters.
 */
function hasTwoLeftMargins(rows: Row[], pageWidth: number): boolean {
  const lines = rows
    .map((r) => ({
      x: r.items[0].x,
      chars: r.items.reduce((a, i) => a + i.str.trim().length, 0),
    }))
    .filter((l) => l.chars > 0);

  if (lines.length < 10) return false;

  const sorted = [...lines].sort((a, b) => a.x - b.x);
  const totalChars = sorted.reduce((a, l) => a + l.chars, 0);

  // The widest jump between consecutive left margins is the candidate gutter.
  let splitAt = -1;
  let widest = 0;
  for (let i = 0; i < sorted.length - 1; i++) {
    const gap = sorted[i + 1].x - sorted[i].x;
    if (gap > widest) {
      widest = gap;
      splitAt = i;
    }
  }

  // Indented bullets sit a few points in; a column sits a long way in.
  if (widest < pageWidth * 0.12 || splitAt < 0) return false;

  const left = sorted.slice(0, splitAt + 1);
  const right = sorted.slice(splitAt + 1);
  if (left.length < 4 || right.length < 4) return false;

  const leftChars = left.reduce((a, l) => a + l.chars, 0) / totalChars;
  const rightChars = right.reduce((a, l) => a + l.chars, 0) / totalChars;

  return leftChars > 0.1 && rightChars > 0.1;
}

// ------------------------------------------------------------------- DOCX

async function extractDocx(file: File): Promise<ResumeFacts> {
  const { unzipSync, strFromU8 } = await import("fflate");

  let xml: string;
  try {
    const zip = unzipSync(new Uint8Array(await file.arrayBuffer()));
    const doc = zip["word/document.xml"];
    if (!doc) throw new Error("no document.xml");
    xml = strFromU8(doc);
  } catch {
    throw new ExtractError("That DOCX couldn't be opened. Try re-saving it, or upload a PDF.");
  }

  // Paragraph and line breaks become newlines; <w:t> holds the actual text.
  const text = xml
    // The delimiter is put back rather than swallowed. It survived here only
    // because a Word paragraph always has a nested tag before its text; the
    // same line in the ODT reader ate the first words of every paragraph.
    .replace(/<w:p([ >])/g, "\n<w:p$1")
    .replace(/<w:br\s*\/?>/g, "\n")
    .replace(/<w:tab\s*\/?>/g, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .split("\n")
    .map((l) => l.replace(/[ \t]+/g, " ").trim())
    .filter(Boolean)
    .join("\n");

  // A DOCX has no fixed pages; ~500 words a page is the usual approximation.
  const words = text.split(/\s+/).filter(Boolean).length;
  const pages = Math.max(1, Math.round(words / 500));

  return {
    text,
    fileType: "docx",
    pages,
    charsPerPage: Array.from({ length: pages }, () => Math.round(text.replace(/\s/g, "").length / pages)),
    // Word tables and columns aren't visible from the text stream, so this
    // stays 0 rather than being guessed at. The check simply passes.
    multiColumnPages: 0,
  };
}

/* ------------------------------------------ the formats that are just text */


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
    throw new ExtractError("That ODT couldn't be opened. Try exporting it as a PDF.");
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

  if (!text) throw new ExtractError("That ODT had no text in it.");
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

  if (!text) throw new ExtractError("That RTF had no text in it.");
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

/**
 * A photo, shrunk to something worth uploading.
 *
 * Phone cameras produce 4000px images of an A4 page. Everything above about
 * 2000px on the long edge is detail the model does not use and the person pays
 * for in upload time.
 */
async function toDataUrl(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file).catch(() => null);
  if (!bitmap) throw new ExtractError("That image couldn't be opened. Try a PNG or a JPEG.");

  const longest = Math.max(bitmap.width, bitmap.height);
  const scale = longest > 2000 ? 2000 / longest : 1;

  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const context = canvas.getContext("2d");
  if (!context) throw new ExtractError("This browser can't process that image.");
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();

  return canvas.toDataURL("image/jpeg", 0.85);
}
