import { Composer } from "@/components/studio/Composer";

/**
 * The empty state, which is the screen most people see most often.
 *
 * Laid out as a column with the greeting centred in the space that is left
 * over rather than positioned at a percentage of the viewport: the composer
 * is anchored to the bottom, the greeting takes the rest, and the two never
 * argue about where the middle is at an awkward window height.
 */

const SUGGESTIONS = [
  { label: "Create my resume" },
  { label: "Check my ATS score" },
  { label: "Find jobs for me" },
];

export default function StudioHomePage() {
  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      {/* The wash in the lower-left corner. Purely atmospheric, and behind
          everything, so it can never intercept a click. */}
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-40 -left-32 size-[440px] rounded-full bg-[radial-gradient(circle,rgba(163,190,255,0.45),transparent_70%)] blur-2xl"
      />

      <div className="relative flex min-h-0 flex-1 items-center justify-center px-8">
        <h1 className="max-w-[16ch] text-center text-[clamp(2rem,3.6vw,3.4rem)] font-normal leading-[1.15] tracking-[-0.03em] text-ink">
          Hey, let&apos;s make your next move count.
        </h1>
      </div>

      <div className="relative px-8 pb-8">
        <Composer suggestions={SUGGESTIONS} />
      </div>
    </div>
  );
}
