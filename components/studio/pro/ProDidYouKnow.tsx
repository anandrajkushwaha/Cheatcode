/**
 * The dark "Did you know?" strip.
 *
 * The number is passed in rather than written here, and that is the whole
 * point of the component taking props at all. The design had a flat "100+"
 * baked into the artwork; a flat number on a live page is a claim about the
 * business that nobody re-checks, and it is wrong the day it ships. This one
 * is counted from the database, and the page hides the strip entirely when
 * the real number is too small to boast about — see lib/studio/proof.ts.
 */

export function ProDidYouKnow({ value, text }: { value: string; text: string }) {
  return (
    <div
      className="relative rounded-[12px] border border-[#fff3dd] px-5 pb-5 pt-8 shadow-[0_14px_20px_rgba(30,10,58,0.1)]"
      style={{
        backgroundImage:
          "linear-gradient(103.35deg, rgb(9,9,9) 18.62%, rgb(59,59,58) 46.28%, rgb(31,30,28) 73.94%)",
      }}
    >
      <span className="absolute left-5 top-0 rounded-b-[6px] bg-[#fff3dd] px-2.5 pb-1 pt-0.5 text-[0.75rem] font-medium leading-[15px] text-[#121224]">
        Did you know?
      </span>

      <p className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="text-[2rem] font-black leading-[30px] text-[#fdaa29] sm:text-[2.625rem]">
          {value}
        </span>
        <span className="text-[0.95rem] font-bold leading-[22px] text-white sm:text-[1.125rem]">
          {text}
        </span>
      </p>
    </div>
  );
}
