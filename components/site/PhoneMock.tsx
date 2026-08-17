/**
 * Device mockups showing real product screens.
 *
 * Drawn in markup rather than exported as images for three reasons: they stay
 * sharp on every display, they cost nothing to load, and the copy inside them
 * can be edited like any other copy on the site.
 *
 * The palette stays monochrome, which is the harder version of this problem —
 * with no colour to lean on, hierarchy has to come from weight, size, spacing
 * and depth. That is also what separates a screen from a wireframe: real
 * sentences, real numbers, real icons, and light falling in one direction.
 */

// ---------------------------------------------------------------- icons

const S = {
  search: "M9 3a6 6 0 104.2 10.3l4.3 4.2 1.4-1.4-4.2-4.3A6 6 0 009 3zm0 2a4 4 0 110 8 4 4 0 010-8z",
  star: "M10 1.8l2.4 4.9 5.4.8-3.9 3.8.9 5.4-4.8-2.5-4.8 2.5.9-5.4L2.2 7.5l5.4-.8L10 1.8z",
  chevronL: "M12.5 4.2L6.7 10l5.8 5.8",
  chevronR: "M7.5 4.2L13.3 10l-5.8 5.8",
  video: "M3 6.5A1.5 1.5 0 014.5 5h7A1.5 1.5 0 0113 6.5v7A1.5 1.5 0 0111.5 15h-7A1.5 1.5 0 013 13.5v-7zM14.5 8.2l3-1.9v7.4l-3-1.9V8.2z",
  send: "M2.5 10L17 3.5 13.8 17l-4.2-4.3L15 6.5l-7.6 4.7L2.5 10z",
  plus: "M10 4.5v11M4.5 10h11",
  home: "M3 9.2L10 3.5l7 5.7V16a1 1 0 01-1 1h-4v-4.5H8V17H4a1 1 0 01-1-1V9.2z",
  people: "M7 9a2.6 2.6 0 100-5.2A2.6 2.6 0 007 9zm6.5.5a2.2 2.2 0 100-4.4 2.2 2.2 0 000 4.4zM2 16c0-2.5 2.2-4.2 5-4.2s5 1.7 5 4.2H2zm11.2 0c0-1.6-.6-2.9-1.6-3.8.6-.2 1.2-.3 1.9-.3 2.3 0 4.5 1.3 4.5 4.1h-4.8z",
  chat: "M10 3c-4 0-7 2.6-7 5.8 0 1.8 1 3.4 2.6 4.5L5 17l3.4-1.7c.5.1 1 .2 1.6.2 4 0 7-2.6 7-5.7S14 3 10 3z",
  user: "M10 10a3.2 3.2 0 100-6.4A3.2 3.2 0 0010 10zm0 1.6c-3 0-5.6 1.7-5.6 3.9V17h11.2v-1.5c0-2.2-2.6-3.9-5.6-3.9z",
  clock: "M10 2.5a7.5 7.5 0 100 15 7.5 7.5 0 000-15zm.8 3.7H9.3v4.6l3.7 2.2.8-1.2-3-1.8V6.2z",
  alert: "M10 2.6l8 14H2l8-14zm-.9 5v4.2h1.8V7.6H9.1zm0 5.4v1.8h1.8V13H9.1z",
  check: "M4 10.6l4 4 8-9",
  doc: "M5 2.8h6.2L16 7.6V17a.8.8 0 01-.8.8H5a.8.8 0 01-.8-.8V3.6A.8.8 0 015 2.8zm6 1.4v3.2h3.2L11 4.2z",
  bolt: "M11.6 1.8L4.4 11h4.3l-.9 7.2L15.6 9h-4.3l.3-7.2z",
};

function Icon({
  d,
  className = "",
  stroke = false,
}: {
  d: string;
  className?: string;
  stroke?: boolean;
}) {
  return (
    <svg
      viewBox="0 0 20 20"
      className={className}
      aria-hidden="true"
      fill={stroke ? "none" : "currentColor"}
      stroke={stroke ? "currentColor" : undefined}
      strokeWidth={stroke ? 1.8 : undefined}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={d} />
    </svg>
  );
}

// ---------------------------------------------------------------- chrome

/** The status bar. Small, but its absence is what makes a mockup look fake. */
function StatusBar() {
  return (
    <div className="absolute inset-x-0 top-0 z-20 flex h-9 items-center justify-between px-5 text-ink">
      <span className="text-[0.5rem] font-semibold tracking-tight tabular-nums">9:41</span>
      <div className="flex items-center gap-[3px]">
        {[3, 5, 7, 9].map((h, i) => (
          <span
            key={h}
            className="block w-[2px] rounded-[1px] bg-current"
            style={{ height: h, opacity: i === 3 ? 0.35 : 1 }}
          />
        ))}
        <svg viewBox="0 0 16 12" className="ml-[3px] h-[7px] w-[9px] fill-current">
          <path d="M8 10.5l2.2-2.4a3.2 3.2 0 00-4.4 0L8 10.5zM8 6a5.6 5.6 0 013.9 1.6l1.2-1.3A7.3 7.3 0 008 4a7.3 7.3 0 00-5.1 2.3l1.2 1.3A5.6 5.6 0 018 6z" />
        </svg>
        <span className="ml-[3px] flex h-[7px] w-[13px] items-center rounded-[2px] border border-current px-[1px] opacity-90">
          <span className="block h-[3px] w-[7px] rounded-[1px] bg-current" />
        </span>
      </div>
    </div>
  );
}

function PhoneFrame({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`relative aspect-[9/19] w-full ${className}`}>
      {/* Side buttons — the detail that reads as "device" rather than "card". */}
      <span className="absolute -left-[2px] top-[19%] h-[5%] w-[2px] rounded-l-sm bg-ink-15" />
      <span className="absolute -left-[2px] top-[27%] h-[8%] w-[2px] rounded-l-sm bg-ink-15" />
      <span className="absolute -right-[2px] top-[24%] h-[11%] w-[2px] rounded-r-sm bg-ink-15" />

      <div className="h-full w-full rounded-[2.75rem] bg-gradient-to-b from-ink-15 to-ink-30 p-[2px] shadow-[0_2px_4px_rgba(0,0,0,0.04),0_30px_70px_-24px_rgba(0,0,0,0.30)]">
        <div className="h-full w-full rounded-[2.65rem] bg-ink p-[3px]">
          <div className="relative h-full w-full overflow-hidden rounded-[2.45rem] bg-paper">
            {/* Dynamic island */}
            <div className="absolute left-1/2 top-[7px] z-30 h-[14px] w-[38%] -translate-x-1/2 rounded-full bg-ink" />
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}

/** Home indicator, so the screen looks like it ends where iOS ends. */
function HomeBar() {
  return (
    <div className="flex justify-center pb-1.5 pt-1">
      <span className="block h-[3px] w-[28%] rounded-full bg-ink-30" />
    </div>
  );
}

function Avatar({
  initials,
  size = "md",
  online = false,
}: {
  initials: string;
  size?: "sm" | "md" | "lg";
  online?: boolean;
}) {
  const dims = {
    sm: "size-6 text-[0.45rem]",
    md: "size-8 text-[0.52rem]",
    lg: "size-12 text-[0.75rem]",
  }[size];
  return (
    <span className="relative shrink-0">
      <span
        className={`flex ${dims} items-center justify-center rounded-full bg-gradient-to-br from-ink-70 to-ink font-semibold tracking-tight text-paper`}
      >
        {initials}
      </span>
      {online && (
        <span className="absolute -bottom-px -right-px size-[7px] rounded-full border-[1.5px] border-paper bg-ink" />
      )}
    </span>
  );
}

function TabBar({ active = 1 }: { active?: number }) {
  const tabs = [S.home, S.people, S.chat, S.user];
  return (
    <div className="flex items-center justify-around border-t border-ink-08 bg-paper/80 px-2 pt-2 backdrop-blur">
      {tabs.map((d, i) => (
        <Icon key={i} d={d} className={`size-[15px] ${i === active ? "text-ink" : "text-ink-30"}`} />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------- screens

/** Mentor discovery. */
export function PhoneScreenDiscover() {
  const mentors = [
    { i: "RS", n: "Rhea Sharma", r: "SDE-2 · Razorpay", p: "₹499", rt: "4.9", s: "128", on: true },
    { i: "AK", n: "Arjun Kapoor", r: "PM · Swiggy", p: "₹699", rt: "4.8", s: "94", on: false },
    { i: "MN", n: "Meera Nair", r: "Data · Flipkart", p: "Free", rt: "5.0", s: "41", on: true },
  ];
  return (
    <div className="flex h-full flex-col bg-gradient-to-b from-ink-04 to-paper">
      <StatusBar />
      <div className="px-4 pt-11">
        <p className="text-[0.42rem] font-medium uppercase tracking-[0.14em] text-ink-30">
          Bengaluru
        </p>
        <h3 className="mt-0.5 text-[0.82rem] font-semibold tracking-[-0.03em] text-ink">
          Find your person
        </h3>

        <div className="mt-2.5 flex items-center gap-1.5 rounded-xl border border-ink-08 bg-paper px-2.5 py-[7px] shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
          <Icon d={S.search} className="size-[11px] text-ink-30" />
          <span className="text-[0.5rem] text-ink-30">Search by company or role</span>
        </div>

        <div className="mt-2.5 flex gap-1.5">
          {["All", "SDE", "Product", "Data"].map((c, i) => (
            <span
              key={c}
              className={`rounded-full px-2 py-[3px] text-[0.45rem] font-medium ${
                i === 0 ? "bg-ink text-paper" : "border border-ink-08 bg-paper text-ink-50"
              }`}
            >
              {c}
            </span>
          ))}
        </div>
      </div>

      <div className="mt-2.5 flex-1 space-y-1.5 overflow-hidden px-4">
        {mentors.map((m) => (
          <div
            key={m.i}
            className="rounded-xl border border-ink-08 bg-paper p-2.5 shadow-[0_1px_3px_rgba(0,0,0,0.04)]"
          >
            <div className="flex items-center gap-2">
              <Avatar initials={m.i} online={m.on} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[0.55rem] font-semibold tracking-[-0.01em] text-ink">
                  {m.n}
                </p>
                <p className="truncate text-[0.47rem] text-ink-50">{m.r}</p>
              </div>
              <div className="text-right">
                <p className="text-[0.55rem] font-semibold tracking-[-0.02em] text-ink">{m.p}</p>
                <p className="text-[0.4rem] text-ink-30">30 min</p>
              </div>
            </div>
            <div className="mt-1.5 flex items-center gap-2 border-t border-ink-04 pt-1.5">
              <span className="flex items-center gap-[3px] text-[0.42rem] text-ink-50">
                <Icon d={S.star} className="size-[7px] text-ink" />
                {m.rt}
              </span>
              <span className="text-[0.42rem] text-ink-30">{m.s} sessions</span>
              {m.on && (
                <span className="ml-auto flex items-center gap-[3px] text-[0.42rem] font-medium text-ink">
                  <span className="size-[4px] rounded-full bg-ink" /> Free today
                </span>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="px-4 pb-2 pt-2">
        <div className="flex items-center justify-center gap-1 rounded-full bg-gradient-to-b from-ink-70 to-ink py-2 text-[0.52rem] font-medium text-paper shadow-[0_4px_12px_-4px_rgba(0,0,0,0.5)]">
          <Icon d={S.bolt} className="size-[9px]" /> Book a 30-min call
        </div>
      </div>
      <TabBar active={1} />
      <HomeBar />
    </div>
  );
}

/** One-to-one conversation. */
export function PhoneScreenChat() {
  /**
   * Who sits on which side is the whole readability of this screen.
   * "them" is Rhea, the mentor named in the header — left, light bubbles.
   * "me" is the student — right, dark bubbles. Getting this backwards makes
   * the header read as though Rhea is greeting herself, which is exactly how
   * an unreadable mockup happens.
   */
  const thread: { from: "me" | "them"; text?: string; file?: boolean }[] = [
    {
      from: "them",
      text: "Hey Ananya — got your booking for Wednesday. Anything you want me to look at before we talk?",
    },
    { from: "me", text: "Hi Rhea — final year at VIT, applying for backend roles." },
    { from: "them", text: "Nice. How many have you applied to, and how many replied?" },
    { from: "me", text: "Around 40 sent. 2 replies." },
    { from: "them", text: "That ratio is almost never the candidate. It's the resume not being read properly. Send it across?" },
    { from: "me", file: true },
    { from: "them", text: "Found it. Your skills sit in a sidebar, so the parser reads them into the middle of your job history." },
    {
      from: "them",
      text: "Put everything in one column instead. That one change usually takes a resume from 61 to about 85.",
    },
  ];

  return (
    <div className="flex h-full flex-col bg-gradient-to-b from-paper to-ink-04">
      <StatusBar />
      <div className="flex items-center gap-2 border-b border-ink-08 bg-paper/90 px-3 pb-2 pt-10 backdrop-blur">
        <Icon d={S.chevronL} className="size-[11px] text-ink-30" stroke />
        <Avatar initials="RS" size="sm" online />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[0.55rem] font-semibold tracking-[-0.01em] text-ink">
            Rhea Sharma
          </p>
          <p className="text-[0.42rem] text-ink-50">SDE-2 at Razorpay · Online</p>
        </div>
        <span className="flex size-6 items-center justify-center rounded-full border border-ink-08">
          <Icon d={S.video} className="size-[10px] text-ink" />
        </span>
      </div>

      <div className="flex flex-1 flex-col justify-end space-y-[5px] overflow-hidden px-3 pb-1 pt-2">
        {/* The booked session, pinned above the thread. It explains in one
            line what this conversation is and why the mentor showed up. */}
        <div className="mx-auto mb-1 flex items-center gap-1.5 rounded-full border border-ink-08 bg-paper px-2.5 py-1 shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
          <Icon d={S.clock} className="size-[8px] text-ink" />
          <span className="text-[0.42rem] font-medium text-ink">30-min session</span>
          <span className="text-[0.42rem] text-ink-30">Wed 20 Aug, 4:30 PM</span>
        </div>

        <p className="pb-0.5 text-center text-[0.4rem] font-medium text-ink-30">TODAY</p>

        {thread.map((m, i) => {
          const mine = m.from === "me";

          if (m.file) {
            return (
              <div
                key={i}
                className="ml-auto flex max-w-[80%] items-center gap-1.5 rounded-2xl rounded-tr-md bg-gradient-to-br from-ink-70 to-ink px-2 py-1.5 shadow-[0_2px_8px_-2px_rgba(0,0,0,0.4)]"
              >
                <span className="flex size-[17px] shrink-0 items-center justify-center rounded-md bg-white/15">
                  <Icon d={S.doc} className="size-[10px] text-paper" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[0.47rem] font-medium text-paper">
                    Ananya_Resume.pdf
                  </p>
                  <p className="text-[0.4rem] text-white/50">184 KB · ATS score 61</p>
                </div>
              </div>
            );
          }

          return (
            <div
              key={i}
              className={
                mine
                  ? "ml-auto max-w-[84%] rounded-2xl rounded-tr-md bg-gradient-to-br from-ink-70 to-ink px-2.5 py-1.5 shadow-[0_2px_8px_-2px_rgba(0,0,0,0.4)]"
                  : "mr-auto max-w-[84%] rounded-2xl rounded-tl-md border border-ink-08 bg-paper px-2.5 py-1.5 shadow-[0_1px_2px_rgba(0,0,0,0.03)]"
              }
            >
              <p
                className={`text-[0.5rem] leading-[1.45] ${mine ? "text-paper" : "text-ink"}`}
              >
                {m.text}
              </p>
            </div>
          );
        })}

        {/* Rhea is still typing — on her side, where a reply would arrive. */}
        <div className="mr-auto flex w-fit items-center gap-[3px] rounded-2xl rounded-tl-md border border-ink-08 bg-paper px-2.5 py-2">
          {[1, 0.6, 0.3].map((o, i) => (
            <span key={i} className="size-[3px] rounded-full bg-ink-30" style={{ opacity: o }} />
          ))}
        </div>
      </div>

      <div className="px-3 pb-1.5 pt-1.5">
        <div className="flex items-center gap-1.5 rounded-full border border-ink-08 bg-paper py-1 pl-2 pr-1 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
          <Icon d={S.plus} className="size-[11px] text-ink-30" stroke />
          <span className="flex-1 text-[0.48rem] text-ink-30">Message</span>
          <span className="flex size-[19px] items-center justify-center rounded-full bg-gradient-to-b from-ink-70 to-ink">
            <Icon d={S.send} className="size-[9px] text-paper" />
          </span>
        </div>
      </div>
      <HomeBar />
    </div>
  );
}

/** Slot picker and confirmation. */
export function PhoneScreenBooking() {
  return (
    <div className="flex h-full flex-col bg-gradient-to-b from-ink-04 to-paper">
      <StatusBar />
      <div className="px-3.5 pt-11">
        <div className="rounded-2xl border border-ink-08 bg-paper p-3 text-center shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
          <div className="flex justify-center">
            <Avatar initials="AK" size="lg" />
          </div>
          <p className="mt-1.5 text-[0.62rem] font-semibold tracking-[-0.02em] text-ink">
            Arjun Kapoor
          </p>
          <p className="text-[0.45rem] text-ink-50">Product Manager · Swiggy</p>
          <div className="mt-1.5 flex items-center justify-center gap-2 text-[0.42rem] text-ink-50">
            <span className="flex items-center gap-[3px]">
              <Icon d={S.star} className="size-[7px] text-ink" />
              4.8
            </span>
            <span className="text-ink-15">·</span>
            <span className="flex items-center gap-[3px]">
              <Icon d={S.clock} className="size-[7px]" />
              30 min
            </span>
          </div>
        </div>
      </div>

      <div className="mt-2.5 px-3.5">
        <div className="flex items-center justify-between">
          <p className="text-[0.52rem] font-semibold tracking-[-0.01em] text-ink">August</p>
          <div className="flex gap-1">
            <Icon d={S.chevronL} className="size-[9px] text-ink-30" stroke />
            <Icon d={S.chevronR} className="size-[9px] text-ink" stroke />
          </div>
        </div>

        <div className="mt-1.5 grid grid-cols-5 gap-1">
          {[["Mon", "18"], ["Tue", "19"], ["Wed", "20"], ["Thu", "21"], ["Fri", "22"]].map(
            ([d, n], i) => (
              <div
                key={n}
                className={`flex flex-col items-center rounded-lg py-1.5 ${
                  i === 2
                    ? "bg-gradient-to-b from-ink-70 to-ink text-paper shadow-[0_3px_8px_-3px_rgba(0,0,0,0.5)]"
                    : "border border-ink-08 bg-paper text-ink"
                }`}
              >
                <span className={`text-[0.38rem] ${i === 2 ? "text-white/60" : "text-ink-30"}`}>
                  {d}
                </span>
                <span className="text-[0.55rem] font-semibold tabular-nums tracking-tight">
                  {n}
                </span>
              </div>
            ),
          )}
        </div>
      </div>

      <div className="mt-2.5 flex-1 px-3.5">
        <p className="text-[0.42rem] font-medium uppercase tracking-[0.12em] text-ink-30">
          Available slots
        </p>
        <div className="mt-1.5 grid grid-cols-3 gap-1">
          {["10:00", "11:30", "2:00", "4:30", "6:00", "8:30"].map((t, i) => (
            <span
              key={t}
              className={`rounded-lg py-[5px] text-center text-[0.45rem] font-medium tabular-nums ${
                i === 3
                  ? "bg-ink text-paper"
                  : i === 1
                    ? "border border-ink-08 bg-ink-04 text-ink-30 line-through"
                    : "border border-ink-08 bg-paper text-ink"
              }`}
            >
              {t}
            </span>
          ))}
        </div>
      </div>

      <div className="px-3.5 pb-2">
        <div className="mb-1.5 space-y-[5px] rounded-lg border border-ink-08 bg-paper p-2">
          {["30-minute video call", "Ask anything — resume, offers, switching", "Notes shared after"].map(
            (t) => (
              <div key={t} className="flex items-center gap-1.5">
                <span className="flex size-[10px] shrink-0 items-center justify-center rounded-full bg-ink">
                  <Icon d={S.check} className="size-[6px] text-paper" stroke />
                </span>
                <span className="truncate text-[0.42rem] text-ink-50">{t}</span>
              </div>
            ),
          )}
        </div>
        <div className="mb-1.5 flex items-center justify-between rounded-lg bg-ink-04 px-2 py-1.5">
          <span className="text-[0.45rem] text-ink-50">Wed 20 Aug · 4:30 PM</span>
          <span className="text-[0.55rem] font-semibold tracking-[-0.02em] text-ink">₹699</span>
        </div>
        <div className="rounded-full bg-gradient-to-b from-ink-70 to-ink py-2 text-center text-[0.52rem] font-medium text-paper shadow-[0_4px_12px_-4px_rgba(0,0,0,0.5)]">
          Confirm booking
        </div>
      </div>
      <HomeBar />
    </div>
  );
}

/** ATS score and the fixes behind it. */
export function PhoneScreenResume() {
  const R = 26;
  const C = 2 * Math.PI * R;
  const score = 61;
  const rows = [
    { t: "Two-column layout", s: "fail" },
    { t: "Missing date ranges", s: "fail" },
    { t: "No skills section", s: "warn" },
    { t: "Contact details found", s: "ok" },
    { t: "Text extracts cleanly", s: "ok" },
  ];
  return (
    <div className="flex h-full flex-col bg-gradient-to-b from-ink-04 to-paper">
      <StatusBar />
      <div className="px-3.5 pt-10">
        <div className="flex items-center gap-1.5">
          <Icon d={S.doc} className="size-[10px] text-ink-30" />
          <p className="truncate text-[0.47rem] text-ink-50">Ananya_Resume.pdf</p>
        </div>

        <div className="relative mt-2 flex flex-col items-center rounded-2xl border border-ink-08 bg-paper py-3 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
          {/* Soft floor light behind the ring — depth without colour. */}
          <span className="pointer-events-none absolute inset-x-6 top-3 h-16 rounded-full bg-[radial-gradient(ellipse_at_center,rgba(0,0,0,0.07),transparent_70%)]" />
          <div className="relative">
            <svg viewBox="0 0 64 64" className="size-[62px] -rotate-90">
              <defs>
                <linearGradient id="ccScore" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#3d3d42" />
                  <stop offset="100%" stopColor="#000000" />
                </linearGradient>
              </defs>
              <circle cx="32" cy="32" r={R} fill="none" stroke="#e6e6e9" strokeWidth="5" />
              <circle
                cx="32"
                cy="32"
                r={R}
                fill="none"
                stroke="url(#ccScore)"
                strokeWidth="5"
                strokeLinecap="round"
                strokeDasharray={C}
                strokeDashoffset={C * (1 - score / 100)}
              />
            </svg>
            <span className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-[1.05rem] font-semibold leading-none tracking-[-0.05em] tabular-nums text-ink">
                {score}
              </span>
              <span className="text-[0.36rem] font-medium uppercase tracking-[0.1em] text-ink-30">
                of 100
              </span>
            </span>
          </div>
          <p className="mt-1.5 text-[0.55rem] font-semibold tracking-[-0.01em] text-ink">
            Two things are costing you
          </p>
          <p className="mt-0.5 px-4 text-center text-[0.42rem] leading-[1.4] text-ink-50">
            Fix these and the score moves to 84
          </p>
        </div>
      </div>

      <div className="mt-2 space-y-1 px-3.5">
        {rows.map((r) => (
          <div
            key={r.t}
            className="flex items-center gap-1.5 rounded-lg border border-ink-08 bg-paper px-2 py-[6px]"
          >
            <span
              className={`flex size-[13px] shrink-0 items-center justify-center rounded-full ${
                r.s === "ok"
                  ? "bg-ink"
                  : r.s === "warn"
                    ? "border border-ink-30"
                    : "bg-ink-04 ring-1 ring-inset ring-ink-15"
              }`}
            >
              {r.s === "ok" && <Icon d={S.check} className="size-[7px] text-paper" stroke />}
              {r.s === "fail" && <Icon d={S.alert} className="size-[8px] text-ink" />}
              {r.s === "warn" && <span className="size-[3px] rounded-full bg-ink-30" />}
            </span>
            <span
              className={`flex-1 truncate text-[0.47rem] ${
                r.s === "ok" ? "text-ink-50" : "font-medium text-ink"
              }`}
            >
              {r.t}
            </span>
            {r.s !== "ok" && <Icon d={S.chevronR} className="size-[7px] text-ink-30" stroke />}
          </div>
        ))}
      </div>

      {/* The category breakdown fills the lower third with something the real
          tool actually shows, rather than leaving dead space above the CTA. */}
      <div className="mt-2.5 flex-1 px-3.5">
        <p className="text-[0.4rem] font-medium uppercase tracking-[0.12em] text-ink-30">
          Breakdown
        </p>
        <div className="mt-1.5 space-y-1.5">
          {[
            ["Machine readability", 46],
            ["Contact & sections", 92],
            ["What your bullets say", 58],
            ["Skills & keywords", 40],
          ].map(([label, pct]) => (
            <div key={label as string}>
              <div className="flex items-baseline justify-between">
                <span className="text-[0.42rem] text-ink-50">{label}</span>
                <span className="text-[0.4rem] tabular-nums text-ink-30">{pct}%</span>
              </div>
              <span className="mt-[3px] block h-[3px] overflow-hidden rounded-full bg-ink-08">
                <span
                  className="block h-full rounded-full bg-gradient-to-r from-ink-70 to-ink"
                  style={{ width: `${pct}%` }}
                />
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="px-3.5 pb-2 pt-2">
        <div className="rounded-full bg-gradient-to-b from-ink-70 to-ink py-2 text-center text-[0.52rem] font-medium text-paper shadow-[0_4px_12px_-4px_rgba(0,0,0,0.5)]">
          Show me the fixes
        </div>
      </div>
      <HomeBar />
    </div>
  );
}

/** Hero arrangement: three staggered devices. */
export function PhoneCluster() {
  return (
    <div className="relative mx-auto flex w-full max-w-[900px] items-end justify-center gap-4 sm:gap-6">
      <div className="hidden w-[26%] translate-y-8 sm:block">
        <PhoneFrame className="opacity-[0.82]">
          <PhoneScreenBooking />
        </PhoneFrame>
      </div>

      <div className="w-[62%] sm:w-[34%]">
        <PhoneFrame>
          <PhoneScreenChat />
        </PhoneFrame>
      </div>

      <div className="hidden w-[26%] translate-y-8 sm:block">
        <PhoneFrame className="opacity-[0.82]">
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
  screen?: "discover" | "chat" | "booking" | "resume";
  className?: string;
}) {
  return (
    <PhoneFrame className={className}>
      {screen === "chat" && <PhoneScreenChat />}
      {screen === "booking" && <PhoneScreenBooking />}
      {screen === "discover" && <PhoneScreenDiscover />}
      {screen === "resume" && <PhoneScreenResume />}
    </PhoneFrame>
  );
}
