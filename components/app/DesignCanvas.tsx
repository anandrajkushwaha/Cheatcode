"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { DesignPage, textCss } from "@/components/app/DesignPage";
import {
  A4,
  bounds,
  hits,
  unionBounds,
  type Design,
  type Element,
  type TextElement,
} from "@/lib/app/design";
import { groupMates, patch, resize, snap, type Guide, type Handle } from "@/lib/app/design-ops";

/**
 * The part that needs a browser.
 *
 * Everything about *what* an edit does lives in design-ops, tested without a
 * DOM. This file does the one thing that genuinely cannot be tested that way:
 * turn a pointer into a millimetre, and draw the handles and guides that tell
 * somebody what is about to happen.
 *
 * ------------------------------------------------------------ hit testing
 *
 * Against the model, not the DOM. The obvious build puts an onClick on every
 * element and lets the browser decide what was clicked — and then rotation,
 * locking, groups, and elements that overlap each other all need their own
 * special case, because the browser's answer is about painted pixels and the
 * question is about the document. Walking the element list from the top and
 * asking `hits()` is a dozen lines, is the same code the tests exercise, and
 * gets all four of those right for free.
 *
 * ------------------------------------------------------------- page breaks
 *
 * Pages are separate sheets with real space between them, and that space is
 * the page break. The version this replaces drew a dashed line across a
 * continuous document at a height it calculated, which was a guess about where
 * a break would land and was drawn in a place the printed page had nothing at
 * all. Here the break is not indicated, it is *shown*: page two starts where
 * page two starts, on screen and on paper, because they are the same object.
 */

/** CSS pixels per millimetre. Fixed by the spec: 1in = 96px = 25.4mm. */
const MM = 96 / 25.4;

/** How close a dragged edge has to be, in screen pixels, before it snaps. */
const SNAP_PX = 6;

type Props = {
  design: Design;
  page: number;
  onPage: (index: number) => void;
  selection: string[];
  onSelect: (ids: string[]) => void;
  zoom: number;
  editing: string | null;
  onEditing: (id: string | null) => void;
  /** Called once at the start of a gesture, so undo has something to go back to. */
  begin: () => void;
  onChange: (design: Design) => void;
  /** A silent change — measurement, not an edit. Never enters history. */
  onMeasure: (design: Design) => void;
};

/**
 * `began` is why undo works.
 *
 * The obvious place to snapshot for history is the pointer-down that starts a
 * gesture — and it is wrong, because most pointer-downs are somebody selecting
 * something and changing nothing. Do it there and clicking around the page
 * fills the undo stack with identical states, so Ctrl-Z appears to be broken:
 * it "works" five times and the document never changes.
 *
 * So the snapshot is taken lazily, on the first pointer-move that actually
 * modifies the document, and this flag is how a gesture remembers it already
 * has one.
 */
type Gesture =
  | { kind: "move"; x: number; y: number; from: Map<string, { x: number; y: number }>; began: boolean }
  | { kind: "resize"; handle: Handle; x: number; y: number; from: Element[]; began: boolean }
  | { kind: "rotate"; cx: number; cy: number; start: number; from: number; began: boolean }
  | { kind: "marquee"; x0: number; y0: number }
  | null;

export function DesignCanvas({
  design,
  page,
  onPage,
  selection,
  onSelect,
  zoom,
  editing,
  onEditing,
  begin,
  onChange,
  onMeasure,
}: Props) {
  const pageRefs = useRef<(HTMLDivElement | null)[]>([]);
  const gesture = useRef<Gesture>(null);
  const [guides, setGuides] = useState<Guide[]>([]);
  const [marquee, setMarquee] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  /**
   * Which group the pointer is currently "inside".
   *
   * Null means a click on any member selects the whole group, which is what a
   * group is for. Double-clicking a member sets this, and from then until the
   * selection is dropped, clicks pick out one element at a time — the same
   * step-in that every design tool has and that nobody ever reads about.
   */
  const [inside, setInside] = useState<string | null>(null);

  const current = design.pages[page];

  /* ------------------------------------------------------------ measuring */

  /**
   * Text boxes are measured, not calculated.
   *
   * The seeder estimates heights from an average glyph width because it has no
   * fonts; the browser has the real ones. So after every paint, any auto-height
   * text box whose stored height disagrees with the height it actually drew at
   * gets corrected. This is what makes selection rings, alignment and snapping
   * line up with the words rather than with an approximation of them.
   *
   * It goes through `onMeasure` rather than `onChange` because it is not an
   * edit. Nobody should be able to press Ctrl-Z and undo the browser's opinion
   * about how tall a paragraph is.
   */
  useLayoutEffect(() => {
    const host = pageRefs.current[page];
    if (!host || !current) return;

    let next = design;
    let changed = false;
    for (const el of current.elements) {
      if (el.type !== "text" || !el.autoHeight) continue;
      const node = host.querySelector<HTMLElement>(`[data-el="${CSS.escape(el.id)}"]`);
      if (!node) continue;
      // offsetHeight is layout pixels and ignores the zoom transform, so this
      // is the true height at 100% whatever the canvas is scaled to.
      const mm = node.offsetHeight / MM;
      if (Math.abs(mm - el.h) > 0.25) {
        next = patch(next, page, [el.id], (e) => ({ ...e, h: mm }));
        changed = true;
      }
    }
    if (changed) onMeasure(next);
  });

  /* ------------------------------------------------------------ geometry */

  /** Client coordinates to millimetres on the given page. */
  const toMm = useCallback(
    (index: number, clientX: number, clientY: number) => {
      const rect = pageRefs.current[index]?.getBoundingClientRect();
      if (!rect) return { x: 0, y: 0 };
      return { x: (clientX - rect.left) / (MM * zoom), y: (clientY - rect.top) / (MM * zoom) };
    },
    [zoom],
  );

  const selected = current?.elements.filter((e) => selection.includes(e.id)) ?? [];
  const frame = unionBounds(selected);

  /* ------------------------------------------------------------- gestures */

  /**
   * Listeners on the window, re-registered every render, and no early return
   * for "there is no gesture".
   *
   * The early return is the tempting version and it is broken: a pointer-down
   * that does not happen to change any state — clicking an element that was
   * already selected — causes no re-render, so the effect never runs, so the
   * listeners are never attached and the drag silently does nothing. Attaching
   * unconditionally and checking the ref inside costs two no-op handlers and
   * removes a bug that only shows up on the second click.
   *
   * Window rather than the page, so a drag that leaves the paper still tracks.
   */
  useEffect(() => {
    /** The first change of a gesture, and only the first, enters history. */
    const record = () => {
      const g = gesture.current;
      if (g && g.kind !== "marquee" && !g.began) {
        g.began = true;
        begin();
      }
    };

    const move = (e: PointerEvent) => {
      const g = gesture.current;
      if (!g || !current) return;
      const at = toMm(page, e.clientX, e.clientY);
      const threshold = SNAP_PX / (MM * zoom);

      if (g.kind === "move") {
        let dx = at.x - g.x;
        let dy = at.y - g.y;

        // Shift locks to one axis, the way it does everywhere else.
        if (e.shiftKey) {
          if (Math.abs(dx) > Math.abs(dy)) dy = 0;
          else dx = 0;
        }

        const moving = selected.map((el) => {
          const from = g.from.get(el.id);
          return bounds({ ...el, x: (from?.x ?? el.x) + dx, y: (from?.y ?? el.y) + dy });
        });
        const box = unionBounds(moving);
        const others = current.elements
          .filter((el) => !selection.includes(el.id))
          .map((el) => bounds(el));

        let sx = 0;
        let sy = 0;
        if (box && !e.altKey) {
          const s = snap(box, others, threshold);
          sx = s.dx;
          sy = s.dy;
          setGuides(s.guides);
        } else {
          setGuides([]);
        }

        record();
        onChange(
          patch(design, page, selection, (el) => {
            const from = g.from.get(el.id);
            return { ...el, x: (from?.x ?? el.x) + dx + sx, y: (from?.y ?? el.y) + dy + sy };
          }),
        );
        return;
      }

      if (g.kind === "resize") {
        const dx = at.x - g.x;
        const dy = at.y - g.y;
        // Shift keeps the proportions; an image or a shape keeps them by
        // default from a corner, because squashing a photograph is almost
        // never what somebody dragging a corner meant.
        const corner = g.handle.length === 2;
        const keepRatio = e.shiftKey || (corner && g.from.some((el) => el.type === "image"));
        const byId = new Map(g.from.map((el) => [el.id, el]));
        record();
        onChange(
          patch(design, page, selection, (el) => {
            const from = byId.get(el.id);
            if (!from) return el;
            const next = resize(from, g.handle, dx, dy, keepRatio);
            // Dragging a side of a text box is how somebody says "this width,
            // and I will decide the height" — so it stops growing on its own.
            return next.type === "text" && !corner ? { ...next, autoHeight: false } : next;
          }),
        );
        return;
      }

      if (g.kind === "rotate") {
        const angle = (Math.atan2(at.y - g.cy, at.x - g.cx) * 180) / Math.PI;
        let rot = g.from + (angle - g.start);
        // Without a modifier it snaps to fifteens, which is what makes a
        // deliberately straight element actually straight. Alt frees it.
        if (!e.altKey) rot = Math.round(rot / 15) * 15;
        record();
        onChange(patch(design, page, selection, (el) => ({ ...el, rot: ((rot % 360) + 360) % 360 })));
        return;
      }

      if (g.kind === "marquee") {
        const box = {
          x: Math.min(g.x0, at.x),
          y: Math.min(g.y0, at.y),
          w: Math.abs(at.x - g.x0),
          h: Math.abs(at.y - g.y0),
        };
        setMarquee(box);
        onSelect(
          current.elements
            .filter((el) => {
              const b = bounds(el);
              return (
                b.x < box.x + box.w && b.x + b.w > box.x && b.y < box.y + box.h && b.y + b.h > box.y
              );
            })
            .map((el) => el.id),
        );
      }
    };

    const up = () => {
      if (!gesture.current) return;
      gesture.current = null;
      setGuides([]);
      setMarquee(null);
    };

    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
    };
  });

  /* --------------------------------------------------------------- clicks */

  function onPagePointerDown(index: number, e: React.PointerEvent) {
    // Only the primary button. Right-click is the context menu's business and
    // must not move anything on its way there.
    if (e.button !== 0) return;
    if (index !== page) onPage(index);
    if (editing) onEditing(null);

    const at = toMm(index, e.clientX, e.clientY);
    const list = design.pages[index]?.elements ?? [];

    // Top of the stack downwards: the thing somebody sees on top is the thing
    // they mean, and the list is in paint order.
    let hit: Element | null = null;
    for (let i = list.length - 1; i >= 0; i--) {
      if (hits(list[i], at.x, at.y)) {
        hit = list[i];
        break;
      }
    }

    if (!hit) {
      // Clicking the page, and not on anything, clears the selection. This is
      // the behaviour that was missing and that made the editor feel stuck:
      // once something was selected there was no way to say "nothing".
      if (!e.shiftKey) onSelect([]);
      setInside(null);
      gesture.current = { kind: "marquee", x0: at.x, y0: at.y };
      setMarquee({ x: at.x, y: at.y, w: 0, h: 0 });
      return;
    }

    const mates =
      hit.group && hit.group !== inside ? groupMates(design.pages[index], hit.id) : [hit.id];

    let next: string[];
    if (e.shiftKey) {
      const has = selection.includes(hit.id);
      next = has ? selection.filter((id) => !mates.includes(id)) : [...selection, ...mates];
    } else {
      next = selection.includes(hit.id) ? selection : mates;
    }
    onSelect(next);

    if (hit.locked) return;

    gesture.current = {
      kind: "move",
      began: false,
      x: at.x,
      y: at.y,
      from: new Map(
        (design.pages[index]?.elements ?? [])
          .filter((el) => next.includes(el.id))
          .map((el) => [el.id, { x: el.x, y: el.y }]),
      ),
    };
  }

  function onPageDoubleClick(index: number, e: React.MouseEvent) {
    const at = toMm(index, e.clientX, e.clientY);
    const list = design.pages[index]?.elements ?? [];
    for (let i = list.length - 1; i >= 0; i--) {
      const el = list[i];
      if (!hits(el, at.x, at.y)) continue;
      if (el.locked) return;
      // Step inside a group first; a second double-click then opens the text.
      if (el.group && el.group !== inside) {
        setInside(el.group);
        onSelect([el.id]);
        return;
      }
      if (el.type === "text") {
        onSelect([el.id]);
        onEditing(el.id);
      }
      return;
    }
  }

  function startResize(handle: Handle, e: React.PointerEvent) {
    e.stopPropagation();
    if (e.button !== 0) return;
    const at = toMm(page, e.clientX, e.clientY);
    gesture.current = {
      kind: "resize",
      began: false,
      handle,
      x: at.x,
      y: at.y,
      from: selected.map((el) => ({ ...el })),
    };
  }

  function startRotate(e: React.PointerEvent) {
    e.stopPropagation();
    if (e.button !== 0 || !frame) return;
    const at = toMm(page, e.clientX, e.clientY);
    const cx = frame.x + frame.w / 2;
    const cy = frame.y + frame.h / 2;
    gesture.current = {
      kind: "rotate",
      began: false,
      cx,
      cy,
      start: (Math.atan2(at.y - cy, at.x - cx) * 180) / Math.PI,
      from: selected[0]?.rot ?? 0,
    };
  }

  /* ---------------------------------------------------------------- draw */

  const mm = (v: number) => `${v}mm`;

  return (
    <div className="flex flex-col items-center gap-0">
      {design.pages.map((p, index) => (
        <div key={p.id} className="flex flex-col items-center">
          {/* The gap between sheets. Not a line pretending a break is here —
              the actual space between page one and page two. */}
          {index > 0 && <div style={{ height: 26 * zoom }} aria-hidden />}

          <div
            className="relative"
            style={{
              width: A4.w * MM * zoom,
              height: A4.h * MM * zoom,
            }}
          >
            <div
              ref={(node) => {
                pageRefs.current[index] = node;
              }}
              className="absolute left-0 top-0 origin-top-left touch-none select-none"
              style={{ transform: `scale(${zoom})` }}
              onPointerDown={(e) => onPagePointerDown(index, e)}
              onDoubleClick={(e) => onPageDoubleClick(index, e)}
            >
              <div
                className="shadow-[0_1px_2px_rgba(0,0,0,0.10),0_10px_28px_-12px_rgba(0,0,0,0.28)]"
                style={{ width: mm(A4.w), height: mm(A4.h) }}
              >
                <DesignPage page={p} editing={index === page ? editing : null}>
                  {index === page && (
                    <>
                      {/* Everything below is drawn *inside* the page, in
                          millimetres, so it scales with the zoom without a
                          single hand-written conversion. */}
                      {guides.map((g, i) => (
                        <div
                          key={i}
                          className="pointer-events-none absolute bg-[#7c3aed]"
                          style={
                            g.axis === "x"
                              ? { left: mm(g.at), top: 0, width: 0.25 / zoom + "mm", height: mm(A4.h) }
                              : { top: mm(g.at), left: 0, height: 0.25 / zoom + "mm", width: mm(A4.w) }
                          }
                        />
                      ))}

                      {marquee && (
                        <div
                          className="pointer-events-none absolute border border-[#7c3aed] bg-[#7c3aed]/10"
                          style={{ left: mm(marquee.x), top: mm(marquee.y), width: mm(marquee.w), height: mm(marquee.h) }}
                        />
                      )}

                      {selected.map((el) => (
                        <div
                          key={el.id}
                          className="pointer-events-none absolute border border-[#7c3aed]"
                          style={{
                            left: mm(el.x),
                            top: mm(el.y),
                            width: mm(el.w),
                            height: mm(el.h),
                            transform: el.rot ? `rotate(${el.rot}deg)` : undefined,
                            borderWidth: 0.3 / zoom + "mm",
                            opacity: selected.length > 1 ? 0.55 : 1,
                          }}
                        />
                      ))}

                      {frame && !editing && (
                        <Frame
                          frame={frame}
                          zoom={zoom}
                          locked={selected.some((el) => el.locked)}
                          onResize={startResize}
                          onRotate={startRotate}
                        />
                      )}

                      {editing && <TextEditor design={design} page={page} id={editing} onChange={onChange} />}
                    </>
                  )}
                </DesignPage>
              </div>
            </div>
          </div>

          <p className="mt-2 mb-1 text-[0.7rem] tabular-nums text-ink-30">
            Page {index + 1} of {design.pages.length}
          </p>
        </div>
      ))}
    </div>
  );
}

/* ----------------------------------------------------------- the handles */

const HANDLES: { h: Handle; x: number; y: number; cursor: string }[] = [
  { h: "nw", x: 0, y: 0, cursor: "nwse-resize" },
  { h: "n", x: 0.5, y: 0, cursor: "ns-resize" },
  { h: "ne", x: 1, y: 0, cursor: "nesw-resize" },
  { h: "e", x: 1, y: 0.5, cursor: "ew-resize" },
  { h: "se", x: 1, y: 1, cursor: "nwse-resize" },
  { h: "s", x: 0.5, y: 1, cursor: "ns-resize" },
  { h: "sw", x: 0, y: 1, cursor: "nesw-resize" },
  { h: "w", x: 0, y: 0.5, cursor: "ew-resize" },
];

/**
 * The box, its handles and the rotation grip.
 *
 * Sized in inverse proportion to the zoom, so a handle is the same number of
 * screen pixels at 40% as at 200%. Handles that scale with the page are either
 * unusable when zoomed out or cover the element when zoomed in — and they are
 * a control, not part of the document.
 */
function Frame({
  frame,
  zoom,
  locked,
  onResize,
  onRotate,
}: {
  frame: { x: number; y: number; w: number; h: number };
  zoom: number;
  locked: boolean;
  onResize: (h: Handle, e: React.PointerEvent) => void;
  onRotate: (e: React.PointerEvent) => void;
}) {
  const size = 9 / (MM * zoom); // millimetres that read as nine screen pixels
  const mm = (v: number) => `${v}mm`;

  return (
    <>
      <div
        className="pointer-events-none absolute border-[#7c3aed]"
        style={{
          left: mm(frame.x),
          top: mm(frame.y),
          width: mm(frame.w),
          height: mm(frame.h),
          borderWidth: 0.35 / zoom + "mm",
        }}
      />

      {locked ? null : (
        <>
          {HANDLES.map((h) => (
            <div
              key={h.h}
              onPointerDown={(e) => onResize(h.h, e)}
              className="absolute rounded-full border border-[#7c3aed] bg-white shadow-sm"
              style={{
                left: mm(frame.x + frame.w * h.x - size / 2),
                top: mm(frame.y + frame.h * h.y - size / 2),
                width: mm(size),
                height: mm(size),
                borderWidth: 0.28 / zoom + "mm",
                cursor: h.cursor,
                touchAction: "none",
              }}
            />
          ))}

          <div
            onPointerDown={onRotate}
            title="Drag to rotate"
            className="absolute grid place-items-center rounded-full border border-[#7c3aed] bg-white shadow-sm"
            style={{
              left: mm(frame.x + frame.w / 2 - size / 2),
              top: mm(frame.y - size * 2.2),
              width: mm(size),
              height: mm(size),
              borderWidth: 0.28 / zoom + "mm",
              cursor: "grab",
              touchAction: "none",
            }}
          />
        </>
      )}
    </>
  );
}

/* -------------------------------------------------------- typing into it */

/**
 * A textarea, laid exactly over the box it is editing.
 *
 * Not `contentEditable`. A contenteditable div would let the browser put its
 * own markup into somebody's résumé the first time they pasted from Word, and
 * the model here is plain text on purpose. A textarea shares every property
 * that decides where a line breaks with the box underneath it — that is what
 * `textCss` is for — so the words wrap in the same places while being typed as
 * they will once they are committed.
 */
function TextEditor({
  design,
  page,
  id,
  onChange,
}: {
  design: Design;
  page: number;
  id: string;
  onChange: (d: Design) => void;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const el = design.pages[page]?.elements.find((e) => e.id === id) as TextElement | undefined;

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    node.focus();
    node.setSelectionRange(node.value.length, node.value.length);
  }, [id]);

  if (!el || el.type !== "text") return null;

  return (
    <textarea
      ref={ref}
      value={el.text}
      onChange={(e) =>
        onChange(patch(design, page, [id], (t) => ({ ...(t as TextElement), text: e.target.value })))
      }
      onPointerDown={(e) => e.stopPropagation()}
      onDoubleClick={(e) => e.stopPropagation()}
      spellCheck={false}
      className="absolute resize-none border-0 bg-transparent outline-none"
      style={{
        ...textCss(el),
        left: `${el.x}mm`,
        top: `${el.y}mm`,
        width: `${el.w}mm`,
        height: `${el.h}mm`,
        transform: el.rot ? `rotate(${el.rot}deg)` : undefined,
        // Every default a textarea brings with it and that the div underneath
        // does not have. Any one of these left in place moves the text by a
        // pixel or two the moment editing starts, which reads as a jump.
        padding: 0,
        margin: 0,
        overflow: "hidden",
        whiteSpace: "pre-wrap",
        overflowWrap: "break-word",
        wordBreak: "normal",
        boxSizing: "border-box",
        // A list draws its markers in the underlying element, which stays
        // visible; the words are indented to sit beside them.
        textIndent: 0,
        paddingLeft: el.list === "none" ? 0 : `${el.size * 1.2 * 0.3528}mm`,
      }}
    />
  );
}
