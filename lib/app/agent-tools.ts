import "server-only";
import type { ToolResult } from "@/lib/app/agent-types";
import { canGenerate, fieldSpec, FIELDS, resumeGaps, type Resume } from "@/lib/app/resume-schema";
import {
  ClearRefused,
  getOrCreateDraft,
  patchDraft,
  StoreError,
  type ResumePatch,
} from "@/lib/app/resume-store";

/**
 * What the agent is allowed to do, and the only way it can do it.
 *
 * The model does not touch the database, the interface, or anything else. It
 * calls one of these by name with arguments it invented, and every one of them
 * validates its input, runs ordinary application code, and returns a
 * predictable shape. A tool that is not in this file does not exist as far as
 * the agent is concerned.
 *
 * Two of the four run entirely without a model call of their own, and the
 * other two make none either — which is the shape the architecture asks for:
 * the realtime model orchestrates, and the work stays deterministic.
 *
 * `show_jobs` is the exception that proves the split: it is answered in the
 * browser, because the cards were already sent down with the ticket and a
 * round trip in the middle of somebody speaking is a pause they can hear.
 */

/* --------------------------------------------------------- declarations */

/**
 * Gemini-shaped, because that is what both providers are fed from — llm.ts
 * converts to OpenAI's JSON Schema, and live-ticket.ts strips the fields the
 * realtime session refuses. One declaration, three consumers.
 */
export const TOOLS = [
  {
    functionDeclarations: [
      {
        name: "show_jobs",
        description:
          "Display specific jobs on the user's screen as cards they can open and apply to. " +
          "Call this whenever you talk about particular roles. Only ever pass ids that " +
          "appear in the job list you were given.",
        parameters: {
          type: "OBJECT",
          properties: {
            job_ids: {
              type: "ARRAY",
              items: { type: "STRING" },
              description: "The ids of the jobs to show, best fit first. At most six.",
            },
            reason: {
              type: "STRING",
              description:
                "One short line shown above the cards, saying why these. E.g. 'Closest on your Python and Postgres.'",
            },
          },
          required: ["job_ids"],
        },
      },

      {
        name: "get_resume_profile",
        description:
          "Read the user's resume as structured data, plus a list of what is still missing " +
          "from it. Call this at the start of any conversation about their resume or career, " +
          "before asking them anything — most of what you might ask for is probably already " +
          "here, and asking again for something they have already given you is the fastest " +
          "way to sound like a form.",
        parameters: { type: "OBJECT", properties: {} },
      },

      {
        name: "update_resume_profile",
        description:
          "Save something the user told you into their resume. Call this as soon as you are " +
          "confident of a fact — do not collect several things and save them at the end, " +
          "because a call that drops loses everything not yet saved. " +
          "Send only the sections that changed. A section you send REPLACES the stored one " +
          "entirely, so when adding a role, send the complete list of roles including the " +
          "ones already there.",
        parameters: {
          type: "OBJECT",
          properties: {
            full_name: { type: "STRING" },
            email: { type: "STRING" },
            phone: { type: "STRING" },
            location: { type: "STRING", description: "City. Not the full address." },
            headline: { type: "STRING", description: "Under twelve words, how they'd describe themselves." },
            summary: { type: "STRING" },
            target_role: { type: "STRING", description: "The kind of job they want next." },
            years_experience: {
              type: "NUMBER",
              description: "Full-time work only, one decimal. A fresher is 0. Never a graduation year.",
            },
            skills: {
              type: "ARRAY",
              items: { type: "STRING" },
              description:
                "Concrete, searchable things: languages, frameworks, tools, platforms. " +
                "Never soft skills like 'team player'.",
            },
            roles: {
              type: "ARRAY",
              description: "Jobs, newest first.",
              items: {
                type: "OBJECT",
                properties: {
                  title: { type: "STRING" },
                  company: { type: "STRING" },
                  start: { type: "STRING", description: "'MMM YYYY', or 'YYYY' if the month is unknown." },
                  end: { type: "STRING" },
                  is_current: { type: "BOOLEAN" },
                  highlights: {
                    type: "ARRAY",
                    items: { type: "STRING" },
                    description:
                      "What they actually did, in their own words. Keep the numbers they say.",
                  },
                },
              },
            },
            education: {
              type: "ARRAY",
              items: {
                type: "OBJECT",
                properties: {
                  degree: { type: "STRING" },
                  institution: { type: "STRING" },
                  year: { type: "STRING" },
                },
              },
            },
            projects: {
              type: "ARRAY",
              description:
                "Personal, academic or open-source work. For somebody with no job history " +
                "this is the strongest section they have, so ask about it early.",
              items: {
                type: "OBJECT",
                properties: {
                  name: { type: "STRING" },
                  description: { type: "STRING" },
                  link: { type: "STRING" },
                  highlights: { type: "ARRAY", items: { type: "STRING" } },
                },
              },
            },
            certifications: { type: "ARRAY", items: { type: "STRING" } },
            achievements: {
              type: "ARRAY",
              items: { type: "STRING" },
              description: "Awards, rankings, published work. Things with a number or a name attached.",
            },
            confirm_clear: {
              type: "BOOLEAN",
              description:
                "Only set this if the user explicitly asked to remove everything from a " +
                "section. Without it, sending an empty list is refused.",
            },
          },
        },
      },

      {
        name: "show_manual_input",
        description:
          "Put a small form on the user's screen asking them to type specific fields. " +
          "Use this for anything miserable to say out loud or to hear back wrong: email " +
          "addresses, phone numbers, LinkedIn or portfolio links, and exact spellings. " +
          "Ask for two or three fields at a time, never the whole resume — a form with " +
          "nine boxes on it is the thing people close. After calling this, say one short " +
          "line telling them it is on screen, then stop and wait; do not also ask for the " +
          "same thing aloud, and do not read the values back when they come in.",
        parameters: {
          type: "OBJECT",
          properties: {
            fields: {
              type: "ARRAY",
              items: { type: "STRING" },
              description:
                "Field names, from exactly this list: " +
                FIELDS.map((f) => f.name).join(", ") +
                ". Anything else is ignored.",
            },
            reason: {
              type: "STRING",
              description:
                "One short line shown above the form saying why you need these. " +
                "E.g. 'So employers can actually reach you.'",
            },
          },
          required: ["fields"],
        },
      },

      {
        name: "show_resume_preview",
        description:
          "Put the user's resume on screen next to the conversation, so they can see what " +
          "you have written down. Call this after saving something substantial, and whenever " +
          "they ask what their resume looks like.",
        parameters: { type: "OBJECT", properties: {} },
      },
    ],
  },
];

/** Names the server can run. `show_jobs` is answered in the browser. */
export const SERVER_TOOLS = [
  "get_resume_profile",
  "update_resume_profile",
  "show_manual_input",
  "show_resume_preview",
] as const;

export type ServerToolName = (typeof SERVER_TOOLS)[number];

export function isServerTool(name: string): name is ServerToolName {
  return (SERVER_TOOLS as readonly string[]).includes(name);
}

/* -------------------------------------------------------------- running */

function args(value: unknown): Record<string, unknown> {
  if (typeof value === "string") {
    try {
      return JSON.parse(value) as Record<string, unknown>;
    } catch {
      return {};
    }
  }
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

/**
 * A resume, described for a model rather than for a screen.
 *
 * Sent as a compact object rather than prose. The model reads JSON perfectly
 * well and a paragraph describing a resume costs three times the tokens to say
 * the same thing less precisely.
 */
function forModel(resume: Resume) {
  const gaps = resumeGaps(resume);
  return {
    resume,
    missing: gaps.map((g) => ({ field: g.field, ask: g.ask, blocking: g.required })),
    can_generate: canGenerate(resume).ok,
  };
}

/** One short sentence for the model to work from, not to read aloud. */
function summarise(resume: Resume): string {
  const bits: string[] = [];
  if (resume.full_name) bits.push(resume.full_name);
  if (resume.roles.length) bits.push(`${resume.roles.length} role(s)`);
  if (resume.projects.length) bits.push(`${resume.projects.length} project(s)`);
  if (resume.skills.length) bits.push(`${resume.skills.length} skills`);
  const gaps = resumeGaps(resume);
  const still = gaps.length ? `. Still missing: ${gaps.map((g) => g.field).join(", ")}` : "";
  return (bits.length ? bits.join(", ") : "nothing saved yet") + still;
}

/**
 * Run a tool as this user, and never throw.
 *
 * A tool that throws would break the conversation it was called from, so every
 * failure comes back as a result the model can read and react to. "That did
 * not work, tell them why" is a recoverable turn; an exception is a dropped
 * call.
 */
export async function runTool(
  name: string,
  rawArgs: unknown,
  ctx: { userId: string },
): Promise<ToolResult> {
  const input = args(rawArgs);

  try {
    switch (name) {
      case "get_resume_profile": {
        const draft = await getOrCreateDraft(ctx.userId);
        return {
          ok: true,
          summary: summarise(draft.content),
          data: { ...forModel(draft.content), ats_score: draft.ats_score },
        };
      }

      case "update_resume_profile": {
        const { confirm_clear, ...rest } = input;
        const patch = rest as ResumePatch;

        if (!Object.keys(patch).length) {
          return { ok: false, summary: "Nothing to save — no fields were given." };
        }

        const draft = await patchDraft(ctx.userId, patch, {
          confirmClear: confirm_clear === true,
        });

        return {
          ok: true,
          summary: `Saved. ${summarise(draft.content)}`,
          data: {
            ...forModel(draft.content),
            ats_score: draft.ats_score,
            saved_fields: Object.keys(patch),
          },
          // The screen catches up on its own, so the agent does not have to
          // describe what it just wrote down.
          action: { type: "SHOW_RESUME_PREVIEW" },
        };
      }

      case "show_manual_input": {
        /**
         * The model names fields; the schema decides what a field is.
         *
         * Unknown names are dropped rather than passed through, so a model
         * that invents `aadhaar_number` or `expected_salary` cannot put a box
         * on somebody's screen asking for it. What reaches the browser is a
         * list of specifications taken from FIELDS, not anything the model
         * wrote.
         */
        const asked = Array.isArray(input.fields) ? input.fields : [];
        const fields = asked
          .filter((f): f is string => typeof f === "string")
          .map((f) => fieldSpec(f.trim()))
          .filter((f): f is NonNullable<typeof f> => Boolean(f))
          // Six is already more than anybody wants to fill in mid-conversation.
          .slice(0, 6);

        if (!fields.length) {
          return {
            ok: false,
            summary:
              `None of those are fields on a resume. The ones you can ask for are: ` +
              `${FIELDS.map((f) => f.name).join(", ")}.`,
          };
        }

        const reason = typeof input.reason === "string" ? input.reason.trim().slice(0, 160) : undefined;

        return {
          ok: true,
          summary:
            `A form is on their screen asking for ${fields.map((f) => f.label).join(", ")}. ` +
            `Tell them it is there in one line, then wait — do not ask for the same things ` +
            `aloud, and do not read their answers back.`,
          action: { type: "SHOW_MANUAL_INPUT", fields, ...(reason ? { reason } : {}) },
        };
      }

      case "show_resume_preview": {
        const draft = await getOrCreateDraft(ctx.userId);
        return {
          ok: true,
          summary: `Showing their resume. ${summarise(draft.content)}`,
          action: { type: "SHOW_RESUME_PREVIEW" },
        };
      }

      default:
        return { ok: false, summary: `There is no tool called ${name}.` };
    }
  } catch (e) {
    if (e instanceof ClearRefused) {
      // The model gets told exactly what to do about it, because this is the
      // one refusal it can legitimately retry.
      return {
        ok: false,
        summary:
          `Not saved: that would have emptied ${e.sections.join(" and ")}, which had ` +
          `things in it. If they really want it cleared, ask them first and then set ` +
          `confirm_clear. Otherwise send the complete list including what was already there.`,
      };
    }
    if (e instanceof StoreError) return { ok: false, summary: e.message };

    console.error(`agent-tools: ${name} failed —`, String(e).slice(0, 300));
    return { ok: false, summary: "That did not work. Carry on the conversation and try later." };
  }
}
