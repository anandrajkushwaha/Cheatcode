/**
 * How a hub category's guides are grouped on its page.
 *
 * Four categories double as hubs (the SEO PRD, section B): resume formats by
 * who the reader is, interviews by company and round, PF/tax by topic, and
 * salary with the in-hand pages first, in order of package. Rules are slug
 * patterns, checked in order — a post goes in the first group it matches —
 * so a new post lands in the right group without anyone editing this file,
 * and anything unmatched still appears, in the last group.
 *
 * Pure: no imports, so npm test can run it.
 */

type Rule = { title: string; match: RegExp };

const HUBS: Record<string, { rules: Rule[]; rest: string }> = {
  "resume-format": {
    rules: [
      { title: "For freshers and students", match: /fresher|freshers|internship|without-experience|12th-pass/ },
      {
        title: "Engineering and tech roles",
        match:
          /developer|engineer|devops|data-(analyst|scientist|engineer)|machine-learning|cyber|software|ui-ux|frontend|backend|full-stack/,
      },
      {
        title: "Business, finance and management roles",
        match:
          /accountant|banking|business-analyst|^ca-|finance|hr-|marketing|operations|product-manager|project-manager|sales|legal|social-media|content-writer|customer-service|data-entry/,
      },
      { title: "Other professions", match: /nurse|pharmacist|teacher|hotel|graphic/ },
    ],
    rest: "Resume sections and tips",
  },
  "interview-prep": {
    rules: [
      {
        title: "Company-wise interview guides",
        match:
          /accenture|amazon|capgemini|cognizant|deloitte|hcltech|infosys|tcs|tech-mahindra|wipro|hackwithinfy|codevita/,
      },
      {
        title: "Technical and role-specific questions",
        match:
          /dbms|computer-networks|operating-system|oops|sql|java|python|javascript|react|dsa|technical|ai-interview|aptitude|bpo|sales-executive/,
      },
      {
        title: "HR and common questions",
        match:
          /tell-me|why-|where-do|weakness|strength|conflict|failed|achievement|salary-expectations|hr-interview|behavioral|star-method|questions-to-ask|leaving/,
      },
    ],
    rest: "Interview skills and preparation",
  },
  "pf-tax": {
    rules: [
      { title: "EPF, EPS and PF", match: /epf|eps-|^pf-|uan/ },
      { title: "Income tax", match: /tax|form-16|itr|hra|standard-deduction/ },
      { title: "CTC and your payslip", match: /ctc|salary-slip|basic-salary|variable-pay/ },
    ],
    rest: "Gratuity and leave",
  },
  salary: {
    rules: [{ title: "In-hand salary by package", match: /lpa-in-hand-salary$|crore-in-hand-salary$/ }],
    rest: "Negotiation, hikes and pay",
  },
};

/** 3 for "3-lpa-…", 100 for "1-crore-…"; the in-hand pages sort by package. */
export function packageLakhs(slug: string): number | null {
  const lpa = /^(\d+)-lpa-in-hand-salary$/.exec(slug);
  if (lpa) return Number(lpa[1]);
  const crore = /^(\d+)-crore-in-hand-salary$/.exec(slug);
  return crore ? Number(crore[1]) * 100 : null;
}

export function isHub(categorySlug: string): boolean {
  return categorySlug in HUBS;
}

export function groupForHub<T extends { slug: string }>(
  categorySlug: string,
  posts: T[],
): { title: string; posts: T[] }[] | null {
  const hub = HUBS[categorySlug];
  if (!hub) return null;
  const groups = hub.rules.map((r) => ({ title: r.title, posts: [] as T[] }));
  const rest: T[] = [];
  for (const p of posts) {
    const i = hub.rules.findIndex((r) => r.match.test(p.slug));
    if (i >= 0) groups[i].posts.push(p);
    else rest.push(p);
  }
  for (const g of groups) {
    if (g.posts.some((p) => packageLakhs(p.slug) !== null)) {
      g.posts.sort((a, b) => (packageLakhs(a.slug) ?? 0) - (packageLakhs(b.slug) ?? 0));
    }
  }
  return [...groups, { title: hub.rest, posts: rest }].filter((g) => g.posts.length > 0);
}
