import type { Block } from "@/lib/app/flow/blocks";
import type { Page } from "@/lib/app/flow/paginate";
import {
  A4_H,
  A4_W,
  APAD,
  FOOT,
  GUT,
  HEAD_GAP,
  MARGIN,
  columnsOf,
  geometryOf,
  type Plan,
} from "@/lib/app/flow/layout";
import { asideStyle, themeStyle, type FlowTheme } from "@/lib/app/flow/theme";

/**
 * The sheets, painted.
 *
 * No hooks, no measuring, no state — give it blocks, a plan and a theme and
 * it returns pages. That is what makes it usable from the server for a PDF
 * and from the client for the preview without either growing its own idea of
 * what a page looks like.
 */
export function FlowPages({
  blocks,
  plan,
  theme,
  className,
}: {
  blocks: Block[];
  /** Null until the first measurement lands. One blank sheet is shown. */
  plan: Plan | null;
  theme: FlowTheme;
  className?: string;
}) {
  const s = theme.shape;
  const g = geometryOf(theme);
  const cols = columnsOf(blocks);
  const byId = new Map(blocks.map((b) => [b.id, b]));
  const style = themeStyle(theme);
  const aStyle = asideStyle(theme);
  const sheets = plan?.pages ?? [{ main: { ids: [] }, aside: { ids: [] } }];

  const run = (page: Page | null | undefined, width: number) =>
    (page?.ids ?? []).map((id, n) => {
      const b = byId.get(id);
      if (!b) return null;
      return (
        <div
          key={id}
          data-path={b.path ?? undefined}
          style={{
            position: "relative",
            marginTop: n === 0 ? 0 : `${b.gapBefore}mm`,
            marginLeft: b.inset ? `${b.inset}mm` : undefined,
            width: b.inset ? `${width - b.inset}mm` : undefined,
          }}
        >
          {b.node}
        </div>
      );
    });

  const headOnThisPage = (i: number) => i === 0 && cols.head.length > 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "6mm", alignItems: "center" }}>
      {sheets.map((sheet, i) => (
        <div
          key={i}
          className={className}
          data-page={i + 1}
          style={{
            ...style,
            width: `${A4_W}mm`,
            height: `${A4_H}mm`,
            background: "#fff",
            boxSizing: "border-box",
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
            position: "relative",
          }}
        >
          {/* --------------------------------------------------- the header */}
          {headOnThisPage(i) && (
            <div
              style={{
                flex: "0 0 auto",
                boxSizing: "border-box",
                padding:
                  s.header === "band"
                    ? `${MARGIN}mm ${MARGIN}mm ${MARGIN}mm`
                    : `${MARGIN}mm ${MARGIN}mm 0`,
                background: s.header === "band" ? "var(--r-accent)" : undefined,
              }}
            >
              {run({ ids: cols.head.map((b) => b.id) }, g.headW)}
            </div>
          )}

          {/* ---------------------------------------------------- the body */}
          <div style={{ display: "flex", flex: "1 1 auto", minHeight: 0 }}>
            {g.hasAside && s.aside === "left" && (
              <Aside i={i} sheet={sheet} theme={theme} aStyle={aStyle} run={run} head={headOnThisPage(i)} />
            )}
            <div
              style={{
                position: "relative",
                flex: "1 1 auto",
                minWidth: 0,
                boxSizing: "border-box",
                paddingTop: `${headOnThisPage(i) ? HEAD_GAP : MARGIN}mm`,
                paddingBottom: `${s.footerBand ? 6 : MARGIN}mm`,
                paddingLeft: `${g.hasAside && s.aside === "left" ? GUT : MARGIN}mm`,
                paddingRight: `${g.hasAside && s.aside === "right" ? GUT : MARGIN}mm`,
              }}
            >
              {/* One continuous rail, rather than a dash beside each entry. */}
              {s.rail && (
                <div
                  aria-hidden="true"
                  style={{
                    position: "absolute",
                    left: `${MARGIN + 1}mm`,
                    top: `${headOnThisPage(i) ? HEAD_GAP : MARGIN}mm`,
                    bottom: `${MARGIN}mm`,
                    width: "0.35mm",
                    background: "var(--r-accent)",
                    opacity: 0.28,
                  }}
                />
              )}
              {run(sheet.main, g.mainInner)}
            </div>
            {g.hasAside && s.aside === "right" && (
              <Aside i={i} sheet={sheet} theme={theme} aStyle={aStyle} run={run} head={headOnThisPage(i)} />
            )}
          </div>

          {s.footerBand && (
            <div style={{ flex: "0 0 auto", height: `${FOOT}mm`, background: "var(--r-accent)" }} />
          )}
        </div>
      ))}
    </div>
  );
}

function Aside({
  i,
  sheet,
  theme,
  aStyle,
  run,
  head,
}: {
  i: number;
  sheet: { aside: Page | null };
  theme: FlowTheme;
  aStyle: React.CSSProperties;
  run: (page: Page | null | undefined, width: number) => React.ReactNode;
  head: boolean;
}) {
  const s = theme.shape;
  const g = geometryOf(theme);
  void i;
  return (
    <div
      style={{
        ...aStyle,
        width: `${g.asideW}mm`,
        flex: "0 0 auto",
        boxSizing: "border-box",
        padding: `${head ? HEAD_GAP : MARGIN}mm ${APAD}mm ${MARGIN}mm`,
        background: s.asideFill ? "var(--r-wash)" : undefined,
        borderRight: s.asideRule && s.aside === "left" ? "0.4pt solid rgba(0,0,0,0.18)" : undefined,
        borderLeft: s.asideRule && s.aside === "right" ? "0.4pt solid rgba(0,0,0,0.18)" : undefined,
      }}
    >
      {run(sheet.aside, g.asideInner)}
    </div>
  );
}

/**
 * The hidden layer every height is read from.
 *
 * Exported because two very different callers need exactly the same markup:
 * the editor renders it into the page and reads it back, and the PDF renderer
 * renders it in a headless browser for the same reason. If they differed by
 * a single padding, the two documents would break pages in different places.
 */
export function FlowProbe({ blocks, theme }: { blocks: Block[]; theme: FlowTheme }) {
  const g = geometryOf(theme);
  const cols = columnsOf(blocks);
  const style = themeStyle(theme);
  const aStyle = asideStyle(theme);

  return (
    <div style={{ ...style, display: "flex", flexDirection: "column" }}>
      <div style={{ width: `${g.headW}mm` }}>
        {cols.head.map((b) => (
          <div key={b.id} data-block={b.id}>
            {b.node}
          </div>
        ))}
      </div>
      <div style={{ ...aStyle, width: `${g.asideInner}mm` }}>
        {cols.aside.map((b) => (
          <div key={b.id} data-block={b.id}>
            {b.node}
          </div>
        ))}
      </div>
      <div style={{ width: `${g.mainInner}mm` }}>
        {cols.main.map((b) => (
          <div
            key={b.id}
            data-block={b.id}
            style={b.inset ? { width: `${g.mainInner - b.inset}mm` } : undefined}
          >
            {b.node}
          </div>
        ))}
      </div>
    </div>
  );
}
