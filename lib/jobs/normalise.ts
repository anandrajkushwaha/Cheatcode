import { readPlace, type City } from "@/lib/geo/cities";

/**
 * One shape for every board.
 *
 * Greenhouse, Lever and Ashby each describe a job differently, and every
 * difference between them is an accident of their API rather than something a
 * job seeker cares about. Providers reduce to this; nothing downstream — not
 * search, not matching, not the agent — knows which board a job came from.
 */
export type NormalisedJob = {
  provider: "greenhouse" | "lever" | "ashby";
  external_id: string;
  title: string;
  company: string;
  department: string | null;
  location_raw: string | null;
  cities: City[];
  is_remote: boolean;
  employment_type: string | null;
  seniority: string | null;
  years_min: number | null;
  years_max: number | null;
  salary_min: number | null;
  salary_max: number | null;
  salary_currency: string | null;
  salary_period: string | null;
  skills: string[];
  description: string | null;
  apply_url: string;
  posted_at: string | null;
};

/* ------------------------------------------------------------------ text */

/** Boards return HTML with entities. This has to survive both. */
export function toPlainText(input: string | null | undefined, max = 6000): string | null {
  if (!input) return null;
  const text = input
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<li[^>]*>/gi, "\n• ")
    .replace(/<\/(p|div|li|h[1-6]|tr)>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#(\d+);/g, (_, d: string) => String.fromCharCode(Number(d)))
    .replace(/[ \t]+/g, " ")
    // Strip the spaces either side of a newline before collapsing blank
    // lines, or every line comes back with whitespace hanging off it.
    .replace(/[ \t]*\n[ \t]*/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return text ? text.slice(0, max) : null;
}

/* ---------------------------------------------------------- employment */

export function readEmploymentType(...raw: (string | null | undefined)[]): string | null {
  const t = raw.filter(Boolean).join(" ").toLowerCase();
  if (!t) return null;
  if (/\bintern(ship)?\b/.test(t)) return "internship";
  if (/\bcontract|contractor|temporary|fixed[- ]term\b/.test(t)) return "contract";
  if (/\bpart[- ]time\b/.test(t)) return "part_time";
  if (/\bfull[- ]time|permanent|regular\b/.test(t)) return "full_time";
  return null;
}

/* ---------------------------------------------------------- experience */

/**
 * Seniority from the title, then years from the description.
 *
 * Titles are the only reliable signal on Indian boards — descriptions bury
 * "3-5 years" in a bullet list, and plenty of postings never state it. Order
 * matters below: "senior" must be tested before "engineer", and the intern
 * check must come before everything because "Senior Intern" is not a thing
 * but "Software Engineer Intern" is.
 */
export function readSeniority(title: string): string | null {
  const t = title.toLowerCase();
  if (/\bintern\b|\btrainee\b|\bapprentice\b/.test(t)) return "intern";
  if (/\bvp\b|\bhead of\b|\bdirector\b|\bprincipal\b|\bchief\b/.test(t)) return "lead";
  if (/\blead\b|\bstaff\b|\bmanager\b|\barchitect\b/.test(t)) return "lead";
  if (/\bsenior\b|\bsr\.?\b|\bsde\s*(3|iii)\b|\bii+i\b/.test(t)) return "senior";
  if (/\bjunior\b|\bjr\.?\b|\bassociate\b|\bfresher\b|\bentry\b|\bsde\s*(1|i)\b|\bgraduate\b/.test(t))
    return "junior";
  return null;
}

const YEAR_RANGE = /(\d{1,2})\s*(?:\+|plus)?\s*(?:-|–|—|to)\s*(\d{1,2})\s*\+?\s*(?:years?|yrs?)/i;
const YEAR_MIN = /(\d{1,2})\s*\+\s*(?:years?|yrs?)/i;
const YEAR_AT_LEAST = /(?:at least|minimum(?: of)?|min\.?)\s*(\d{1,2})\s*(?:years?|yrs?)/i;
const YEAR_PLAIN = /(\d{1,2})\s*(?:years?|yrs?)\s*(?:of\s*)?(?:relevant\s*|professional\s*|work\s*)?experience/i;

/**
 * Years asked for. Both bounds may be null, and that is a real answer — a
 * posting that never says is different from one that says zero, and treating
 * "unstated" as "0 years" would put every senior role in front of a fresher.
 */
export function readYears(
  text: string | null,
  seniority: string | null,
): { min: number | null; max: number | null } {
  const t = (text ?? "").slice(0, 4000);

  const range = t.match(YEAR_RANGE);
  if (range) {
    const a = Number(range[1]);
    const b = Number(range[2]);
    if (sane(a) && sane(b) && b >= a) return { min: a, max: b };
  }

  for (const re of [YEAR_AT_LEAST, YEAR_MIN, YEAR_PLAIN]) {
    const m = t.match(re);
    if (m) {
      const a = Number(m[1]);
      if (sane(a)) return { min: a, max: null };
    }
  }

  // Nothing stated. An internship is the one case where the title alone is
  // enough to say "no experience required" without guessing.
  if (seniority === "intern") return { min: 0, max: 1 };
  return { min: null, max: null };
}

const sane = (n: number) => Number.isFinite(n) && n >= 0 && n <= 30;

/* -------------------------------------------------------------- salary */

export type Money = {
  min: number | null;
  max: number | null;
  currency: string | null;
  period: string | null;
};

const EMPTY_MONEY: Money = { min: null, max: null, currency: null, period: null };

/**
 * Indian postings almost never publish a range, and the ones that do write it
 * as "18-25 LPA". Worth parsing precisely because a wrong salary is worse
 * than no salary: it is the number people filter on hardest.
 */
export function readSalaryFromText(text: string | null): Money {
  if (!text) return EMPTY_MONEY;
  const t = text.slice(0, 4000);

  const lpa = t.match(/(?:₹|rs\.?|inr)?\s*(\d{1,3}(?:\.\d{1,2})?)\s*(?:-|–|to)\s*(\d{1,3}(?:\.\d{1,2})?)\s*(?:lpa|lakhs?\s*(?:per\s*annum|p\.?a\.?)?|l\s*p\s*a)/i);
  if (lpa) {
    const a = Number(lpa[1]) * 100_000;
    const b = Number(lpa[2]) * 100_000;
    if (a > 0 && b >= a && b <= 200_000_000) {
      return { min: a, max: b, currency: "INR", period: "year" };
    }
  }
  return EMPTY_MONEY;
}

/* -------------------------------------------------------------- skills */

/**
 * Matched from a fixed vocabulary rather than extracted freely.
 *
 * A model could pull richer skills out of a description, but it would cost a
 * call per job on every ingest run, and matching only ever compares a job's
 * skills against a resume's — so both sides have to agree on spelling anyway.
 * A closed list guarantees that. The resume parser produces free text; this
 * is the side that has to be predictable.
 */
const VOCAB = [
  "JavaScript","TypeScript","Python","Java","Go","Golang","Rust","Ruby","PHP","C++","C#",".NET",
  "Kotlin","Swift","Scala","Elixir","Perl","R","MATLAB","Dart",
  "React","React Native","Next.js","Angular","Vue","Svelte","Node.js","Express","NestJS",
  "Django","Flask","FastAPI","Spring","Spring Boot","Rails","Laravel","GraphQL","REST",
  "HTML","CSS","Tailwind","SASS","Redux","jQuery","Flutter","Android","iOS","SwiftUI",
  "PostgreSQL","MySQL","MongoDB","Redis","Elasticsearch","Cassandra","DynamoDB","SQLite",
  "Snowflake","BigQuery","Redshift","Kafka","RabbitMQ","Airflow","Spark","Hadoop","dbt","ETL",
  "AWS","Azure","GCP","Docker","Kubernetes","Terraform","Ansible","Jenkins","CI/CD","Linux",
  "Git","GitHub Actions","Prometheus","Grafana","Datadog","Nginx","Serverless","Microservices",
  "Machine Learning","Deep Learning","NLP","Computer Vision","TensorFlow","PyTorch",
  "scikit-learn","Pandas","NumPy","LLM","LangChain","Generative AI","MLOps",
  "SQL","Excel","Tableau","Power BI","Looker","Google Analytics","Mixpanel","Amplitude",
  "Figma","Sketch","Adobe XD","Photoshop","Illustrator","After Effects","Framer","Webflow",
  "User Research","Usability Testing","Wireframing","Prototyping","Design Systems",
  "Accessibility","Interaction Design","Visual Design","Motion Design",
  "Product Management","Roadmap","Agile","Scrum","Jira","A/B Testing","Stakeholder Management",
  "SEO","SEM","Content Marketing","Performance Marketing","Salesforce","HubSpot","CRM",
  "Selenium","Cypress","Playwright","Jest","JUnit","Appium","Automation Testing",
  "Cybersecurity","Penetration Testing","SIEM","IAM","OAuth","Encryption",
];

/**
 * Skills that are also ordinary English words.
 *
 * A test caught "we move fast and go deep" being tagged with the Go language.
 * These are matched case-sensitively — "Go" is the language, "go" is the verb
 * — which costs almost nothing, because a job description that means the
 * technology capitalises it every time.
 */
const AMBIGUOUS = new Set([
  "Go", "R", "Rails", "Spring", "Express", "Swift", "Excel", "Sketch",
  "REST", "Angular", "Dart", "Agile", "Scrum", "Roadmap", "Looker", "Framer",
]);

// Prepared once: escaped, longest first so "React Native" beats "React".
const VOCAB_MATCHERS = VOCAB.map((skill) => ({
  skill,
  re: new RegExp(
    `(?<![a-zA-Z0-9+#.])${escapeRe(skill)}(?![a-zA-Z0-9+#])`,
    AMBIGUOUS.has(skill) ? "" : "i",
  ),
})).sort((a, b) => b.skill.length - a.skill.length);

function escapeRe(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function readSkills(...parts: (string | null | undefined)[]): string[] {
  const text = parts.filter(Boolean).join("\n").slice(0, 12_000);
  if (!text) return [];

  const found: string[] = [];
  for (const { skill, re } of VOCAB_MATCHERS) {
    if (found.length >= 25) break;
    if (re.test(text)) found.push(skill);
  }
  // "Golang" and "Go" are the same thing to a person searching.
  if (found.includes("Golang") && !found.includes("Go")) {
    found[found.indexOf("Golang")] = "Go";
  }
  return [...new Set(found)];
}

/* ------------------------------------------------------------- assemble */

/**
 * The last gate before the database.
 *
 * Returns null for anything we should not store — a job outside India, or one
 * missing the two fields without which a listing is useless: a title and
 * somewhere to apply.
 */
export function assemble(input: {
  provider: NormalisedJob["provider"];
  external_id: string;
  title: string;
  company: string;
  department?: string | null;
  locations: (string | null | undefined)[];
  workplaceType?: string | null;
  employmentRaw?: string | null;
  descriptionHtml?: string | null;
  descriptionText?: string | null;
  apply_url: string;
  posted_at?: string | null;
  money?: Money;
}): NormalisedJob | null {
  const title = input.title?.trim();
  const apply = input.apply_url?.trim();
  if (!title || !apply || !input.external_id) return null;

  const place = readPlace(...input.locations, input.workplaceType);
  if (!place.inIndia) return null;

  const description = input.descriptionText?.trim()
    ? input.descriptionText.trim().slice(0, 6000)
    : toPlainText(input.descriptionHtml);

  const seniority = readSeniority(title);
  const years = readYears(`${title}\n${description ?? ""}`, seniority);
  const money =
    input.money && input.money.min !== null ? input.money : readSalaryFromText(description);

  return {
    provider: input.provider,
    external_id: String(input.external_id),
    title: title.slice(0, 300),
    company: (input.company || "").trim().slice(0, 200) || "Unknown",
    department: input.department?.trim().slice(0, 120) || null,
    location_raw: input.locations.filter(Boolean).join(" · ").slice(0, 300) || null,
    cities: place.cities,
    is_remote: place.isRemote,
    employment_type: readEmploymentType(input.employmentRaw, input.workplaceType, title),
    seniority,
    years_min: years.min,
    years_max: years.max,
    salary_min: money.min,
    salary_max: money.max,
    salary_currency: money.currency,
    salary_period: money.period,
    skills: readSkills(title, description),
    description,
    apply_url: apply.slice(0, 800),
    posted_at: toIso(input.posted_at),
  };
}

function toIso(v: string | number | null | undefined): string | null {
  if (v === null || v === undefined || v === "") return null;
  // Lever and Ashby send epoch milliseconds; Greenhouse sends ISO.
  const d = typeof v === "number" ? new Date(v) : new Date(v);
  if (Number.isNaN(d.getTime())) return null;
  // A posting dated in the future is a bad feed, not a scoop.
  if (d.getTime() > Date.now() + 86_400_000) return null;
  return d.toISOString();
}
