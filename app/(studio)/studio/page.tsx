import { Composer } from "@/components/studio/Composer";

/**
 * The empty state, which is the screen most people see most often — and, as
 * the sidebar's New Chat link says out loud, the new chat itself.
 *
 * The greeting sits in a region that scrolls and the composer is pinned under
 * it, rather than both sharing one column that grows. At a short window the
 * greeting gives up its space first; the composer is the thing you came to
 * use, so it is the thing that never moves off screen.
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

      <div className="relative flex min-h-0 flex-1 items-center justify-center overflow-y-auto px-5 py-6 sm:px-8">
        <h1 className="max-w-[16ch] text-balance text-center text-[clamp(1.6rem,4.2vw,3.4rem)] font-normal leading-[1.15] tracking-[-0.03em] text-ink">
          Hey, let&apos;s make your next move count.
        </h1>
      </div>

      <div className="relative shrink-0 px-4 pb-4 sm:px-6 sm:pb-6 lg:px-8 lg:pb-8">
        <Composer suggestions={SUGGESTIONS} />
      </div>
    </div>
  );
}
