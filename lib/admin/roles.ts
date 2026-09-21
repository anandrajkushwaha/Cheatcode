import type { AdminRole } from "@/lib/admin/auth";

/**
 * The admin panel, divided into things you can be given.
 *
 * One list, used by four callers — the proxy, the layout's nav, the API
 * guard, and the team screen's checkboxes. Adding a screen means adding it
 * here once; forgetting means the screen is owner-only, which is the right
 * way round to fail.
 *
 * Settings is deliberately NOT in this list. It assigns AI models and rate
 * limits, which is the one screen where a wrong click costs money rather than
 * causing a mess, so it stays with the owner and cannot be handed out.
 */

export type Section = {
  key: string;
  label: string;
  /** What it lets them do, in the words shown on the team screen. */
  detail: string;
  /** Pages, prefix-matched. */
  pages: readonly string[];
  /** API routes, prefix-matched. */
  apis: readonly string[];
};

export const SECTIONS: readonly Section[] = [
  {
    key: "articles",
    label: "Articles",
    detail: "Write, edit and publish blog posts. Cannot delete a published one.",
    pages: ["/admin/posts"],
    apis: ["/api/admin/post", "/api/admin/upload"],
  },
  {
    key: "reviews",
    label: "Reviews",
    detail: "Add and reorder the testimonials on the Pro page.",
    pages: ["/admin/reviews"],
    apis: ["/api/admin/review", "/api/admin/upload"],
  },
  {
    key: "insights",
    label: "Insights",
    detail: "Write and publish the short news cards in the app's Insights tab, with an optional image.",
    pages: ["/admin/insights"],
    apis: ["/api/admin/insight", "/api/admin/upload"],
  },
  {
    key: "bank",
    label: "Question bank",
    detail: "Draft and publish the public interview-question pages.",
    pages: ["/admin/bank"],
    apis: ["/api/admin/bank"],
  },
  {
    key: "dashboard",
    label: "Dashboard",
    detail: "Traffic, usage and what the AI is costing. Read only.",
    pages: ["/admin"],
    apis: [],
  },
  {
    key: "people",
    label: "People",
    detail: "The list of signed-up users and who reached for Pro. Read only, but it is personal data.",
    pages: ["/admin/users", "/admin/pro"],
    apis: [],
  },
  {
    key: "resumes",
    label: "Résumés",
    detail:
      "What people have built and downloaded, and the queue of Pro members waiting for a review.",
    pages: ["/admin/resume", "/admin/resume-requests"],
    apis: ["/api/admin/resume-review"],
  },
] as const;

export const SECTION_KEYS = SECTIONS.map((s) => s.key);

export function isSection(key: string): boolean {
  return SECTION_KEYS.includes(key);
}

/** Where somebody lands: the first screen they are actually allowed to open. */
export function homeFor(sections: readonly string[]): string {
  const first = SECTIONS.find((s) => sections.includes(s.key));
  return first?.pages[0] ?? "/admin/no-access";
}

function underAny(pathname: string, bases: readonly string[]): boolean {
  return bases.some((base) => pathname === base || pathname.startsWith(`${base}/`));
}

export function canOpenPage(
  role: AdminRole,
  sections: readonly string[],
  pathname: string,
): boolean {
  if (role === "owner") return true;
  // "/admin" is the dashboard and also the prefix of everything else, so it
  // is matched exactly rather than by prefix — otherwise granting the
  // dashboard would quietly grant the whole panel.
  if (pathname === "/admin") return sections.includes("dashboard");
  return SECTIONS.some((s) => sections.includes(s.key) && underAny(pathname, s.pages));
}

export function canCallApi(
  role: AdminRole,
  sections: readonly string[],
  pathname: string,
): boolean {
  if (role === "owner") return true;
  return SECTIONS.some((s) => sections.includes(s.key) && underAny(pathname, s.apis));
}

/** Whether a session may use a named section. The owner always may. */
export function hasSection(
  role: AdminRole,
  sections: readonly string[],
  key: string,
): boolean {
  return role === "owner" || sections.includes(key);
}
