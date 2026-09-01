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
