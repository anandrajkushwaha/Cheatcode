/**
 * Ready-made lines, by role family.
 *
 * Curated rather than generated. A model would write better prose, but it
 * would cost money on every keystroke of every free user, it would take a
 * second to arrive at the exact moment somebody is deciding whether to give
 * up, and — the part that matters — it invents numbers. Every line here is
 * deliberately a shape with a blank in it, so the person supplies the fact
 * and the sentence supplies the grammar.
 */
const FAMILIES: { match: RegExp; bullets: string[]; skills: string[] }[] = [
  {
    match: /engineer|developer|programmer|sde|full ?stack|backend|frontend|devops/i,
    bullets: [
      "Built and shipped <feature> used by <number> people a month.",
      "Cut <page or job> load time from <before> to <after> by <what you changed>.",
      "Took <system> from <number> errors a week to <number> by <what you fixed>.",
      "Wrote the tests that took deploy failures from <number> a month to <number>.",
    ],
    skills: ["JavaScript", "TypeScript", "React", "Node.js", "Python", "SQL", "Git", "REST APIs", "AWS", "Docker"],
  },
  {
    match: /design|ux|ui|graphic|visual|motion/i,
    bullets: [
      "Redesigned <flow> and lifted completion from <before>% to <after>%.",
      "Built a component library of <number> components now used across <number> screens.",
      "Ran <number> usability sessions and shipped the <number> fixes that came out of them.",
      "Cut the handoff-to-build time for <surface> from <before> to <after>.",
    ],
    skills: ["Figma", "Prototyping", "User research", "Design systems", "Wireframing", "Usability testing", "Adobe XD", "Interaction design"],
  },
  {
    match: /data|analy|scien|machine learning|ml |bi /i,
    bullets: [
      "Built the <name> dashboard that <team> now uses to decide <what>.",
      "Found <insight> in <dataset>, which changed <decision> and saved <amount>.",
      "Automated a <duration> manual report down to <duration>.",
      "Modelled <thing> to <accuracy>, replacing a rule that was right <before>% of the time.",
    ],
    skills: ["SQL", "Python", "Excel", "Power BI", "Tableau", "Pandas", "Statistics", "A/B testing"],
  },
  {
    match: /product manager|product owner|product/i,
    bullets: [
      "Shipped <feature> to <number> users and moved <metric> by <amount>.",
      "Cut <process> from <before> to <after> by <what you changed>.",
      "Ran discovery with <number> customers and killed <number> ideas before they were built.",
      "Wrote the spec for <thing> that <number> engineers built in <duration>.",
    ],
    skills: ["Roadmapping", "User research", "SQL", "A/B testing", "Stakeholder management", "Agile", "Analytics"],
  },
  {
    match: /market|seo|growth|brand|social/i,
    bullets: [
      "Grew <channel> from <before> to <after> in <duration>.",
      "Cut cost per acquisition from <before> to <after> by <what you changed>.",
      "Ran <number> campaigns; the best returned <amount> on <amount> spent.",
      "Took organic traffic from <before> to <after> a month.",
    ],
    skills: ["SEO", "Google Ads", "Meta Ads", "Google Analytics", "Content strategy", "Email marketing", "Copywriting"],
  },
  {
    match: /sales|business development|account executive|relationship manager/i,
    bullets: [
      "Closed <amount> against a target of <amount> in <period>.",
      "Grew the <region or segment> book from <number> to <number> accounts.",
      "Cut the sales cycle from <duration> to <duration> by <what you changed>.",
      "Brought <number> new logos in <period>, <number> of them inbound.",
    ],
    skills: ["CRM", "Salesforce", "Lead generation", "Negotiation", "Account management", "Cold outreach"],
  },
  {
    match: /account|finance|audit|tax/i,
    bullets: [
      "Closed monthly books in <duration>, down from <duration>.",
      "Found <amount> of leakage in <process> and stopped it.",
      "Handled <number> invoices a month with <number> disputes.",
      "Led the <name> audit with <number> observations.",
    ],
    skills: ["Tally", "Excel", "GST", "TDS", "Reconciliation", "SAP", "Financial reporting"],
  },
  {
    match: /human resource|recruit|talent|hr /i,
    bullets: [
      "Hired <number> people in <period> across <number> roles.",
      "Cut time-to-hire from <duration> to <duration>.",
      "Took offer acceptance from <before>% to <after>%.",
      "Built the onboarding that took new-joiner ramp from <duration> to <duration>.",
    ],
    skills: ["Sourcing", "Interviewing", "ATS", "Onboarding", "HRMS", "Employee engagement"],
  },
];

const GENERIC = [
  "Did <what> that changed <metric> from <before> to <after>.",
  "Owned <area> for a team of <number>.",
  "Cut <time or cost> by <amount> by <what you changed>.",
  "Led <number> people through <project> and delivered in <duration>.",
];

const GENERIC_SKILLS = ["Communication", "Excel", "Problem solving", "Teamwork", "Time management"];

const familyFor = (role: string | null | undefined) => {
  if (!role) return null;
  return FAMILIES.find((f) => f.match.test(role)) ?? null;
};

export function bulletsFor(role: string | null | undefined): string[] {
  return (familyFor(role) ?? { bullets: GENERIC }).bullets;
}

export function skillsFor(role: string | null | undefined): string[] {
  return (familyFor(role) ?? { skills: GENERIC_SKILLS }).skills;
}
