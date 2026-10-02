import "server-only";
import { createAppAdminClient } from "@/lib/supabase/app";
import { seedDesign } from "@/lib/app/design-seed";
import { cleanResume } from "@/lib/app/resume-schema";
import { A4, type Design, type Element } from "@/lib/app/design";

/**
 * How many canvas designs a person actually touched.
 *
 * The builder writes a `design` the first time a draft is opened, so "has a
 * design" and "was edited on the canvas" are not the same question — and the
 * second one is the only one that matters before the flow engine replaces the
 * canvas. A design that is byte-for-byte what `seedDesign` would produce again
 * today was never edited: it can be dropped and re-derived with nothing lost.
 * One that differs holds work that exists nowhere else, because the canvas
 * never writes back to `content`.
 *
 * The comparison ignores element ids (they are random per seed) and rounds
 * geometry to a tenth of a millimetre, which is finer than anything a drag can
 * land on and coarser than float noise.
 */
export type DesignAudit = {
  withDesign: number;
  untouched: number;
  /** Only the words changed — no element added, removed, moved or resized. */
  textOnly: number;
  /** Geometry, element count or styling differs: real canvas work. */
  edited: number;
  /** Among edited: how many hold content the structured copy has lost. */
  textAhead: number;
  /** Designs with something hanging past the bottom of its sheet — clipped today. */
  clipped: number;
  withPhoto: number;
  byTemplate: { template: string; total: number; edited: number }[];
};

const r1 = (n: number) => Math.round(n * 10) / 10;

/** Everything about an element except its identity. */
function fingerprint(el: Element): string {
  const geo = [el.type, r1(el.x), r1(el.y), r1(el.w), r1(el.h), r1(el.rot)].join("|");
  const rest = { ...el } as Record<string, unknown>;
  delete rest.id;
  delete rest.group;
  for (const k of ["x", "y", "w", "h", "rot"]) delete rest[k];
  return geo + "|" + JSON.stringify(rest);
}

const shape = (d: Design) => d.pages.map((p) => p.elements.map(fingerprint).join("\n")).join("\n--\n");

/** Geometry only, so "same boxes, different words" is distinguishable. */
const skeleton = (d: Design) =>
  d.pages
    .map((p) =>
      p.elements
        .map((e) => [e.type, r1(e.x), r1(e.y), r1(e.w), r1(e.h)].join("|"))
        .join("\n"),
    )
    .join("\n--\n");

const words = (d: Design) =>
  d.pages
    .flatMap((p) => p.elements)
    .filter((e): e is Extract<Element, { type: "text" }> => e.type === "text")
    .map((e) => e.text.trim())
    .filter(Boolean);

type Row = { id: string; template: string | null; content: unknown; design: unknown };

export async function auditDesigns(): Promise<DesignAudit | { missing: true }> {
  const db = createAppAdminClient();
  if (!db) return { missing: true };

  const out: DesignAudit = {
    withDesign: 0,
    untouched: 0,
    textOnly: 0,
    edited: 0,
    textAhead: 0,
    clipped: 0,
    withPhoto: 0,
    byTemplate: [],
  };
  const per = new Map<string, { total: number; edited: number }>();

  /**
   * In chunks, because a design carries its photo inside it as a base64 data
   * URL of up to 3MB. Fifty of those arriving in one response is a hundred
   * megabytes held at once in a serverless function for the sake of counting
   * them. A chunk is read, folded into the totals and dropped.
   */
  const CHUNK = 10;
  for (let from = 0; ; from += CHUNK) {
    const { data, error } = await db
      .from("resume_drafts")
      .select("id,template,content,design")
      .not("design", "is", null)
      .order("id")
      .range(from, from + CHUNK - 1);

    if (error) return { missing: true };
    const rows = (data ?? []) as Row[];
    if (rows.length === 0) break;

    for (const row of rows) {
      const design = row.design as Design | null;
      if (!design?.pages?.length) continue;
      // A stub the editor wrote and nobody ever saw.
      if (JSON.stringify(design).length < 200) continue;
      out.withDesign += 1;

      const template = row.template ?? "—";
      const p = per.get(template) ?? { total: 0, edited: 0 };
      p.total += 1;

      const content = cleanResume(row.content);
      const fresh = seedDesign(content, row.template);

      if (shape(design) === shape(fresh)) {
        out.untouched += 1;
      } else if (skeleton(design) === skeleton(fresh)) {
        out.textOnly += 1;
        p.edited += 1;
      } else {
        out.edited += 1;
        p.edited += 1;
      }

      // Words on the canvas that the structured copy does not have anywhere.
      if (shape(design) !== shape(fresh)) {
        const have = JSON.stringify(content).toLowerCase();
        const orphan = words(design).some(
          (w) => w.length > 25 && !have.includes(w.slice(0, 25).toLowerCase()),
        );
        if (orphan) out.textAhead += 1;
      }

      for (const page of design.pages) {
        if (page.elements.some((e) => e.y + e.h > A4.h + 1)) {
          out.clipped += 1;
          break;
        }
      }
      if (design.pages.some((pg) => pg.elements.some((e) => e.type === "image"))) {
        out.withPhoto += 1;
      }

      per.set(template, p);
    }

    if (rows.length < CHUNK) break;
  }

  out.byTemplate = [...per.entries()]
    .map(([template, v]) => ({ template, ...v }))
    .sort((a, b) => b.edited - a.edited || b.total - a.total)
    .slice(0, 12);

  return out;
}
