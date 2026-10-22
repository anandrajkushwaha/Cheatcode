"use client";

import { DesignPage, DesignStyles } from "@/components/app/DesignPage";
import { A4 } from "@/lib/app/design";
import { previewDesign } from "@/lib/app/design-sample";

/**
 * Three real templates fanned out — the picture on the /tools templates card.
 * Live pages rather than a screenshot, so it never shows a design we no
 * longer ship.
 */
const PAGE_PX = A4.w * (96 / 25.4);
const W = 150;
const FAN = [
  { id: "navy-band", rot: -9, x: -78, y: 14 },
  { id: "teal-split", rot: 8, x: 78, y: 14 },
  { id: "charcoal-photo", rot: 0, x: 0, y: 0 },
];

export function TemplateFan() {
  return (
    <div className="pointer-events-none absolute inset-0">
      <DesignStyles />
      {FAN.map((c) => (
        <div
          key={c.id}
          className="absolute left-1/2 top-[16%] overflow-hidden rounded-md bg-white shadow-[0_18px_40px_-12px_rgba(0,0,0,0.45)]"
          style={{
            width: W,
            height: W * (A4.h / A4.w),
            transform: `translateX(calc(-50% + ${c.x}px)) translateY(${c.y}px) rotate(${c.rot}deg)`,
          }}
        >
          <div className="origin-top-left" style={{ transform: `scale(${W / PAGE_PX})` }}>
            <DesignPage page={previewDesign(c.id).pages[0]} />
          </div>
        </div>
      ))}
    </div>
  );
}
