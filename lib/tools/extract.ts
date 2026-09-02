/**
 * Pulls text and layout facts out of a resume file, entirely in the browser.
 *
 * Nothing is uploaded. That is a deliberate product decision as much as a
 * technical one — people are being asked to hand over a document with their
 * phone number and salary history on it, and the honest version of that is a
 * tool that never receives the file at all.
 */

import type { ResumeFacts } from "./ats";

export class ExtractError extends Error {}

const MAX_BYTES = 8 * 1024 * 1024;

export async function extractResume(file: File): Promise<ResumeFacts> {
  if (file.size > MAX_BYTES) {
    throw new ExtractError("That file is over 8 MB. Export a lighter PDF and try again.");
  }

  const name = file.name.toLowerCase();

  if (name.endsWith(".pdf")) return extractPdf(file);
  if (name.endsWith(".docx")) return extractDocx(file);
  if (name.endsWith(".txt")) return extractTxt(file);

  if (name.endsWith(".doc")) {
    throw new ExtractError(
      "The old .doc format can't be read in a browser — and most parsers struggle with it too. Open it and save as .docx or PDF.",
    );
  }
  if (/\.(png|jpe?g|webp|heic)$/.test(name)) {
    throw new ExtractError(
      "That's an image. An ATS gets exactly nothing from an image — which is itself the answer. Export a real PDF from your editor.",
    );
  }
  throw new ExtractError("Upload a PDF, DOCX or TXT file.");
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

// ------------------------------------------------------------------- TXT

async function extractTxt(file: File): Promise<ResumeFacts> {
  const text = (await file.text()).trim();
  const words = text.split(/\s+/).filter(Boolean).length;
  const pages = Math.max(1, Math.round(words / 500));
  return {
    text,
    fileType: "txt",
    pages,
    charsPerPage: Array.from({ length: pages }, () => Math.round(text.replace(/\s/g, "").length / pages)),
    multiColumnPages: 0,
  };
}
