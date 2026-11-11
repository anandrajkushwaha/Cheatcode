import type { Metadata } from "next";
import { AsciiField } from "@/components/site/ascii-field/AsciiField";

// Preview of the character-field interaction; not linked from anywhere and not indexed.
export const metadata: Metadata = {
  title: "ASCII field preview",
  robots: { index: false, follow: false },
};

export default function AsciiPreviewPage() {
  return (
    <main className="bg-[#05051a] text-white">
      <AsciiField>
        <div className="flex flex-wrap items-center justify-center gap-x-14 gap-y-4 font-mono text-xs uppercase tracking-[0.3em] text-white/45">
          <span>Logo 1</span>
          <span>Logo 2</span>
          <span>Logo 3</span>
          <span>Logo 4</span>
          <span>Logo 5</span>
        </div>
      </AsciiField>
      <section className="flex h-[60svh] items-center justify-center">
        <p className="font-mono text-xs uppercase tracking-[0.3em] text-white/40">Next section</p>
      </section>
    </main>
  );
}
