import Link from "next/link";
import { calculateSalary, inr, type Regime } from "@/lib/tools/salary";

/**
 * The monthly breakdown of an in-hand guide's package beside the packages
 * either side of it, under both regimes — computed, not written.
 *
 * Every LPA page gets the same three columns worked out for its own numbers
 * (the SEO PRD asks for both regimes, PF, professional tax and income tax,
 * and a comparison with the neighbouring levels on each). The assumptions
 * are the calculator's defaults, so this table, the hub table on the
 * calculator page and the calculator itself always agree.
 */

const BASE = {
  basicPercent: 45,
  state: "Karnataka",
  capPfAtCeiling: true,
  includeGratuity: true,
  otherDeductionsMonthly: 0,
};

export type Package = { lakhs: number; slug: string };

function label(lakhs: number) {
  return lakhs >= 100 ? `₹${lakhs / 100} crore` : `${lakhs} LPA`;
}

export function LpaCompare({ current, prev, next }: { current: Package; prev: Package | null; next: Package | null }) {
  const cols = [prev, current, next].filter((p): p is Package => p !== null);
  const calc = (p: Package, regime: Regime) => calculateSalary({ ...BASE, ctc: p.lakhs * 100_000, regime });
  const data = cols.map((p) => ({ p, n: calc(p, "new"), o: calc(p, "old") }));

  const rows: { label: string; value: (d: (typeof data)[number]) => number; strong?: boolean }[] = [
    { label: "Gross a month", value: (d) => d.n.grossAnnual / 12 },
    { label: "Employee PF", value: (d) => d.n.employeePfAnnual / 12 },
    { label: "Professional tax", value: (d) => d.n.professionalTaxAnnual / 12 },
    { label: "Tax, new regime", value: (d) => d.n.incomeTaxAnnual / 12 },
    { label: "In hand, new", value: (d) => d.n.netMonthly, strong: true },
    { label: "Tax, old regime", value: (d) => d.o.incomeTaxAnnual / 12 },
    { label: "In hand, old", value: (d) => d.o.netMonthly, strong: true },
  ];

  return (
    <section className="mt-12" aria-labelledby="lpa-compare">
      <h2 id="lpa-compare" className="text-[1.2rem] font-semibold tracking-[-0.02em]">
        {label(current.lakhs)} next to the packages around it
      </h2>
      <p className="mt-2 text-[0.88rem] leading-relaxed text-ink-50">
        Monthly figures with 45% basic, PF capped at the wage ceiling, gratuity included in CTC,
        Karnataka professional tax and no HRA or 80C claim — the{" "}
        <Link href="/tools/in-hand-salary-calculator" className="underline underline-offset-2">
          calculator&apos;s
        </Link>{" "}
        defaults. Change any of them there.
      </p>
      <div className="mt-5 overflow-x-auto">
        <table className="w-full min-w-[20rem] text-left text-[0.82rem] sm:text-[0.88rem] tabular-nums">
          <thead>
            <tr className="border-b border-ink-15">
              <th className="py-2 pr-4 font-medium text-ink-30" />
              {data.map((d) => (
                <th key={d.p.slug} className="py-2 pr-3 font-semibold">
                  {d.p.slug === current.slug ? (
                    label(d.p.lakhs)
                  ) : (
                    <Link href={`/blog/${d.p.slug}`} className="underline underline-offset-4">
                      {label(d.p.lakhs)}
                    </Link>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.label} className="border-b border-ink-08">
                <td className={`py-2 pr-3 ${r.strong ? "font-medium" : "text-ink-50"}`}>{r.label}</td>
                {data.map((d) => (
                  <td
                    key={d.p.slug}
                    className={`py-2 pr-3 ${r.strong ? "font-semibold" : ""} ${d.p.slug === current.slug ? "bg-ink-04" : ""}`}
                  >
                    {inr(r.value(d))}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
