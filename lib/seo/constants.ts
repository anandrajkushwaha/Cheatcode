export const SITE = {
  name: "Cheatcode",
  url: process.env.NEXT_PUBLIC_SITE_URL ?? "https://cheatcodeapp.com",
  tagline: "The unfair advantage for your first few years.",
  description:
    "Cheatcode is the career toolkit for students and early-career professionals in India — a free resume builder with an ATS check, job search across company boards, AI mock interviews and a career agent that has read your resume.",
  locale: "en_IN",
} as const;
