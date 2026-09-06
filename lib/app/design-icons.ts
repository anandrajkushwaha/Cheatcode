/**
 * The icon library, as path data.
 *
 * A résumé template that puts a little graduation cap beside "Education" needs
 * exactly one thing the model did not have: a drawing that is neither a
 * photograph nor a rectangle. Everything else the new templates want turned
 * out to be composition — a timeline rail is a `line` with `ellipse`s on it, a
 * skill meter is five small circles, a monogram watermark is large text at low
 * opacity, a diagonal stripe is a rotated rect. Only this was missing.
 *
 * ------------------------------------------------------------- the shape of it
 *
 * Stroke-drawn paths on a 24×24 grid, which is the same grid the rest of the
 * product's icons use. Stroked rather than filled so one icon reads correctly
 * at 3mm beside a heading and at 30mm if somebody drags it larger — a filled
 * glyph turns into a blob at small sizes and a poster at large ones.
 *
 * Named rather than free-form. The gate has to be able to refuse an unknown
 * icon, and "any path string somebody sends us" is a drawing instruction from
 * an untrusted document — small, but there is no reason to accept it when a
 * list of names does the job.
 */

export const ICONS = {
  phone: "M6.5 3.5h3l1.5 4-2 1.5a12 12 0 0 0 6 6l1.5-2 4 1.5v3a2 2 0 0 1-2.2 2A17 17 0 0 1 4.5 5.7 2 2 0 0 1 6.5 3.5z",
  mail: "M3 6.5h18v11H3zM3 7l9 6 9-6",
  pin: "M12 21s7-6.3 7-11a7 7 0 1 0-14 0c0 4.7 7 11 7 11zM12 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z",
  globe: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM3 12h18M12 3c2.5 2.6 3.8 5.6 3.8 9S14.5 18.4 12 21c-2.5-2.6-3.8-5.6-3.8-9S9.5 5.6 12 3z",
  user: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4.5 20.5c1.4-3.6 4-5.5 7.5-5.5s6.1 1.9 7.5 5.5",
  briefcase: "M3.5 7.5h17v12h-17zM9 7.5V5.5a1.5 1.5 0 0 1 1.5-1.5h3A1.5 1.5 0 0 1 15 5.5v2M3.5 12.5h17",
  cap: "M12 4 22 9l-10 5L2 9l10-5zM6.5 11v5c0 1.7 2.5 3 5.5 3s5.5-1.3 5.5-3v-5",
  star: "M12 3.5l2.6 5.6 6 .8-4.4 4.2 1.1 6.1-5.3-3-5.3 3 1.1-6.1L3.4 9.9l6-.8z",
  award: "M12 14a5 5 0 1 0 0-10 5 5 0 0 0 0 10zM8.5 13.3 7 21l5-2.6L17 21l-1.5-7.7",
  language: "M4 6h10M9 4v2c0 4-2 7-5 8.5M6.5 10.5c1 2.4 3 4.2 5.5 5M13 20l4-9 4 9M14.6 17h4.8",
  skills: "M12 3.5 20 8v8l-8 4.5L4 16V8l8-4.5zM12 12l8-4.5M12 12v8.5M12 12 4 7.5",
  calendar: "M4 6.5h16v14H4zM8 3.5v4M16 3.5v4M4 11h16",
  link: "M10.5 13.5a4 4 0 0 0 5.7 0l2.4-2.4a4 4 0 1 0-5.7-5.7l-1.3 1.3M13.5 10.5a4 4 0 0 0-5.7 0l-2.4 2.4a4 4 0 1 0 5.7 5.7l1.3-1.3",
  quote: "M9 6.5C6 8 4.5 10.3 4.5 13.2c0 2.6 1.5 4.3 3.6 4.3 1.9 0 3.3-1.4 3.3-3.3 0-1.8-1.3-3.1-3-3.1-.3 0-.6 0-.8.1.4-1.6 1.5-3 3.1-4zM19 6.5c-3 1.5-4.5 3.8-4.5 6.7 0 2.6 1.5 4.3 3.6 4.3 1.9 0 3.3-1.4 3.3-3.3 0-1.8-1.3-3.1-3-3.1-.3 0-.6 0-.8.1.4-1.6 1.5-3 3.1-4z",
} as const;

export type IconName = keyof typeof ICONS;

export const ICON_NAMES = Object.keys(ICONS) as IconName[];

export function isIconName(v: unknown): v is IconName {
  return typeof v === "string" && v in ICONS;
}
