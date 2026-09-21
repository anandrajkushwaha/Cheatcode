import { OrbMark } from "@/components/studio/OrbMark";
import { CheckIcon, SparkIcon } from "@/components/studio/icons";
import { FREE_PERKS, PRO_PERKS } from "@/lib/studio/plan";

/**
 * "What you will get" — free on the left, Pro on the right.
 *
 * Three columns at the design's widths (434 / 166 / 136) on a wide screen,
 * collapsing to label-and-two-marks on a phone. The row pitch is one constant
 * rather than per-row spacing, because the three columns have to line up and
 * the only way to guarantee that is for them to share the number.
 *
 * The dash and the tick are drawn here rather than exported: the design's
 * versions live behind Figma asset URLs that expire in a week, which is the
 * same reason icons.tsx exists.
 *
 * "Coming soon" is not in the design. It is here because two of these five
 * perks do not exist yet, and this card sits directly above a button that
 * takes ₹99 — a list that quietly promises a mock-interview feature nobody
 * has built is a refund conversation, not a marketing one.
 */

const LABEL_COL = "min-w-0 flex-1 sm:w-[52%] sm:flex-none lg:w-[434px]";
const MARK_COL = "w-[72px] shrink-0 sm:w-[24%] lg:w-[166px]";
const PRO_COL = "w-[72px] shrink-0 sm:w-[24%] lg:w-[136px]";

function Dash() {
  return (
    <svg
      viewBox="0 0 19 19"
      aria-hidden
      className="size-[19px] text-[#b6b6c2]"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
    >
      <path d="M4 9.5h11" />
    </svg>
  );
}

export function ProCompare() {
  return (
    <div className="relative rounded-[20px] border-[3px] border-[#fdaa29] bg-paper px-5 pb-6 pt-9 shadow-[0_14px_20px_rgba(30,10,58,0.1)] sm:px-8 lg:pl-10 lg:pr-[42px]">
      <span className="absolute left-6 top-0 inline-flex items-center gap-1 rounded-b-[8px] bg-[#fdaa29] px-2 pb-1 pt-0.5 text-[0.625rem] font-medium leading-[9.45px] text-white shadow-[0_1px_1px_rgba(0,0,0,0.08)] sm:left-[42px]">
        <SparkIcon className="size-[11px]" />
        AI Powered
      </span>

      <div className="flex items-center">
        <div className={LABEL_COL}>
          <h2 className="text-[1.15rem] font-black leading-[25px] text-[#121224] sm:text-[1.375rem]">
            What you will get
          </h2>
        </div>
        <div className={`${MARK_COL} text-center`}>
          <span className="text-[0.8rem] font-medium leading-[22px] text-[#121224] sm:text-[1rem]">
            Current
          </span>
        </div>
        <div className={`${PRO_COL} flex items-center justify-center`}>
          <span className="flex items-center text-[0.8rem] font-extrabold leading-none text-[#161313] sm:text-[1rem]">
            PR
            <OrbMark className="ml-[1px] size-[0.95em]" />
          </span>
        </div>
      </div>

      <ul className="mt-6 sm:mt-8">
        {/* Free rows first, ticked on both sides: the table has to say what
            the free plan already includes, or it reads as "everything costs
            money" — which is what it used to say, wrongly. */}
        {[...FREE_PERKS.map((p) => ({ ...p, free: true })), ...PRO_PERKS.map((p) => ({ ...p, free: false }))].map(
          (perk, i, all) => (
            <li
              key={perk.title}
              className={`flex items-center py-[10px] ${
                i < all.length - 1 ? "border-b-[0.5px] border-[rgba(219,219,219,0.8)]" : ""
              }`}
            >
              <div className={`${LABEL_COL} min-w-0 pr-3`}>
                <span className="text-[0.85rem] font-medium leading-[22px] text-[#121224] sm:text-[1rem]">
                  {perk.title}
                </span>
                {perk.free && (
                  <span className="ml-2 inline-block whitespace-nowrap rounded-full bg-ink-04 px-2 py-[1px] align-middle text-[0.65rem] font-medium text-ink-50">
                    Free
                  </span>
                )}
                {!perk.built && (
                  <span className="ml-2 inline-block whitespace-nowrap rounded-full bg-ink-04 px-2 py-[1px] align-middle text-[0.65rem] font-medium text-ink-50">
                    Coming soon
                  </span>
                )}
              </div>
              <div className={`${MARK_COL} flex items-center justify-center`}>
                {perk.free ? <CheckIcon className="size-[19px] text-[#121224]" /> : <Dash />}
              </div>
              <div className={`${PRO_COL} flex items-center justify-center`}>
                <CheckIcon className="size-[19px] text-[#fdaa29]" />
              </div>
            </li>
          ),
        )}
      </ul>
    </div>
  );
}
