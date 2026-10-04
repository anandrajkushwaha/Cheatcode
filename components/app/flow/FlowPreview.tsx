"use client";

import { useState } from "react";
import type { Resume } from "@/lib/app/resume-schema";
import { FlowDoc } from "@/components/app/flow/FlowDoc";

/**
 * The preview with its own controls, so the engine can be pushed around
 * before there is a form to push it from. Every knob here is a theme token:
 * one value changes and the whole document re-measures and re-breaks.
 */
export function FlowPreview({ resume, templateId }: { resume: Resume; templateId: string | null }) {
  const [accent, setAccent] = useState("#1f5bff");
  const [scale, setScale] = useState(1);
  const [density, setDensity] = useState(1);
  const [pages, setPages] = useState(1);

  const row = "flex items-center gap-2 text-[0.8rem]";

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-5 rounded-2xl border border-ink-08 bg-paper p-4">
        <label className={row}>
          Accent
          <input type="color" value={accent} onChange={(e) => setAccent(e.target.value)} className="size-7 rounded border border-ink-15" />
        </label>
        <label className={row}>
          Text size
          <input type="range" min={0.85} max={1.2} step={0.01} value={scale} onChange={(e) => setScale(Number(e.target.value))} />
          <span className="tabular-nums text-ink-30">{scale.toFixed(2)}×</span>
        </label>
        <label className={row}>
          Spacing
          <input type="range" min={0.7} max={1.5} step={0.01} value={density} onChange={(e) => setDensity(Number(e.target.value))} />
          <span className="tabular-nums text-ink-30">{density.toFixed(2)}×</span>
        </label>
        <span className="ml-auto text-[0.8rem] tabular-nums text-ink-50">
          {pages} page{pages === 1 ? "" : "s"}
        </span>
      </div>

      <div className="overflow-x-auto">
        <FlowDoc
          resume={resume}
          templateId={templateId}
          overrides={{ accent, scale, density }}
          onPages={setPages}
        />
      </div>
    </>
  );
}
