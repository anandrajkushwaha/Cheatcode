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

/**
 * Jobs, as the app actually shows them.
 *
 * This screen used to be a mentor marketplace — "Find your person", three
 * invented mentors with ratings, prices and a "Book a 30-min call" button.
 * None of that exists: no mentors table, no booking, no payment. A hero
 * image of a product we cannot deliver is a worse promise than a sentence,
 * because nobody reads a picture sceptically.
 */
export function PhoneScreenDiscover() {
  const jobs = [
    { c: "Razorpay", r: "Backend Engineer", m: "Bengaluru · 0–2 yrs", p: "2d ago", n: true },
    { c: "Swiggy", r: "Associate Product Manager", m: "Remote · 1–3 yrs", p: "4d ago", n: false },
    { c: "Zoho", r: "Data Analyst", m: "Chennai · 0–1 yrs", p: "6d ago", n: false },
  ];
  return (
    <div className="flex h-full flex-col bg-gradient-to-b from-ink-04 to-paper">
      <StatusBar />
      <div className="px-4 pt-11">
        <p className="text-[0.42rem] font-medium uppercase tracking-[0.14em] text-ink-30">
          1,240 open roles
        </p>
        <h3 className="mt-0.5 text-[0.82rem] font-semibold tracking-[-0.03em] text-ink">
          Worth applying to
        </h3>

        <div className="mt-2.5 flex items-center gap-1.5 rounded-xl border border-ink-08 bg-paper px-2.5 py-[7px] shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
          <Icon d={S.search} className="size-[11px] text-ink-30" />
          <span className="text-[0.5rem] text-ink-30">Role, company or skill</span>
        </div>

        <div className="mt-2.5 flex gap-1.5">
          {["Bengaluru", "0–2 yrs", "Remote", "New"].map((c, i) => (
            <span
              key={c}
              className={`rounded-full px-2 py-[3px] text-[0.45rem] font-medium ${
                i < 2 ? "bg-ink text-paper" : "border border-ink-08 bg-paper text-ink-50"
              }`}
            >
              {c}
            </span>
          ))}
        </div>
      </div>

      <div className="mt-2.5 flex-1 space-y-1.5 overflow-hidden px-4">
        {jobs.map((j) => (
          <div
            key={j.c}
            className="rounded-xl border border-ink-08 bg-paper p-2.5 shadow-[0_1px_3px_rgba(0,0,0,0.04)]"
          >
            <div className="flex items-start gap-2">
              <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-ink-08 text-[0.5rem] font-semibold text-ink">
                {j.c.slice(0, 1)}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[0.55rem] font-semibold tracking-[-0.01em] text-ink">
                  {j.r}
                </p>
                <p className="truncate text-[0.47rem] text-ink-50">{j.c}</p>
              </div>
              {j.n && (
                <span className="shrink-0 rounded-full bg-ink px-1.5 py-[2px] text-[0.4rem] font-medium text-paper">
                  New
                </span>
              )}
            </div>
            <div className="mt-1.5 flex items-center gap-2 border-t border-ink-04 pt-1.5">
              <span className="text-[0.42rem] text-ink-50">{j.m}</span>
              <span className="ml-auto flex items-center gap-[3px] text-[0.42rem] text-ink-30">
                <Icon d={S.clock} className="size-[7px]" />
                {j.p}
              </span>
            </div>
          </div>
        ))}
      </div>

      <div className="px-4 pb-2 pt-2">
        <div className="flex items-center justify-center gap-1 rounded-full bg-gradient-to-b from-ink-70 to-ink py-2 text-[0.52rem] font-medium text-paper shadow-[0_4px_12px_-4px_rgba(0,0,0,0.5)]">
          <Icon d={S.bolt} className="size-[9px]" /> Apply on the company site
        </div>
      </div>
      <TabBar active={1} />
      <HomeBar />
    </div>
  );
}

/**
 * The career agent, mid-conversation.
 *
 * Was a chat with an invented mentor called Rhea Sharma, complete with an
 * online dot and a video-call button. It is the agent now, which is the
 * thing that answers at one in the morning and the thing that exists.
 */
export function PhoneScreenChat() {
  // Left bubbles are the agent, right are the person. The rhythm matters more
  // than the words: a wall of one-sided text does not read as a conversation.
  const thread = [
    { me: false, t: "You have sent 40 applications and had 2 replies. That ratio is almost never the candidate." },
    { me: true, t: "So what is it?" },
    { me: false, t: "Your skills sit in a sidebar. The parser reads them into the middle of your job history, so the roles look like nonsense." },
    { me: true, t: "Fix it?" },
    { me: false, t: "One column instead. That single change usually takes a resume from 61 to about 85." },
  ];
  return (
    <div className="flex h-full flex-col bg-paper">
      <StatusBar />
      <div className="flex items-center gap-2 border-b border-ink-08 px-3.5 pb-2 pt-11">
        <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-ink-70 to-ink">
          <Icon d={S.bolt} className="size-[11px] text-paper" />
        </span>
        <div className="min-w-0">
          <p className="truncate text-[0.58rem] font-semibold tracking-[-0.01em] text-ink">
            Career agent
          </p>
          <p className="truncate text-[0.45rem] text-ink-50">Has read Ananya_Resume.pdf</p>
        </div>
      </div>

      <div className="flex-1 space-y-1.5 overflow-hidden px-3 py-2.5">
        {thread.map((m, i) => (
          <div key={i} className={`flex ${m.me ? "justify-end" : "justify-start"}`}>
            <p
              className={`max-w-[82%] rounded-2xl px-2.5 py-[7px] text-[0.5rem] leading-relaxed ${
                m.me
                  ? "rounded-br-md bg-ink text-paper"
                  : "rounded-bl-md bg-ink-04 text-ink-70"
              }`}
            >
              {m.t}
            </p>
          </div>
        ))}
        <div className="flex justify-start">
          <span className="flex gap-[3px] rounded-2xl rounded-bl-md bg-ink-04 px-2.5 py-2">
            {[0, 1, 2].map((d) => (
              <span key={d} className="block size-[3px] rounded-full bg-ink-30" />
            ))}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-2 border-t border-ink-08 px-3 py-2">
        <Icon d={S.plus} className="size-[12px] text-ink-30" stroke />
        <span className="flex-1 text-[0.5rem] text-ink-30">Ask anything</span>
        <span className="flex size-6 items-center justify-center rounded-full bg-ink">
          <Icon d={S.send} className="size-[9px] text-paper" />
        </span>
      </div>
      <HomeBar />
    </div>
  );
}

/**
 * The written report after a mock interview.
 *
 * Replaces a slot picker with a date grid and a ₹699 "Confirm booking"
 * button — a checkout for something that cannot be bought.
 */
export function PhoneScreenBooking() {
  const answers = [
    { q: "Tell me about yourself", v: "Weak", bad: true },
    { q: "Why this role?", v: "Good", bad: false },
    { q: "A project you owned", v: "Weak", bad: true },
    { q: "Where in five years", v: "Good", bad: false },
  ];
  return (
    <div className="flex h-full flex-col bg-gradient-to-b from-ink-04 to-paper">
      <StatusBar />
      <div className="px-4 pt-11">
        <p className="text-[0.42rem] font-medium uppercase tracking-[0.14em] text-ink-30">
          Backend Engineer · 4 questions
        </p>
        <h3 className="mt-0.5 text-[0.82rem] font-semibold tracking-[-0.03em] text-ink">
          How that interview went
        </h3>
      </div>

      <div className="mt-3 space-y-1.5 px-4">
        {answers.map((a) => (
          <div
            key={a.q}
            className="flex items-center gap-2 rounded-xl border border-ink-08 bg-paper px-2.5 py-2 shadow-[0_1px_2px_rgba(0,0,0,0.03)]"
          >
            <Icon
              d={a.bad ? S.alert : S.check}
              className={`size-[10px] shrink-0 ${a.bad ? "text-ink" : "text-ink-30"}`}
              stroke={!a.bad}
            />
            <p className="min-w-0 flex-1 truncate text-[0.5rem] text-ink-70">{a.q}</p>
            <span
              className={`shrink-0 text-[0.45rem] font-medium ${
                a.bad ? "text-ink" : "text-ink-30"
              }`}
            >
              {a.v}
            </span>
          </div>
        ))}
      </div>

      <div className="mx-4 mt-3 flex-1 overflow-hidden rounded-xl border border-ink-08 bg-paper p-2.5">
        <p className="text-[0.42rem] font-medium uppercase tracking-[0.12em] text-ink-30">
          Your answer, rewritten
        </p>
        <p className="mt-1.5 text-[0.5rem] leading-relaxed text-ink-70">
          &ldquo;I built the payments retry service at my internship — it cut failed
          transactions from 9% to under 2% over six weeks.&rdquo;
        </p>
        <p className="mt-2 border-t border-ink-04 pt-1.5 text-[0.45rem] leading-relaxed text-ink-50">
          You said what the team did. Say what you did, and put a number on it.
        </p>
      </div>

      <div className="px-4 pb-2 pt-2.5">
        <div className="flex items-center justify-center rounded-full bg-gradient-to-b from-ink-70 to-ink py-2 text-[0.52rem] font-medium text-paper shadow-[0_4px_12px_-4px_rgba(0,0,0,0.5)]">
          Try that round again
        </div>
      </div>
      <HomeBar />
    </div>
  );
}

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
      {/* The ATS report takes the centre because it is the one screen that
          makes the problem legible in a glance — a number, and two things
          costing you it. The agent and the job list flank it. */}
      <div className="hidden w-[26%] translate-y-8 sm:block">
        <PhoneFrame className="opacity-[0.82]">
          <PhoneScreenDiscover />
        </PhoneFrame>
      </div>

      <div className="w-[62%] sm:w-[34%]">
        <PhoneFrame>
          <PhoneScreenResume />
        </PhoneFrame>
      </div>

      <div className="hidden w-[26%] translate-y-8 sm:block">
        <PhoneFrame className="opacity-[0.82]">
          <PhoneScreenChat />
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
