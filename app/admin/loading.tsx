/**
 * What every admin screen shows while its numbers load: the shape of a page —
 * a title, a row of cards, a chart and a table — gently pulsing, instead of a
 * blank screen that looks stuck.
 */
export default function AdminLoading() {
  const block = "animate-pulse rounded-[1.25rem] bg-ink-04";
  return (
    <div className="space-y-5" aria-busy="true" aria-label="Loading">
      <div className="space-y-2">
        <div className="h-7 w-56 animate-pulse rounded-lg bg-ink-04" />
        <div className="h-4 w-80 animate-pulse rounded-lg bg-ink-04" />
      </div>
      <div className="flex gap-2">
        {Array.from({ length: 5 }, (_, i) => (
          <div key={i} className="h-8 w-20 animate-pulse rounded-full bg-ink-04" />
        ))}
      </div>
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {Array.from({ length: 5 }, (_, i) => (
            <div key={i} className="h-[9.5rem] animate-pulse rounded-[1.25rem] bg-paper" />
          ))}
        </div>
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="h-[22rem] animate-pulse rounded-[1.25rem] bg-paper lg:col-span-2" />
          <div className="h-[22rem] animate-pulse rounded-[1.25rem] bg-paper" />
        </div>
        <div className={`h-48 ${block} bg-paper`} />
      </div>
    </div>
  );
}
