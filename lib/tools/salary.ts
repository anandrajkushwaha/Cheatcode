/**
 * In-hand salary maths for India.
 *
 * Rates below reflect the FY 2026-27 position at the time of writing
 * (August 2026). Tax rules change with every Budget — the UI shows a
 * "verify before acting" note, and RATES_AS_OF is rendered on the page.
 */
export const RATES_AS_OF = "FY 2026-27 (August 2026)";

export type Regime = "new" | "old";

/** [upTo, rate] — upTo is Infinity for the top slab. */
const NEW_SLABS: [number, number][] = [
  [400_000, 0],
  [800_000, 0.05],
  [1_200_000, 0.1],
  [1_600_000, 0.15],
  [2_000_000, 0.2],
  [2_400_000, 0.25],
  [Infinity, 0.3],
];

const OLD_SLABS: [number, number][] = [
  [250_000, 0],
  [500_000, 0.05],
  [1_000_000, 0.2],
  [Infinity, 0.3],
];

export const STANDARD_DEDUCTION = { new: 75_000, old: 50_000 } as const;

/** Taxable income at or below this gets a full rebate under s.87A. */
const REBATE_LIMIT = { new: 1_200_000, old: 500_000 } as const;
const CESS = 0.04;

/** Monthly professional tax, by state. Approximate top-slab values. */
export const PROFESSIONAL_TAX: Record<string, number> = {
  "Maharashtra": 200,
  "Karnataka": 200,
  "West Bengal": 200,
  "Tamil Nadu": 208,
  "Telangana": 200,
  "Andhra Pradesh": 200,
  "Gujarat": 200,
  "Madhya Pradesh": 208,
  "Kerala": 208,
  "Odisha": 200,
  "Assam": 208,
  "Bihar": 208,
  "Jharkhand": 208,
  "Delhi (none)": 0,
  "Uttar Pradesh (none)": 0,
  "Haryana (none)": 0,
  "Rajasthan (none)": 0,
  "Other / not sure": 0,
};

/** EPF is 12% of basic, and most employers cap the basis at ₹15,000/month. */
const PF_WAGE_CEILING_MONTHLY = 15_000;
const PF_RATE = 0.12;
const GRATUITY_RATE = 0.0481; // 15/26 ÷ 12, the standard CTC provisioning figure

function slabTax(income: number, slabs: [number, number][]) {
  let tax = 0;
  let lower = 0;
  for (const [upTo, rate] of slabs) {
    if (income > lower) {
      tax += (Math.min(income, upTo) - lower) * rate;
      lower = upTo;
    } else break;
  }
  return tax;
}

export type SalaryInput = {
  ctc: number;
  basicPercent: number; // of CTC, typically 40–50
  regime: Regime;
  state: string;
  capPfAtCeiling: boolean;
  includeGratuity: boolean;
  otherDeductionsMonthly: number;
};

export type SalaryResult = {
  basicAnnual: number;
  hraAnnual: number;
  specialAnnual: number;
  employerPfAnnual: number;
  gratuityAnnual: number;
  grossAnnual: number;
  employeePfAnnual: number;
  professionalTaxAnnual: number;
  taxableIncome: number;
  incomeTaxAnnual: number;
  totalDeductionsAnnual: number;
  netAnnual: number;
  netMonthly: number;
  effectiveTaxRate: number;
};

export function calculateSalary(input: SalaryInput): SalaryResult {
  const ctc = Math.max(0, input.ctc);
  const basicAnnual = ctc * (input.basicPercent / 100);
  const monthlyBasic = basicAnnual / 12;

  const pfBasis = input.capPfAtCeiling
    ? Math.min(monthlyBasic, PF_WAGE_CEILING_MONTHLY)
    : monthlyBasic;

  const employerPfAnnual = pfBasis * PF_RATE * 12;
  const employeePfAnnual = employerPfAnnual;
  const gratuityAnnual = input.includeGratuity ? basicAnnual * GRATUITY_RATE : 0;

  // Gross = what appears on the payslip, i.e. CTC minus employer-side provisions.
  const grossAnnual = Math.max(0, ctc - employerPfAnnual - gratuityAnnual);

  const hraAnnual = basicAnnual * 0.5;
  const specialAnnual = Math.max(0, grossAnnual - basicAnnual - hraAnnual);

  const professionalTaxAnnual = (PROFESSIONAL_TAX[input.state] ?? 0) * 12;

  // Deliberately conservative: no HRA exemption or 80C assumed. Most freshers
  // claim neither in year one, and over-promising the in-hand figure is the
  // exact mistake this tool exists to correct.
  const standardDeduction = STANDARD_DEDUCTION[input.regime];
  const taxableIncome = Math.max(
    0,
    grossAnnual - standardDeduction - (input.regime === "old" ? employeePfAnnual : 0),
  );

  let tax = slabTax(taxableIncome, input.regime === "new" ? NEW_SLABS : OLD_SLABS);
  if (taxableIncome <= REBATE_LIMIT[input.regime]) tax = 0;
  const incomeTaxAnnual = tax * (1 + CESS);

  const otherAnnual = Math.max(0, input.otherDeductionsMonthly) * 12;
  const totalDeductionsAnnual =
    employeePfAnnual + professionalTaxAnnual + incomeTaxAnnual + otherAnnual;
  const netAnnual = Math.max(0, grossAnnual - totalDeductionsAnnual);

  return {
    basicAnnual,
    hraAnnual,
    specialAnnual,
    employerPfAnnual,
    gratuityAnnual,
    grossAnnual,
    employeePfAnnual,
    professionalTaxAnnual,
    taxableIncome,
    incomeTaxAnnual,
    totalDeductionsAnnual,
    netAnnual,
    netMonthly: netAnnual / 12,
    effectiveTaxRate: grossAnnual ? (incomeTaxAnnual / grossAnnual) * 100 : 0,
  };
}

export function inr(n: number) {
  return "₹" + Math.round(n).toLocaleString("en-IN");
}
