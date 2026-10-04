import type { ReactNode } from "react";
import type { Resume } from "@/lib/app/resume-schema";

/**
 * A résumé, cut into the smallest pieces that must never be split.
 *
 * This is the list the paginator deals into pages, and the list the form
 * writes into — one shape in the middle, so the editor and the document can
 * never disagree about what the résumé contains. Each block carries the path
 * of the field that produced it, which is what lets clicking a line in the
 * preview put the cursor in the right box, and what makes a per-field style
 * override possible without a position anywhere in the model.
 */
export type Block = {
  id: string;
  /** Dotted path into the Resume, e.g. `roles.0.highlights.2`. */
  path: string | null;
  column: "main" | "aside";
  /** Millimetres of air above, when this is not the first block on a page. */
  gapBefore: number;
  /** Do not leave this at the foot of a page without what follows it. */
  keepWithNext: boolean;
  node: ReactNode;
};

const SECTION_GAP = "var(--r-section-gap)";

/* ------------------------------------------------------------------ parts */

function Heading({ children }: { children: ReactNode }) {
  return (
    <h2
      style={{
        fontSize: "var(--r-h2)",
        fontWeight: 700,
        letterSpacing: "0.06em",
        textTransform: "uppercase",
        color: "var(--r-accent)",
        borderBottom: "var(--r-rule)",
        paddingBottom: "1mm",
        margin: 0,
      }}
    >
      {children}
    </h2>
  );
}

function Bullet({ children }: { children: ReactNode }) {
  return (
    <div style={{ display: "flex", gap: "2mm", margin: 0 }}>
      <span aria-hidden="true" style={{ color: "var(--r-accent)" }}>
        •
      </span>
      <span style={{ flex: 1 }}>{children}</span>
    </div>
  );
}

const dates = (a: string | null, b: string | null, now: boolean) =>
  [a, now ? "Present" : b].filter(Boolean).join(" – ");

/* ----------------------------------------------------------------- build */

/**
 * The order sections appear in. Held here rather than per layout, because a
 * person reordering their own résumé expects it to stay reordered when they
 * change the design.
 */
export const DEFAULT_ORDER = [
  "summary",
  "experience",
  "education",
  "projects",
  "skills",
  "certifications",
  "achievements",
] as const;

export type SectionId = (typeof DEFAULT_ORDER)[number];

export function buildBlocks(r: Resume, order: readonly SectionId[] = DEFAULT_ORDER): Block[] {
  const out: Block[] = [];
  const push = (b: Omit<Block, "column"> & { column?: Block["column"] }) =>
    out.push({ column: "main", ...b });

  /* The header is never a section: it cannot be reordered or removed. */
  push({
    id: "header",
    path: "full_name",
    gapBefore: 0,
    keepWithNext: true,
    node: (
      <div>
        <div style={{ fontSize: "var(--r-name)", fontWeight: 700, lineHeight: 1.1 }}>
          {r.full_name || "Your name"}
        </div>
        {r.headline && (
          <div style={{ color: "var(--r-accent)", marginTop: "1mm" }}>{r.headline}</div>
        )}
      </div>
    ),
  });

  const contact = [r.email, r.phone, r.location, ...r.links.map((l) => l.url)].filter(Boolean);
  if (contact.length) {
    push({
      id: "contact",
      path: "email",
      gapBefore: 1.5,
      keepWithNext: false,
      node: (
        <div style={{ fontSize: "var(--r-small)", display: "flex", flexWrap: "wrap", gap: "0 3mm" }}>
          {r.email && <a href={`mailto:${r.email}`} style={{ color: "inherit" }}>{r.email}</a>}
          {r.phone && <a href={`tel:${r.phone}`} style={{ color: "inherit" }}>{r.phone}</a>}
          {r.location && <span>{r.location}</span>}
          {r.links.map((l, i) => (
            <a key={i} href={l.url ?? undefined} style={{ color: "inherit" }}>
              {l.label || l.url}
            </a>
          ))}
        </div>
      ),
    });
  }

  const section = (id: string, title: string, path: string | null) =>
    push({
      id: `${id}:h`,
      path,
      gapBefore: Number.parseFloat(SECTION_GAP) || 6,
      keepWithNext: true,
      node: <Heading>{title}</Heading>,
    });

  for (const key of order) {
    if (key === "summary" && r.summary) {
      section("summary", "Summary", "summary");
      push({ id: "summary:0", path: "summary", gapBefore: 2, keepWithNext: false, node: <p style={{ margin: 0 }}>{r.summary}</p> });
    }

    if (key === "experience" && r.roles.length) {
      section("exp", "Experience", "roles");
      r.roles.forEach((role, i) => {
        push({
          id: `exp:${i}`,
          path: `roles.${i}.title`,
          gapBefore: i === 0 ? 2 : 3,
          keepWithNext: true,
          node: (
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", gap: "4mm" }}>
                <strong>{role.title || "Role"}</strong>
                <span style={{ fontSize: "var(--r-small)", whiteSpace: "nowrap" }}>
                  {dates(role.start, role.end, role.is_current)}
                </span>
              </div>
              {role.company && <div style={{ color: "var(--r-accent)" }}>{role.company}</div>}
            </div>
          ),
        });
        role.highlights.forEach((h, j) => {
          push({
            id: `exp:${i}:${j}`,
            path: `roles.${i}.highlights.${j}`,
            gapBefore: 1,
            // Keep the first bullet with its job title; the rest may flow.
            keepWithNext: false,
            node: <Bullet>{h}</Bullet>,
          });
        });
      });
    }

    if (key === "education" && r.education.length) {
      section("edu", "Education", "education");
      r.education.forEach((e, i) => {
        push({
          id: `edu:${i}`,
          path: `education.${i}.degree`,
          gapBefore: i === 0 ? 2 : 2,
          keepWithNext: false,
          node: (
            <div style={{ display: "flex", justifyContent: "space-between", gap: "4mm" }}>
              <span>
                <strong>{e.degree || "Qualification"}</strong>
                {e.institution && <span> · {e.institution}</span>}
              </span>
              {e.year && (
                <span style={{ fontSize: "var(--r-small)", whiteSpace: "nowrap" }}>{e.year}</span>
              )}
            </div>
          ),
        });
      });
    }

    if (key === "projects" && r.projects.length) {
      section("proj", "Projects", "projects");
      r.projects.forEach((pr, i) => {
        push({
          id: `proj:${i}`,
          path: `projects.${i}.name`,
          gapBefore: i === 0 ? 2 : 3,
          keepWithNext: true,
          node: (
            <div>
              <strong>{pr.name || "Project"}</strong>
              {pr.description && <div>{pr.description}</div>}
            </div>
          ),
        });
        pr.highlights.forEach((h, j) => {
          push({
            id: `proj:${i}:${j}`,
            path: `projects.${i}.highlights.${j}`,
            gapBefore: 1,
            keepWithNext: false,
            node: <Bullet>{h}</Bullet>,
          });
        });
      });
    }

    if (key === "skills" && r.skills.length) {
      section("skills", "Skills", "skills");
      push({
        id: "skills:0",
        path: "skills",
        gapBefore: 2,
        keepWithNext: false,
        node: <div>{r.skills.join(" · ")}</div>,
      });
    }

    if (key === "certifications" && r.certifications.length) {
      section("cert", "Certifications", "certifications");
      r.certifications.forEach((c, i) => {
        push({ id: `cert:${i}`, path: `certifications.${i}`, gapBefore: i === 0 ? 2 : 1, keepWithNext: false, node: <Bullet>{c}</Bullet> });
      });
    }

    if (key === "achievements" && r.achievements.length) {
      section("ach", "Achievements", "achievements");
      r.achievements.forEach((a, i) => {
        push({ id: `ach:${i}`, path: `achievements.${i}`, gapBefore: i === 0 ? 2 : 1, keepWithNext: false, node: <Bullet>{a}</Bullet> });
      });
    }
  }

  return out;
}
