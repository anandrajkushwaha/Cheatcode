import type { FieldSpec } from "@/lib/app/resume-schema";
/**
 * Shapes both sides of the agent share.
 *
 * Its own module with no imports because the browser and the server both need
 * these, and everything else in lib/app is `server-only`. A type-only import
 * from a server module would work today and break the first time somebody
 * reaches for a value next to it.
 */

/** Jobs the model asked to put on screen. */
export type ShowJobs = { jobIds: string[]; reason?: string };

/** The subset of a job a card needs. The full row never reaches the client. */
export type JobCard = {
  id: string;
  title: string;
  company: string;
  cities: string[];
  is_remote: boolean;
  apply_url: string;
};

/**
 * Tool arguments arrive as whatever the model felt like sending, so nothing
 * here trusts a shape. Six ids maximum — a wall of cards is not an answer.
 */
export function readShowJobs(args: unknown): ShowJobs | undefined {
  if (!args || typeof args !== "object") return undefined;
  const a = args as { job_ids?: unknown; reason?: unknown };
  if (!Array.isArray(a.job_ids)) return undefined;

  const jobIds = a.job_ids.filter((v): v is string => typeof v === "string" && !!v).slice(0, 6);
  if (!jobIds.length) return undefined;

  return {
    jobIds,
    ...(typeof a.reason === "string" && a.reason.trim()
      ? { reason: a.reason.trim().slice(0, 160) }
      : {}),
  };
}

/* ------------------------------------------------------------ ui actions */

/**
 * What a tool asks the screen to do.
 *
 * The model never touches the interface. It calls a tool, the tool runs real
 * application logic on the server, and the *result* may carry one of these —
 * a small, closed set of things the frontend already knows how to do. So the
 * worst a confused model can achieve is asking for the wrong panel, rather
 * than putting arbitrary markup on somebody's screen.
 *
 * Closed union on purpose: an action the frontend does not recognise is
 * ignored, which is the right failure. Adding a capability means adding a
 * case here and handling it, in that order.
 */
export type UiAction =
  | { type: "SHOW_RESUME_PREVIEW" }
  | { type: "SHOW_JOBS"; jobIds: string[]; reason?: string }
  /**
   * A form, for the things nobody should have to say aloud.
   *
   * The fields are resolved server-side against the resume schema before they
   * get here, so this carries specifications rather than requests: a field the
   * document has no room for never reaches the screen, and the model cannot
   * invent an input.
   */
  | { type: "SHOW_MANUAL_INPUT"; fields: FieldSpec[]; reason?: string };

/** Tool arguments arrive as whatever the model felt like sending. */
export function readUiAction(value: unknown): UiAction | undefined {
  if (!value || typeof value !== "object") return undefined;
  const a = value as { type?: unknown };

  if (a.type === "SHOW_RESUME_PREVIEW") return { type: "SHOW_RESUME_PREVIEW" };

  if (a.type === "SHOW_MANUAL_INPUT") {
    const fields = (value as { fields?: unknown }).fields;
    if (!Array.isArray(fields) || !fields.length) return undefined;
    return {
      type: "SHOW_MANUAL_INPUT",
      fields: fields as FieldSpec[],
      reason: typeof (value as { reason?: unknown }).reason === "string"
        ? (value as { reason: string }).reason
        : undefined,
    };
  }

  if (a.type === "SHOW_JOBS") {
    const show = readShowJobs({ job_ids: (value as { jobIds?: unknown }).jobIds, reason: (value as { reason?: unknown }).reason });
    return show ? { type: "SHOW_JOBS", ...show } : undefined;
  }

  return undefined;
}

/**
 * What a tool gives back.
 *
 * `summary` is the only part the model is told in words, and it is deliberately
 * short: a tool result read aloud in full is a robot reciting a database row.
 * `data` is there for tools whose whole purpose is to hand the model facts.
 */
export type ToolResult = {
  ok: boolean;
  summary: string;
  data?: unknown;
  action?: UiAction;
};
