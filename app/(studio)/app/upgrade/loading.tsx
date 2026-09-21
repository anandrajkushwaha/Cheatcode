/**
 * Shown the instant a Pro card or button is pressed.
 *
 * /app/upgrade is rendered on the server per visit (plan, reviews, proof), so
 * without this the old screen stayed put until all of that came back, and a
 * tap on a card felt like it had missed. With a loading boundary the router
 * can swap to this straight away — it is also what router.prefetch fetches
 * ahead of time for a dynamic page — and the real page streams in over it.
 *
 * Same dark band and proportions as ProHero, so the page settles rather than
 * jumps.
 */
export default function UpgradeLoading() {
  return (
    <div aria-busy="true" aria-label="Loading Pro" className="space-y-6">
      <div
        className="relative -mx-3 -mt-5 h-[300px] overflow-hidden bg-[#161616] bg-[length:100%_100%] bg-no-repeat sm:-mx-5 sm:-mt-6 sm:h-[360px]"
        style={{ backgroundImage: "url('/pro-hero-bg.png')" }}
      >
        <div className="mx-auto flex h-full max-w-[1160px] flex-col justify-center gap-4 px-6">
          <div className="h-10 w-56 animate-pulse rounded-lg bg-white/15" />
          <div className="h-4 w-72 animate-pulse rounded bg-white/10" />
          <div className="mt-2 h-11 w-44 animate-pulse rounded-full bg-white/20" />
        </div>
      </div>
      <div className="mx-auto h-[320px] max-w-[760px] animate-pulse rounded-[20px] border-[3px] border-[#fdaa29]/40 bg-paper" />
    </div>
  );
}
