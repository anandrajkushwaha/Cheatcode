"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { createAsciiField, type ShapeSet } from "./engine";

type Props = {
  /** Fades in at the bottom once the centre shape has built. */
  children?: ReactNode;
  /** Override any of the three shapes (SVG path data in a 1600×900 frame). */
  shapes?: Partial<ShapeSet>;
  /** Section height in viewport heights; the extra over 1 is the scroll used by the animation. */
  scrollLength?: number;
};

export function AsciiField({ children, shapes, scrollLength = 3 }: Props) {
  const sectionRef = useRef<HTMLElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const section = sectionRef.current!;
    return createAsciiField(section, canvasRef.current!, {
      shapes,
      onProgress: (p) => section.style.setProperty("--p", p.toFixed(4)),
    });
    // Shapes are read once; pass a new key to remount if they change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <section ref={sectionRef} className="relative bg-[#10241f]" style={{ height: `${scrollLength * 100}svh` }}>
      <div className="sticky top-0 h-svh w-full overflow-hidden">
        <canvas ref={canvasRef} aria-hidden className="absolute inset-0 h-full w-full" />
        {children ? (
          <div
            className="absolute inset-x-0 bottom-[5%] flex justify-center px-5"
            style={{
              opacity: "clamp(0, (var(--p, 0) - 0.62) * 4, 1)",
              transform: "translateY(calc((1 - clamp(0, (var(--p, 0) - 0.62) * 4, 1)) * 18px))",
            }}
          >
            {children}
          </div>
        ) : null}
      </div>
    </section>
  );
}
