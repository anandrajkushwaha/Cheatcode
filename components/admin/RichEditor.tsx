"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * The article body editor.
 *
 * Built on contenteditable rather than a library, for one reason: the output
 * has to be a small, fixed set of tags. A general-purpose editor is designed to
 * express anything, and then you spend your time fighting the parts of it you
 * do not want. Here the toolbar only offers what the article template styles,
 * pasted content is stripped to plain text on the way in, and the server
 * sanitises again on save — so the worst a stray tag can do is disappear.
 */

type Props = {
  value: string;
  onChange: (html: string) => void;
  onRequestImage: () => Promise<string | null>;
};

const BLOCKS = [
  { label: "Text", tag: "p" },
  { label: "Heading", tag: "h2" },
  { label: "Subheading", tag: "h3" },
  { label: "Quote", tag: "blockquote" },
] as const;

export function RichEditor({ value, onChange, onRequestImage }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [block, setBlock] = useState("p");

  // Seed the DOM once. Re-writing innerHTML on every keystroke would move the
  // caret to the start of the document on each character.
  useEffect(() => {
    const el = ref.current;
    if (el && el.innerHTML !== value && document.activeElement !== el) {
      el.innerHTML = value || "<p></p>";
    }
  }, [value]);

  const emit = useCallback(() => {
    if (ref.current) onChange(ref.current.innerHTML);
  }, [onChange]);

  const exec = useCallback(
    (command: string, arg?: string) => {
      ref.current?.focus();
      document.execCommand(command, false, arg);
      emit();
    },
    [emit],
  );

  // Track which block the caret sits in, so the dropdown tells the truth.
  const syncBlock = useCallback(() => {
    const sel = window.getSelection();
    let node = sel?.anchorNode as HTMLElement | null;
    while (node && node !== ref.current) {
      const tag = node.nodeName?.toLowerCase();
      if (tag && ["p", "h2", "h3", "blockquote", "li"].includes(tag)) {
        setBlock(tag === "li" ? "p" : tag);
        return;
      }
      node = node.parentElement;
    }
    setBlock("p");
  }, []);

  /**
   * Paste as plain text.
   *
   * Pasting from Word or a web page brings inline styles, font tags and class
   * names that the sanitiser will delete on save anyway. Stripping on the way
   * in means what you see while writing is what gets stored — no surprise
   * reformatting after you press save.
   */
  function onPaste(e: React.ClipboardEvent) {
    e.preventDefault();
    const text = e.clipboardData.getData("text/plain");
    document.execCommand("insertText", false, text);
    emit();
  }

  function addLink() {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed) {
      alert("Select the words you want to turn into a link first.");
      return;
    }
    const href = prompt("Link to (a path like /blog/how-to-pass-ats, or a full https:// address)");
    if (!href) return;
    if (!/^(https?:\/\/|\/|#|mailto:)/i.test(href)) {
      alert("That doesn't look like a link. Use /blog/... for your own pages, or a full https:// address.");
      return;
    }
    exec("createLink", href);
  }

  async function insertImage() {
    const url = await onRequestImage();
    if (!url) return;
    ref.current?.focus();
    document.execCommand("insertHTML", false, `<img src="${url}" alt="">`);
    emit();
  }

  function insertTable() {
    const cols = Number(prompt("How many columns?", "3"));
    const rows = Number(prompt("How many rows, not counting the header?", "3"));
    if (!cols || !rows || cols < 1 || rows < 1 || cols > 8 || rows > 30) return;
    const head = `<tr>${"<th>Heading</th>".repeat(cols)}</tr>`;
    const body = `<tr>${"<td>—</td>".repeat(cols)}</tr>`.repeat(rows);
    ref.current?.focus();
    document.execCommand(
      "insertHTML", false,
      `<table><thead>${head}</thead><tbody>${body}</tbody></table><p></p>`,
    );
    emit();
  }

  const Btn = ({
    onClick, children, title, active,
  }: {
    onClick: () => void; children: React.ReactNode; title: string; active?: boolean;
  }) => (
    <button
      type="button"
      title={title}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={`rounded-lg px-2.5 py-1.5 text-[0.8rem] transition-colors ${
        active ? "bg-ink text-paper" : "text-ink-50 hover:bg-ink-04 hover:text-ink"
      }`}
    >
      {children}
    </button>
  );

  return (
    <div className="rounded-2xl border border-ink-15">
      <div className="flex flex-wrap items-center gap-1 border-b border-ink-08 p-2">
        <select
          value={block}
          onChange={(e) => exec("formatBlock", `<${e.target.value}>`)}
          className="mr-1 rounded-lg border border-ink-15 px-2 py-1.5 text-[0.8rem]"
        >
          {BLOCKS.map((b) => (
            <option key={b.tag} value={b.tag}>{b.label}</option>
          ))}
        </select>

        <Btn title="Bold" onClick={() => exec("bold")}><strong>B</strong></Btn>
        <Btn title="Italic" onClick={() => exec("italic")}><em>I</em></Btn>

        <span aria-hidden="true" className="mx-1 h-5 w-px bg-ink-08" />

        <Btn title="Bulleted list" onClick={() => exec("insertUnorderedList")}>• List</Btn>
        <Btn title="Numbered list" onClick={() => exec("insertOrderedList")}>1. List</Btn>

        <span aria-hidden="true" className="mx-1 h-5 w-px bg-ink-08" />

        <Btn title="Add a link" onClick={addLink}>Link</Btn>
        <Btn title="Remove the link" onClick={() => exec("unlink")}>Unlink</Btn>
        <Btn title="Insert an image" onClick={() => void insertImage()}>Image</Btn>
        <Btn title="Insert a table" onClick={insertTable}>Table</Btn>

        <span aria-hidden="true" className="mx-1 h-5 w-px bg-ink-08" />

        <Btn title="Strip all formatting from the selection" onClick={() => exec("removeFormat")}>
          Clear
        </Btn>
      </div>

      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        onInput={emit}
        onBlur={emit}
        onPaste={onPaste}
        onKeyUp={syncBlock}
        onMouseUp={syncBlock}
        data-editor
        className="prose-admin min-h-[26rem] max-w-none p-6 text-[0.98rem] leading-relaxed outline-none"
      />
    </div>
  );
}
