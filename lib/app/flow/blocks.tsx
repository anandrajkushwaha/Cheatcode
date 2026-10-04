import type { CSSProperties, ReactNode } from "react";
import type { Resume } from "@/lib/app/resume-schema";
import { sectionOrder, type SectionKey } from "@/lib/app/resume-templates";
import type { FlowTheme } from "@/lib/app/flow/theme";

/**
 * A résumé, cut into the smallest pieces that must never be split.
 *
 * This is the list the paginator deals into pages, and the list the form
 * writes into — one shape in the middle, so the editor and the document can
 * never disagree about what the résumé contains. Each block carries the path
 * of the field that produced it, which is what lets clicking a line in the
 * preview put the cursor in the right box, and what makes a per-field style
 * override possible without a position anywhere in the model.
 *
 * Which column a block lands in is decided here rather than by the renderer,
 * from the template's own `sectionOrder` — the same function the ATS scorer
 * walks. That shared reading is the point: if the document put skills in a
 * sidebar and the scorer read them as if they were in the main column, the
 * number would be describing a file nobody has.
 */
export type Block = {
  id: string;
  /** Dotted path into the Resume, e.g. `roles.0.highlights.2`. */
  path: string | null;
  /** `head` is the full-width strip above both columns, on the first page. */
  column: "head" | "aside" | "main";
  /** Millimetres of air above, when this is not the first block on a page. */
  gapBefore: number;
  /** Do not leave this at the foot of a page without what follows it. */
  keepWithNext: boolean;
  /** Millimetres of indent, taken off the width this block is measured at. */
  inset?: number;
  node: ReactNode;
};

/* ------------------------------------------------------------------ parts */

const mm = (n: number) => `${n}mm`;

function Heading({ children, t, aside }: { children: ReactNode; t: FlowTheme; aside?: boolean }) {
  const s = t.shape;
  const base: CSSProperties = {
    fontSize: "var(--r-h2)",
    fontWeight: t.h2Weight,
    letterSpacing: t.h2Tracking,
    textTransform: "uppercase",
    color: "var(--r-h2-color)",
    margin: 0,
    lineHeight: 1.2,
  };

  // A tinted panel, rather than a rule. The one layout in the set where a
  // heading is an object on the page instead of a line of type.
  if (s.boxed && !aside) {
    return (
      <h2
        style={{
          ...base,
          background: "var(--r-wash)",
          padding: "1.6mm 3mm",
          borderRadius: "1.2mm",
        }}
      >
        {children}
      </h2>
    );
  }

  // In the gutter, with the measure to its right left empty — the body blocks
  // under it are inset by the same amount, so the section reads as one
  // two-column band rather than as a heading with a long indent after it.
  if (s.labelGutter && !aside) {
    return (
      <h2 style={{ ...base, display: "grid", gridTemplateColumns: `${mm(GUTTER - 4)} 1fr`, gap: mm(4), alignItems: "center" }}>
        <span>{children}</span>
        <span aria-hidden="true" style={{ height: 0, borderTop: "var(--r-rule)", opacity: 0.6 }} />
      </h2>
    );
  }

  return (
    <h2 style={{ ...base, borderBottom: "var(--r-rule)", paddingBottom: "1.2mm" }}>{children}</h2>
  );
}

function Bullet({ children }: { children: ReactNode }) {
  return (
    <div style={{ display: "flex", gap: "2mm", margin: 0 }}>
      <span aria-hidden="true" style={{ color: "var(--r-accent)", lineHeight: "var(--r-lead)" }}>
        •
      </span>
      <span style={{ flex: 1 }}>{children}</span>
    </div>
  );
}

/** The dot on the rail, for the layouts that hang their entries off one. */
function Dot() {
  return (
    <span
      aria-hidden="true"
      style={{
        position: "absolute",
        left: "-6.6mm",
        top: "1.4mm",
        width: "2.2mm",
        height: "2.2mm",
        borderRadius: "50%",
        background: "var(--r-accent)",
      }}
    />
  );
}

function Photo({ src, size, square }: { src: string; size: number; square?: boolean }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      style={{
        width: mm(size),
        height: mm(size),
        objectFit: "cover",
        borderRadius: square ? "1.5mm" : "50%",
        flex: "0 0 auto",
        display: "block",
      }}
    />
  );
}

const dates = (a: string | null, b: string | null, now: boolean) =>
  [a, now ? "Present" : b].filter(Boolean).join(" – ");

const contactBits = (r: Resume): string[] =>
  [r.email, r.phone, r.location, ...r.links.map((l) => l.label || l.url)].filter(
    (x): x is string => Boolean(x && x.trim()),
  );

/** How far the body is pushed right when the headings live in a gutter. */
const GUTTER = 36;
/** How far a railed entry is pushed right of its line. */
const RAIL = 8;

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

export type SectionId = SectionKey;

const TITLES: Record<SectionKey, string> = {
  summary: "Summary",
  experience: "Experience",
  education: "Education",
  projects: "Projects",
  skills: "Skills",
  certifications: "Certifications",
  achievements: "Achievements",
};

export function buildBlocks(
  r: Resume,
  t: FlowTheme,
  opts: { order?: readonly SectionId[]; photo?: string | null } = {},
): Block[] {
  const s = t.shape;
  const out: Block[] = [];
  const photo = t.photo ? (opts.photo ?? null) : null;
  const sectionGap = t.sectionGap * t.density;
  const roleGap = t.roleGap * t.density;

  const push = (b: Block) => out.push(b);

  /* ---------------------------------------------------------- the header */

  /**
   * Which column the name goes in, and whether the contact line goes with it.
   *
   * A full-height sidebar has no room above it for a header, so the name sits
   * inside a column; every other two-column layout puts a full-width header
   * over both. That single distinction is what makes a sidebar look like a
   * sidebar and a split look like a split, and it is the thing the old
   * renderer got wrong by having only one answer.
   */
  const headColumn: Block["column"] =
    s.header === "aside" ? "aside" : s.asideFullHeight ? "main" : "head";
  const onBand = s.header === "band";
  const contactInAside = s.asideFullHeight && s.header !== "aside";

  const name = (
    <div
      style={{
        fontSize: "var(--r-name)",
        fontWeight: t.nameWeight,
        letterSpacing: t.nameTracking,
        textTransform: t.nameCase === "uppercase" ? "uppercase" : "none",
        lineHeight: 1.1,
        color: onBand ? "var(--r-on-accent)" : s.header === "aside" ? "var(--r-text)" : "var(--r-accent)",
      }}
    >
      {r.full_name || "Your name"}
    </div>
  );

  const headline = r.headline ? (
    <div
      style={{
        marginTop: "1.4mm",
        fontSize: `${(t.base + 1) * t.scale}pt`,
        color: onBand ? "var(--r-on-accent)" : "var(--r-muted)",
        opacity: onBand ? 0.88 : 1,
      }}
    >
      {r.headline}
    </div>
  ) : null;

  const inlineContact = (
    <div
      style={{
        marginTop: "2mm",
        fontSize: "var(--r-small)",
        display: "flex",
        flexWrap: "wrap",
        gap: "0 3mm",
        color: onBand ? "var(--r-on-accent)" : "var(--r-muted)",
        opacity: onBand ? 0.82 : 1,
      }}
    >
      {contactBits(r).map((c, i) => (
        <span key={i}>{c}</span>
      ))}
    </div>
  );

  const headText = (
    <div style={{ minWidth: 0, flex: 1, textAlign: s.aside === "none" && t.align === "center" ? "center" : "left" }}>
      {name}
      {headline}
      {onBand && s.bandSummary && r.summary && (
        <div style={{ marginTop: "2.6mm", fontSize: "var(--r-small)", color: "var(--r-on-accent)", opacity: 0.9 }}>
          {r.summary}
        </div>
      )}
      {!contactInAside && contactBits(r).length > 0 && inlineContact}
    </div>
  );

  const frame = photo ? (
    <Photo src={photo} size={s.squarePhoto ? 30 : 26} square={s.squarePhoto} />
  ) : null;

  push({
    id: "header",
    path: "full_name",
    column: headColumn,
    gapBefore: 0,
    keepWithNext: true,
    node:
      headColumn === "aside" ? (
        <div>
          {frame && (
            <div style={{ display: "flex", justifyContent: "center", marginBottom: "4mm" }}>{frame}</div>
          )}
          {headText}
        </div>
      ) : (
        <div
          style={{
            display: "flex",
            gap: "6mm",
            alignItems: "center",
          }}
        >
          {s.squarePhoto && frame}
          {headText}
          {!s.squarePhoto && frame}
        </div>
      ),
  });

  // A plain full-width header is closed with a rule, the way every one of the
  // seeded designs closes it. A band needs none: the colour is the edge.
  if (headColumn === "head" && !onBand) {
    push({
      id: "header:rule",
      path: null,
      column: "head",
      gapBefore: 3,
      keepWithNext: true,
      node: <div style={{ height: 0, borderTop: `0.6pt solid var(--r-accent)` }} />,
    });
  }

  /* ---------------------------------------------------------- the columns */

  const split = s.aside === "none" ? { aside: [] as SectionKey[], main: null } : sectionOrder(t.layout);
  const asideKeys = new Set<SectionKey>(split.aside);
  const order = opts.order ?? DEFAULT_ORDER;

  if (contactInAside) {
    push({
      id: "contact",
      path: "email",
      column: "aside",
      gapBefore: photo ? 4 : 0,
      keepWithNext: true,
      node: <Heading t={t} aside>Contact</Heading>,
    });
    contactBits(r).forEach((c, i) => {
      push({
        id: `contact:${i}`,
        path: "email",
        column: "aside",
        gapBefore: i === 0 ? 2 : 1,
        keepWithNext: false,
        node: <div style={{ fontSize: "var(--r-small)", wordBreak: "break-word" }}>{c}</div>,
      });
    });
  }

  for (const key of order) {
    const column: Block["column"] = asideKeys.has(key) ? "aside" : "main";
    const aside = column === "aside";
    const inset = !aside && s.labelGutter ? GUTTER : !aside && s.rail ? RAIL : undefined;
    const body = (
      id: string,
      path: string | null,
      gapBefore: number,
      keepWithNext: boolean,
      node: ReactNode,
      dotted = false,
    ) =>
      push({
        id,
        path,
        column,
        gapBefore,
        keepWithNext,
        inset,
        node: dotted && s.rail && !aside ? (
          <>
            <Dot />
            {node}
          </>
        ) : (
          node
        ),
      });

    const heading = (id: string, path: string | null) =>
      push({
        id: `${id}:h`,
        path,
        column,
        gapBefore: out.some((b) => b.column === column && !b.id.startsWith("header")) ? sectionGap : 0,
        keepWithNext: true,
        node: <Heading t={t} aside={aside}>{TITLES[key]}</Heading>,
      });

    if (key === "summary" && r.summary && !(onBand && s.bandSummary)) {
      heading("summary", "summary");
      body("summary:0", "summary", 2, false, <p style={{ margin: 0 }}>{r.summary}</p>);
    }

    if (key === "experience" && r.roles.length) {
      heading("exp", "roles");
      r.roles.forEach((role, i) => {
        body(
          `exp:${i}`,
          `roles.${i}.title`,
          i === 0 ? 2.4 : roleGap,
          true,
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", gap: "4mm" }}>
              <strong>{role.title || "Role"}</strong>
              <span style={{ fontSize: "var(--r-small)", color: "var(--r-muted)", whiteSpace: "nowrap" }}>
                {dates(role.start, role.end, role.is_current)}
              </span>
            </div>
            {role.company && <div style={{ color: "var(--r-accent)" }}>{role.company}</div>}
          </div>,
          true,
        );
        role.highlights
          .filter((h) => h.trim())
          .forEach((h, j) => {
            body(`exp:${i}:${j}`, `roles.${i}.highlights.${j}`, 1, false, <Bullet>{h}</Bullet>);
          });
      });
    }

    if (key === "education" && r.education.length) {
      heading("edu", "education");
      r.education.forEach((e, i) => {
        body(
          `edu:${i}`,
          `education.${i}.degree`,
          i === 0 ? 2.4 : 2,
          false,
          aside ? (
            <div>
              <strong>{e.degree || "Qualification"}</strong>
              {e.institution && <div style={{ fontSize: "var(--r-small)" }}>{e.institution}</div>}
              {e.year && <div style={{ fontSize: "var(--r-small)", opacity: 0.8 }}>{e.year}</div>}
            </div>
          ) : (
            <div style={{ display: "flex", justifyContent: "space-between", gap: "4mm" }}>
              <span>
                <strong>{e.degree || "Qualification"}</strong>
                {e.institution && <span> · {e.institution}</span>}
              </span>
              {e.year && (
                <span style={{ fontSize: "var(--r-small)", color: "var(--r-muted)", whiteSpace: "nowrap" }}>
                  {e.year}
                </span>
              )}
            </div>
          ),
          true,
        );
      });
    }

    if (key === "projects" && r.projects.length) {
      heading("proj", "projects");
      r.projects.forEach((pr, i) => {
        body(
          `proj:${i}`,
          `projects.${i}.name`,
          i === 0 ? 2.4 : roleGap,
          true,
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", gap: "4mm" }}>
              <strong>{pr.name || "Project"}</strong>
              {pr.link && (
                <span style={{ fontSize: "var(--r-small)", color: "var(--r-muted)" }}>{pr.link}</span>
              )}
            </div>
            {pr.description && <div>{pr.description}</div>}
          </div>,
          true,
        );
        pr.highlights
          .filter((h) => h.trim())
          .forEach((h, j) => {
            body(`proj:${i}:${j}`, `projects.${i}.highlights.${j}`, 1, false, <Bullet>{h}</Bullet>);
          });
      });
    }

    if (key === "skills" && r.skills.length) {
      heading("skills", "skills");
      // A narrow column cannot hold a middot-separated run without breaking it
      // in the wrong places, so the sidebar stacks and the measure flows.
      if (aside) {
        r.skills.forEach((sk, i) => {
          body(`skills:${i}`, "skills", i === 0 ? 2.4 : 0.8, false, <div>{sk}</div>);
        });
      } else {
        body("skills:0", "skills", 2.4, false, <div>{r.skills.join(" · ")}</div>);
      }
    }

    if (key === "certifications" && r.certifications.length) {
      heading("cert", "certifications");
      r.certifications.forEach((c, i) => {
        body(`cert:${i}`, `certifications.${i}`, i === 0 ? 2.4 : 1, false,
          aside ? <div>{c}</div> : <Bullet>{c}</Bullet>);
      });
    }

    if (key === "achievements" && r.achievements.length) {
      heading("ach", "achievements");
      r.achievements.forEach((a, i) => {
        body(`ach:${i}`, `achievements.${i}`, i === 0 ? 2.4 : 1, false,
          aside ? <div>{a}</div> : <Bullet>{a}</Bullet>);
      });
    }
  }

  return out;
}
