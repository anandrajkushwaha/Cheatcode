import {
  A4,
  type Element,
  type ImageElement,
  type LineElement,
  type Page,
  type ShapeElement,
  type TextElement,
} from "@/lib/app/design";
import { fontStack, GOOGLE_FONTS_HREF } from "@/lib/app/resume-style";

/**
 * One renderer. Not one per surface.
 *
 * The canvas, the gallery thumbnails and the PDF all draw a page through this
 * component. That is the whole point of it: the last version of this builder
 * had the document, the thumbnail and the print sheet agreeing *by
 * convention*, and they drifted — a class name collided and the thumbnails
 * went navy while the editor stayed white, and nobody found out from the code.
 * With one renderer a drift of that kind is not a bug you can have.
 *
 * It renders at true size — a page is exactly 210mm by 297mm — and knows
 * nothing about zoom. Callers that want it smaller wrap it and apply a CSS
 * transform, so the layout inside is *identical* at 40% and at 200%: same line
 * breaks, same wrapping, same page count. Scaling by changing font sizes would
 * be easier and would mean the thing somebody judges at 50% is not the thing
 * that prints.
 *
 * It is also completely passive. No pointer handlers, no selection, no state.
 * The editor hit-tests against the model in millimetres rather than against
 * the DOM, which is what lets rotated, locked and grouped elements behave the
 * same way without a single special case in here.
 */

/* ---------------------------------------------------------------- styles */

/**
 * The sheet, once per document rather than once per page.
 *
 * Almost everything is an inline style, because almost everything is per
 * element and comes out of the model. What is left is the handful of rules
 * that would otherwise be repeated on every element in the design.
 */
export const DESIGN_SHEET = `
.dp-page {
  position: relative;
  overflow: hidden;
  flex: none;
  background: #fff;
  /* The page is a paint surface, not a text container: nothing inherits from
     it, so an element that forgets to state a font gets the fallback rather
     than whatever the host page happens to use. */
  font-family: Helvetica, Arial, sans-serif;
  color: #000;
  -webkit-font-smoothing: antialiased;
}
.dp-el { position: absolute; box-sizing: border-box; }
.dp-text {
  white-space: pre-wrap;
  overflow-wrap: break-word;
  /* Words must break the same way here as in the textarea that overlays this
     box while somebody is typing into it. Every property that affects line
     breaking is set on both, and this is the list. */
  word-break: normal;
  hyphens: none;
  margin: 0;
  padding: 0;
}
.dp-list { margin: 0; padding: 0; list-style: none; }
.dp-list li { display: flex; gap: 0.45em; align-items: baseline; }
.dp-list li > span:first-child { flex: none; }
.dp-list li > span:last-child { flex: 1; min-width: 0; }
.dp-img { display: block; width: 100%; height: 100%; }

@media print {
  .dp-page { box-shadow: none !important; break-after: page; }
  .dp-page:last-child { break-after: auto; }
}
`;

/**
 * The font stylesheet and the sheet above, together, for a whole document.
 *
 * Rendered once by the editor, once by the gallery and once by the PDF's
 * HTML. Emitting it inside `DesignPage` instead would put a copy on every
 * thumbnail in a grid of fifty.
 */
export function DesignStyles() {
  return (
    <>
      <link rel="stylesheet" href={GOOGLE_FONTS_HREF} />
      <style>{DESIGN_SHEET}</style>
    </>
  );
}

/* ------------------------------------------------------------------ page */

export function DesignPage({
  page,
  /** Rendered under the elements — selection rings, guides, handles. */
  children,
  /** Which element, if any, is currently being typed into. */
  editing,
}: {
  page: Page;
  children?: React.ReactNode;
  editing?: string | null;
}) {
  return (
    <div
      className="dp-page"
      style={{ width: `${A4.w}mm`, height: `${A4.h}mm`, background: page.background }}
    >
      {page.elements.map((el) => (
        <ElementView key={el.id} el={el} hidden={editing === el.id} />
      ))}
      {children}
    </div>
  );
}

/**
 * One element.
 *
 * `hidden` rather than skipped while it is being edited: the textarea that
 * replaces it sits in the same place at the same size, and keeping the box in
 * the flow of the document means nothing below it moves at the moment
 * somebody starts typing.
 */
function ElementView({ el, hidden }: { el: Element; hidden?: boolean }) {
  const frame: React.CSSProperties = {
    left: `${el.x}mm`,
    top: `${el.y}mm`,
    width: `${el.w}mm`,
    // A text box that grows with its words has no height of its own in the
    // DOM — it takes the one the words need, and the editor measures that back
    // into the model. Storing a height and then rendering a different one is
    // how a box ends up clipping its own last line.
    height: el.type === "text" && el.autoHeight ? "auto" : `${el.h}mm`,
    opacity: hidden ? 0 : el.opacity,
    transform: el.rot ? `rotate(${el.rot}deg)` : undefined,
  };

  switch (el.type) {
    case "text":
      return <TextView el={el} frame={frame} />;
    case "image":
      return <ImageView el={el} frame={frame} />;
    case "shape":
      return <ShapeView el={el} frame={frame} />;
    case "line":
      return <LineView el={el} frame={frame} />;
  }
}

/* ------------------------------------------------------------------ text */

/** Every property that decides where a line breaks, in one place. */
export function textCss(el: TextElement): React.CSSProperties {
  return {
    fontFamily: fontStack(el.font) ?? el.font,
    fontSize: `${el.size}pt`,
    fontWeight: el.bold ? 700 : 400,
    fontStyle: el.italic ? "italic" : "normal",
    textDecoration: el.underline ? "underline" : "none",
    textTransform: el.caps ? "uppercase" : "none",
    color: el.color,
    textAlign: el.align,
    lineHeight: el.lineHeight,
    letterSpacing: el.letterSpacing ? `${el.letterSpacing}em` : "normal",
  };
}

function TextView({ el, frame }: { el: TextElement; frame: React.CSSProperties }) {
  const style = { ...frame, ...textCss(el) };

  if (el.list === "none") {
    return (
      <div className="dp-el dp-text" data-el={el.id} style={style}>
        {/* A trailing newline is invisible in HTML and visible in a textarea,
            so an empty box collapses to nothing rather than to a stray line. */}
        {el.text || " "}
      </div>
    );
  }

  const lines = el.text.split("\n");
  return (
    <ul className="dp-el dp-list" data-el={el.id} style={style}>
      {lines.map((lineText, i) => (
        <li key={i}>
          <span aria-hidden>{el.list === "bullet" ? "•" : `${i + 1}.`}</span>
          <span>{lineText || " "}</span>
        </li>
      ))}
    </ul>
  );
}

/* ----------------------------------------------------------------- image */

function ImageView({ el, frame }: { el: ImageElement; frame: React.CSSProperties }) {
  const flip = [el.flipX ? "scaleX(-1)" : "", el.flipY ? "scaleY(-1)" : ""]
    .filter(Boolean)
    .join(" ");

  return (
    <div
      className="dp-el"
      data-el={el.id}
      style={{
        ...frame,
        overflow: "hidden",
        borderRadius: el.shape === "circle" ? "50%" : el.radius ? `${el.radius}mm` : undefined,
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        className="dp-img"
        src={el.src}
        alt=""
        style={{
          objectFit: "cover",
          // The picture inside the hole. `objectPosition` moves it, `scale`
          // pushes it past the edges — between them that is a crop, with no
          // second element and no clipping wrapper.
          objectPosition: `${el.fit.x}% ${el.fit.y}%`,
          transform: [flip, el.fit.scale !== 1 ? `scale(${el.fit.scale})` : ""]
            .filter(Boolean)
            .join(" ") || undefined,
        }}
      />
    </div>
  );
}

/* ----------------------------------------------------------------- shape */

function ShapeView({ el, frame }: { el: ShapeElement; frame: React.CSSProperties }) {
  const stroke = el.strokeWidth > 0 ? `${el.strokeWidth}mm solid ${el.stroke}` : undefined;

  if (el.shape === "rect" || el.shape === "ellipse") {
    return (
      <div
        className="dp-el"
        data-el={el.id}
        style={{
          ...frame,
          background: el.fill,
          border: stroke,
          borderRadius: el.shape === "ellipse" ? "50%" : el.radius ? `${el.radius}mm` : undefined,
        }}
      />
    );
  }

  // Triangle and diamond as SVG rather than as a border trick: a border
  // triangle cannot take a stroke, cannot scale non-uniformly, and turns into
  // a different shape the moment somebody drags a side handle.
  const points =
    el.shape === "triangle" ? "50,0 100,100 0,100" : "50,0 100,50 50,100 0,50";
  return (
    <div className="dp-el" data-el={el.id} style={frame}>
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{ width: "100%", height: "100%", display: "block" }}>
        <polygon
          points={points}
          fill={el.fill}
          stroke={el.strokeWidth > 0 ? el.stroke : "none"}
          strokeWidth={el.strokeWidth > 0 ? (el.strokeWidth / el.w) * 100 : 0}
          vectorEffect="non-scaling-stroke"
        />
      </svg>
    </div>
  );
}

/* ------------------------------------------------------------------ line */

function LineView({ el, frame }: { el: LineElement; frame: React.CSSProperties }) {
  return (
    <div
      className="dp-el"
      data-el={el.id}
      style={{
        ...frame,
        // Drawn as a top border rather than a filled box, so a dashed or
        // dotted rule is one property rather than a repeating gradient.
        borderTop: `${el.strokeWidth}mm ${el.dash} ${el.stroke}`,
        height: `${Math.max(el.h, el.strokeWidth)}mm`,
      }}
    />
  );
}
