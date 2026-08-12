export const SITE = {
  name: "Cheatcode",
  url: process.env.NEXT_PUBLIC_SITE_URL ?? "https://cheatcodeapp.com",
  tagline: "Talk to someone who's already done it.",
  description:
    "Cheatcode connects students and early-career professionals with mentors who are 5–10 years ahead. Straight answers on resumes, interviews, salary and first jobs.",
  locale: "en_IN",
} as const;
