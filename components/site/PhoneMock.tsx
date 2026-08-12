/**
 * Placeholder device mockup — drawn entirely in CSS/SVG, no image assets.
 * Swap the <PhoneScreen* /> internals for real app screenshots later;
 * the frame and shadow stay.
 */

function PhoneFrame({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`relative aspect-[9/19] w-full rounded-[2.75rem] border border-ink-15 bg-paper p-2.5 shadow-[0_2px_4px_rgba(0,0,0,0.03),0_24px_60px_-20px_rgba(0,0,0,0.22)] ${className}`}
    >
      {/* Screen */}
      <div className="relative h-full w-full overflow-hidden rounded-[2.1rem] bg-ink-04">
        {/* Notch */}
        <div className="absolute left-1/2 top-2.5 z-10 h-5 w-24 -translate-x-1/2 rounded-full bg-ink" />
        {children}
      </div>
    </div>
  );
}

function Bar({ w, dark = false }: { w: string; dark?: boolean }) {
  return (
    <div
      className={`h-2 rounded-full ${dark ? "bg-ink" : "bg-ink-15"}`}
      style={{ width: w }}
    />
  );
}

function Avatar({ initials }: { initials: string }) {
  return (
    <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-ink text-[0.65rem] font-semibold tracking-tight text-paper">
      {initials}
    </div>
  );
}

/** Screen 1 — a mentor list / discovery view. */
export function PhoneScreenDiscover() {
  return (
    <div className="flex h-full flex-col gap-4 px-4 pb-4 pt-11">
      <div className="space-y-2">
        <Bar w="45%" dark />
        <Bar w="65%" />
      </div>

      <div className="flex gap-2">
        {["All", "SDE", "Product", "Data"].map((chip, i) => (
          <div
            key={chip}
            className={`rounded-full px-3 py-1.5 text-[0.6rem] font-medium ${
              i === 0 ? "bg-ink text-paper" : "bg-paper text-ink-50"
            }`}
          >
            {chip}
          </div>
        ))}
      </div>

      <div className="flex-1 space-y-2.5">
        {[
          { initials: "RS", w: "70%" },
          { initials: "AK", w: "55%" },
          { initials: "MN", w: "64%" },
          { initials: "PT", w: "48%" },
        ].map((row) => (
          <div
            key={row.initials}
            className="flex items-center gap-3 rounded-2xl bg-paper p-3"
          >
            <Avatar initials={row.initials} />
            <div className="flex-1 space-y-1.5">
              <Bar w={row.w} dark />
              <Bar w="85%" />
            </div>
          </div>
        ))}
      </div>

      <div className="h-10 rounded-full bg-ink" />
    </div>
  );
}

/** Screen 2 — a 1-on-1 conversation view. */
export function PhoneScreenChat() {
  return (
    <div className="flex h-full flex-col gap-3 px-4 pb-4 pt-11">
      <div className="flex items-center gap-2.5 border-b border-ink-08 pb-3">
        <Avatar initials="RS" />
        <div className="flex-1 space-y-1.5">
          <Bar w="50%" dark />
          <Bar w="70%" />
        </div>
      </div>

      <div className="flex-1 space-y-3 pt-1">
        <div className="max-w-[78%] space-y-1.5 rounded-2xl rounded-tl-md bg-paper p-3">
          <Bar w="90%" />
          <Bar w="70%" />
        </div>
        <div className="ml-auto max-w-[70%] space-y-1.5 rounded-2xl rounded-tr-md bg-ink p-3">
          <div className="h-2 w-[85%] rounded-full bg-paper/70" />
          <div className="h-2 w-[55%] rounded-full bg-paper/40" />
        </div>
        <div className="max-w-[80%] space-y-1.5 rounded-2xl rounded-tl-md bg-paper p-3">
          <Bar w="95%" />
          <Bar w="80%" />
          <Bar w="45%" />
        </div>
      </div>

      <div className="h-9 rounded-full border border-ink-15 bg-paper" />
    </div>
  );
}

/** Screen 3 — a session booking / confirmation view. */
export function PhoneScreenBooking() {
  return (
    <div className="flex h-full flex-col gap-4 px-4 pb-4 pt-11">
      <div className="flex flex-col items-center gap-3 rounded-3xl bg-paper p-5 text-center">
        <div className="flex size-14 items-center justify-center rounded-full bg-ink text-sm font-semibold text-paper">
          AK
        </div>
        <div className="w-full space-y-1.5">
          <div className="mx-auto h-2 w-[55%] rounded-full bg-ink" />
          <div className="mx-auto h-2 w-[75%] rounded-full bg-ink-15" />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className={`flex h-11 items-center justify-center rounded-xl text-[0.6rem] font-medium ${
              i === 3 ? "bg-ink text-paper" : "bg-paper text-ink-30"
            }`}
          >
            <div
              className={`h-2 w-8 rounded-full ${
                i === 3 ? "bg-paper/70" : "bg-ink-15"
              }`}
            />
          </div>
        ))}
      </div>

      <div className="flex-1 space-y-2 rounded-2xl bg-paper p-4">
        <Bar w="40%" dark />
        <Bar w="90%" />
        <Bar w="72%" />
      </div>

      <div className="h-10 rounded-full bg-ink" />
    </div>
  );
}

/** Hero arrangement: three staggered devices. */
export function PhoneCluster() {
  return (
    <div className="relative mx-auto flex w-full max-w-[900px] items-end justify-center gap-4 sm:gap-6">
      <div className="hidden w-[26%] translate-y-8 sm:block">
        <PhoneFrame className="opacity-70">
          <PhoneScreenBooking />
        </PhoneFrame>
      </div>

      <div className="w-[62%] sm:w-[34%]">
        <PhoneFrame>
          <PhoneScreenChat />
        </PhoneFrame>
      </div>

      <div className="hidden w-[26%] translate-y-8 sm:block">
        <PhoneFrame className="opacity-70">
          <PhoneScreenDiscover />
        </PhoneFrame>
      </div>
    </div>
  );
}

export function SinglePhone({
  screen = "discover",
  className = "",
}: {
  screen?: "discover" | "chat" | "booking";
  className?: string;
}) {
  return (
    <PhoneFrame className={className}>
      {screen === "chat" && <PhoneScreenChat />}
      {screen === "booking" && <PhoneScreenBooking />}
      {screen === "discover" && <PhoneScreenDiscover />}
    </PhoneFrame>
  );
}
