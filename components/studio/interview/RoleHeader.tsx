"use client";

import { useState } from "react";
import { RolePicker } from "@/components/studio/interview/RolePicker";

/**
 * "For Graphic Designer role ✎".
 *
 * The pencil is the whole point: somebody applying for two kinds of job
 * switches between them constantly, and making that a trip to a settings
 * screen is how they stop bothering.
 */
export function RoleHeader({
  role,
  years,
  suggestions,
}: {
  role: string;
  years: number | null;
  suggestions: string[];
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="group inline-flex items-center gap-1.5 text-[0.88rem] text-ink-50 transition-colors hover:text-ink"
      >
        For <span className="font-medium text-ink">{role}</span>
        {years !== null && (
          <span className="text-ink-50">
            · {years === 0 ? "fresher" : `${years} yr${years === 1 ? "" : "s"}`}
          </span>
        )}
        <svg
          viewBox="0 0 24 24"
          aria-hidden
          className="size-[13px] text-ink-30 transition-colors group-hover:text-ink"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.8}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M4 20h4L19 9a2.1 2.1 0 0 0-3-3L5 17v3Z" />
        </svg>
        <span className="sr-only">Change role</span>
      </button>

      {open && (
        <RolePicker
          current={role}
          currentYears={years}
          suggestions={suggestions}
          open
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}
