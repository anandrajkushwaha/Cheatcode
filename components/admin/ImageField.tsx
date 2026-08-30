"use client";

import { useRef, useState } from "react";

/**
 * Pick an image: drop a file, or paste a URL.
 *
 * Both paths exist on purpose. Uploading is the one-step version and needs a
 * storage bucket; pasting a URL needs nothing and always works. If the bucket
 * is missing, the upload fails with an explanation and the URL box is still
 * right there — so the editor is never blocked on infrastructure.
 */
export function ImageField({
  value,
  onChange,
  alt,
  onAltChange,
  upload,
  label = "Drop an image, or click to choose",
}: {
  value: string;
  onChange: (url: string) => void;
  alt?: string;
  onAltChange?: (alt: string) => void;
  upload: (file: File) => Promise<string | null>;
  label?: string;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [over, setOver] = useState(false);
  const [showUrl, setShowUrl] = useState(false);

  async function take(file: File | undefined | null) {
    if (!file) return;
    setBusy(true);
    const url = await upload(file);
    setBusy(false);
    if (url) onChange(url);
  }

  if (value) {
    return (
      <div>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={value}
          alt={alt || ""}
          className="w-full rounded-xl border border-ink-08 object-cover"
          style={{ aspectRatio: "16 / 9" }}
        />
        {onAltChange && (
          <input
            value={alt ?? ""}
            onChange={(e) => onAltChange(e.target.value)}
            placeholder="Describe the image, for screen readers"
            className="mt-3 w-full rounded-xl border border-ink-15 px-3 py-2 text-[0.82rem] outline-none focus:border-ink-30"
          />
        )}
        <button
          type="button"
          onClick={() => onChange("")}
          className="mt-3 text-[0.8rem] text-ink-30 underline underline-offset-4 hover:text-ink"
        >
          Remove
        </button>
      </div>
    );
  }

  return (
    <div>
      <input
        ref={input}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        className="hidden"
        onChange={(e) => void take(e.target.files?.[0])}
      />

      <button
        type="button"
        onClick={() => input.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setOver(true); }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          void take(e.dataTransfer.files?.[0]);
        }}
        disabled={busy}
        className={`flex w-full flex-col items-center justify-center rounded-xl border border-dashed px-4 py-8 text-center text-[0.82rem] transition-colors ${
          over ? "border-ink bg-ink-04 text-ink" : "border-ink-15 text-ink-30 hover:border-ink-30"
        }`}
      >
        {busy ? "Uploading…" : label}
      </button>

      <button
        type="button"
        onClick={() => setShowUrl((v) => !v)}
        className="mt-2.5 text-[0.78rem] text-ink-30 underline underline-offset-4 hover:text-ink"
      >
        {showUrl ? "hide" : "or paste an image address"}
      </button>

      {showUrl && (
        <input
          autoFocus
          placeholder="https://…"
          onKeyDown={(e) => {
            if (e.key !== "Enter") return;
            e.preventDefault();
            const v = (e.target as HTMLInputElement).value.trim();
            if (/^https?:\/\//i.test(v) || v.startsWith("/")) onChange(v);
          }}
          onBlur={(e) => {
            const v = e.target.value.trim();
            if (/^https?:\/\//i.test(v) || v.startsWith("/")) onChange(v);
          }}
          className="mt-2 w-full rounded-xl border border-ink-15 px-3 py-2 text-[0.82rem] outline-none focus:border-ink-30"
        />
      )}
    </div>
  );
}
