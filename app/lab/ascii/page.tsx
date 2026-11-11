import type { Metadata } from "next";
import { AsciiField } from "@/components/site/AsciiField";

// A preview of the character-field hero; not linked from anywhere and not indexed.
export const metadata: Metadata = {
  title: "ASCII field preview",
  robots: { index: false, follow: false },
};

export default function AsciiPreviewPage() {
  return (
    <main className="bg-[#05051a] text-white">
      <AsciiField
        intro={
          <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-white/60">
            Cheatcode — move your cursor, then scroll
          </p>
        }
      >
        <p className="font-display text-xl font-medium tracking-[-0.02em] text-white sm:text-3xl">
          You have a Cheatcode for your career.
        </p>
      </AsciiField>
      <section className="flex h-[60svh] items-center justify-center">
        <p className="font-mono text-xs uppercase tracking-[0.3em] text-white/40">Next section</p>
      </section>
    </main>
  );
}
