/**
 * Which panels are open, remembered between visits.
 *
 * This lives in a cookie rather than localStorage for one reason, and it is
 * the reason that matters on a server-rendered app: the server has to know
 * the answer before it renders. Read it from localStorage and the first paint
 * is always the default layout, which then snaps to the real one a beat later
 * — a flash on every navigation. A cookie arrives with the request, so the
 * first HTML is already correct.
 *
 * Note there is no `import "server-only"` here, and that is deliberate: the
 * server reads this cookie and the client writes it, so both halves of the
 * app need these four functions. Anything that touches `next/headers` stays
 * in the layout, where only the server can reach it.
 */

export const STUDIO_LAYOUT_COOKIE = "cc_studio_layout";

/** A year. The preference should outlive the session that set it. */
export const STUDIO_LAYOUT_MAX_AGE = 60 * 60 * 24 * 365;

export type StudioLayout = {
  /** The left sidebar: full width with labels, or the icon rail. */
  sidebar: boolean;
  /** The right Insights panel. Hidden gives the chat the full width. */
  insights: boolean;
};

/** Both open — the state the design treats as the default. */
export const DEFAULT_LAYOUT: StudioLayout = { sidebar: true, insights: true };

/**
 * Serialised as two characters rather than JSON.
 *
 * A cookie is sent on every request to this origin, including every server
 * action. "11" costs two bytes; the JSON equivalent costs about forty for the
 * same information.
 */
export function encodeLayout(layout: StudioLayout): string {
  return `${layout.sidebar ? "1" : "0"}${layout.insights ? "1" : "0"}`;
}

export function decodeLayout(raw: string | undefined): StudioLayout {
  if (!raw || raw.length !== 2) return DEFAULT_LAYOUT;
  return { sidebar: raw[0] === "1", insights: raw[1] === "1" };
}

/** Client-side persistence. The server reads the same cookie on the next load. */
export function persistLayout(layout: StudioLayout) {
  if (typeof document === "undefined") return;
  document.cookie = `${STUDIO_LAYOUT_COOKIE}=${encodeLayout(layout)}; path=/; max-age=${STUDIO_LAYOUT_MAX_AGE}; samesite=lax`;
}
