"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ToolAppCta, type ToolContext } from "@/components/tools/ToolAppCta";
import {
  calculateSalary,
  inr,
  PROFESSIONAL_TAX,
  RATES_AS_OF,
  type Regime,
} from "@/lib/tools/salary";

const STATES = Object.keys(PROFESSIONAL_TAX);

/**
 * @param context  See AtsChecker. Same calculator either side of the login;
 *                 different next step, and different copy for it — inviting
 *                 somebody to make the account they are already signed into is
 *                 the clearest way to tell them the page cannot see them.
 */
export function SalaryCalculator({ context = "public" }: { context?: ToolContext } = {}) {
  const [ctc, setCtc] = useState(800000);
  const [ctcText, setCtcText] = useState("800000");
  const [basicPercent, setBasicPercent] = useState(45);
  const [regime, setRegime] = useState<Regime>("new");
  const [state, setState] = useState("Karnataka");
  const [capPf, setCapPf] = useState(true);
  const [gratuity, setGratuity] = useState(true);
  const [other, setOther] = useState(0);
  const [otherText, setOtherText] = useState("0");
  const [touched, setTouched] = useState(false);

  const r = useMemo(
    () =>
      calculateSalary({
        ctc,
        basicPercent,
        regime,
        state,
        capPfAtCeiling: capPf,
        includeGratuity: gratuity,
        otherDeductionsMonthly: other,
      }),
    [ctc, basicPercent, regime, state, capPf, gratuity, other],
  );

  const field =
    "w-full rounded-xl border border-ink-15 bg-paper px-4 py-3 text-[16px] outline-none focus:border-ink sm:text-[0.95rem]";
  const label = "block text-[0.78rem] font-medium uppercase tracking-wider text-ink-30";

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_1.05fr] lg:gap-12">
      {/* ---------------- inputs ---------------- */}
      <div className="space-y-5">
        <div>
          <label htmlFor="ctc" className={label}>
            Annual CTC
          </label>
          {/* The raw text is what is shown, so the field can be emptied and
              retyped. It used to hold a number, and Number("") is 0 — so
              clearing it snapped to 0 and you had to delete six digits before
              typing a new figure on a phone. */}
          <input
            id="ctc"
            type="text"
            inputMode="numeric"
            value={ctcText}
            onChange={(e) => {
              const raw = e.target.value.replace(/[^0-9]/g, "").slice(0, 9);
              setCtcText(raw);
              setCtc(raw === "" ? 0 : Number(raw));
              setTouched(true);
            }}
            className={`${field} mt-2`}
          />
          <div className="mt-3 flex flex-wrap gap-2">
            {[400000, 600000, 800000, 1200000, 1800000].map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => {
                  setCtc(v);
                  setCtcText(String(v));
                  setTouched(true);
                }}
                className={`rounded-full px-3 py-1.5 text-[0.78rem] transition-colors ${
                  ctc === v ? "bg-ink text-paper" : "border border-ink-15 text-ink-50"
                }`}
              >
                {v / 100000} LPA
              </button>
            ))}
          </div>
        </div>

        <div>
          <label htmlFor="basic" className={label}>
            Basic salary — {basicPercent}% of CTC
          </label>
          <input
            id="basic"
            type="range"
            min={30}
            max={60}
            value={basicPercent}
            onChange={(e) => {
              setBasicPercent(Number(e.target.value));
              setTouched(true);
            }}
            className="mt-3 w-full accent-black"
          />
          <p className="mt-2 text-[0.78rem] text-ink-30">
            Check your offer letter. Most Indian employers use 40–50%.
          </p>
        </div>

        <div>
          <span className={label}>Tax regime</span>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {(["new", "old"] as const).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => {
                  setRegime(v);
                  setTouched(true);
                }}
                className={`rounded-xl px-4 py-3 text-[0.9rem] capitalize transition-colors ${
                  regime === v ? "bg-ink text-paper" : "border border-ink-15 text-ink-50"
                }`}
              >
                {v} regime
              </button>
            ))}
          </div>
        </div>

        <div>
          <label htmlFor="state" className={label}>
            State (for professional tax)
          </label>
          <select
            id="state"
            value={state}
            onChange={(e) => {
              setState(e.target.value);
              setTouched(true);
            }}
            className={`${field} mt-2`}
          >
            {STATES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="other" className={label}>
            Other monthly deductions
          </label>
          <input
            id="other"
            type="text"
            inputMode="numeric"
            value={otherText}
            onChange={(e) => {
              const raw = e.target.value.replace(/[^0-9]/g, "").slice(0, 7);
              setOtherText(raw);
              setOther(raw === "" ? 0 : Number(raw));
              setTouched(true);
            }}
            className={`${field} mt-2`}
          />
          <p className="mt-2 text-[0.78rem] text-ink-30">
            Insurance top-ups, canteen, NPS — anything already on your payslip.
          </p>
        </div>

        <div className="space-y-3 pt-1">
          <label className="flex items-start gap-3 text-[0.88rem] text-ink-70">
            <input
              type="checkbox"
              checked={capPf}
              onChange={(e) => setCapPf(e.target.checked)}
              className="mt-0.5 size-4 accent-black"
            />
            <span>
              Cap PF at the ₹15,000 wage ceiling
              <span className="block text-[0.78rem] text-ink-30">
                Most employers do. Uncheck if yours deducts 12% of full basic.
              </span>
            </span>
          </label>

          <label className="flex items-start gap-3 text-[0.88rem] text-ink-70">
            <input
              type="checkbox"
              checked={gratuity}
              onChange={(e) => setGratuity(e.target.checked)}
              className="mt-0.5 size-4 accent-black"
            />
            <span>
              Gratuity is included in my CTC
              <span className="block text-[0.78rem] text-ink-30">
                Common in India. You only receive it after 5 years.
              </span>
            </span>
          </label>
        </div>
      </div>

      {/* ---------------- result ---------------- */}
      <div>
        <div className="rounded-3xl bg-ink p-8 text-paper">
          <p className="text-[0.72rem] uppercase tracking-[0.16em] text-white/40">
            Take-home, per month
          </p>
          <p className="mt-3 text-[clamp(2.25rem,6vw,3.25rem)] font-semibold leading-none tracking-[-0.04em]">
            {inr(r.netMonthly)}
          </p>
          <p className="mt-3 text-[0.9rem] text-white/55">
            {inr(r.netAnnual)} a year from a {inr(ctc)} CTC — that is{" "}
            {((r.netAnnual / Math.max(1, ctc)) * 100).toFixed(0)}% of the number on your
            offer letter.
          </p>
        </div>

        <div className="mt-6 overflow-hidden rounded-2xl border border-ink-08">
          <table className="w-full text-[0.88rem]">
            <tbody className="divide-y divide-ink-08">
              {[
                ["Annual CTC", ctc, false],
                ["− Employer PF contribution", -r.employerPfAnnual, false],
                ["− Gratuity provision", -r.gratuityAnnual, false],
                ["Gross salary (on payslip)", r.grossAnnual, true],
                ["− Your PF (12%)", -r.employeePfAnnual, false],
                ["− Professional tax", -r.professionalTaxAnnual, false],
                ["− Income tax + cess", -r.incomeTaxAnnual, false],
                ["− Other deductions", -other * 12, false],
                ["Net in hand (annual)", r.netAnnual, true],
              ].map(([lbl, val, bold]) => (
                <tr key={lbl as string} className={bold ? "bg-ink-04" : ""}>
                  <td className={`px-5 py-3 ${bold ? "font-medium" : "text-ink-50"}`}>
                    {lbl as string}
                  </td>
                  <td
                    className={`px-5 py-3 text-right tabular-nums ${
                      bold ? "font-medium" : "text-ink-50"
                    }`}
                  >
                    {(val as number) < 0 ? "−" : ""}
                    {inr(Math.abs(val as number))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="mt-4 text-[0.78rem] leading-relaxed text-ink-30">
          Based on {RATES_AS_OF}. No HRA exemption or 80C investment is assumed, so
          your actual take-home may be higher. Tax rules change with every Budget —
          verify against current Income Tax Department guidance before making a
          financial decision. This is information, not financial advice.
        </p>

        {touched && (
          <aside className="mt-8 rounded-3xl border border-ink-08 p-7">
            <p className="text-[1.05rem] font-medium leading-snug tracking-[-0.02em]">
              {r.netMonthly < 30000
                ? "That gap between the offer and your account is normal — and negotiable."
                : "Most people accept the first number they are offered."}
            </p>
            <p className="mt-2.5 max-w-[46ch] text-[0.92rem] leading-relaxed text-ink-50">
              {context === "app"
                ? "This number is decided by the offer you are given, not by the arithmetic. The band is set by the roles you apply to and the rounds you clear — both of which are a tab away."
                : "This number is decided by the offer you are given, not by the arithmetic. A free account keeps this calculator alongside the things that move the offer itself — roles matched to you, a resume that survives the screen, and interview practice before the round that sets your band."}
            </p>
            {context === "app" ? (
              <Link
                href="/app/jobs"
                data-ev="tool_result_cta"
                data-ev-location="salary-calculator-app"
                data-ev-label="See roles matched to you"
                className="mt-5 inline-flex items-center justify-center whitespace-nowrap rounded-full bg-ink px-5 py-2.5 text-[0.85rem] font-medium text-paper transition-transform duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] hover:scale-[1.03] active:scale-[0.97]"
              >
                See roles matched to you
              </Link>
            ) : (
              <ToolAppCta
                appHref="/app/tools/salary"
                location="salary-calculator"
                label="Create a free account"
                className="mt-5 px-5 py-2.5 text-[0.85rem]"
              />
            )}
          </aside>
        )}
      </div>
    </div>
  );
}
