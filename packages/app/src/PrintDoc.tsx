/**
 * The printed pattern — a THIRD renderer over the row array, alongside the prose and
 * the schematic (CLAUDE.md rule 4). It is not the screen with the furniture hidden:
 * the screen shows one piece at a time behind tabs, and a pattern you knit from needs
 * every piece. So this builds its own document from the same engine output and lives
 * hidden until an @media print rule reveals it (see theme.css).
 *
 * One sheet per piece: title, then the instructions across the full width — they do not
 * need a narrow column when nothing sits beside them. The blocking diagrams are gathered
 * at the END, one to a page and as large as the sheet allows, because knitting from the
 * words and blocking the finished piece against the drawing are separate acts that were
 * competing for the same page.
 *
 * Those full-page diagrams are rendered AT the size they print (see fitScaleFactor),
 * never rendered large and shrunk by CSS: scaleFactor scales the drawing but not the
 * label text, so re-rendering keeps the labels legible where CSS scaling took them down
 * to about 2.8pt.
 *
 * Three modes over that one layout:
 *  - 'prose'  — the written pattern. Concise sets it in two columns, which is the
 *               point of asking for concise: a markedly shorter document.
 *  - 'chart'  — the knit chart takes the place of the prose (as it does on screen).
 *  - 'templates' — the roller drawings (KnitLeader ½ / KnitRadar ¼) and nothing else,
 *               one per sheet, at exact physical size. See the scaling note in
 *               theme.css: what we control is our own layout, not the print dialogue.
 *
 * "Save as PDF" is a destination in the browser's print dialogue, not a separate path —
 * getting this document right gives us the PDF for free, with no backend (a non-goal)
 * and no PDF library.
 */

import type { CSSProperties, JSX, ReactNode } from 'react';
import type { Pattern, Units } from '@knit-helper-4000/engine';
import type { PieceId } from './engine';
import {
  describePlan, MARGIN_MM, PATTERN_MARGIN_MM,
  type BandPlan, type TilePlan,
} from './tiling';

/** Piece order matches renderPattern: back, front, sleeves, neckband, then Making Up. */
const PIECE_ORDER: PieceId[] = ['back', 'front', 'sleeve', 'neckband'];

export type PrintMode = 'prose' | 'chart' | 'templates';

export interface PrintDocProps {
  pattern: Pattern;
  mode: PrintMode;
  /** The blocking diagram per piece, at print density. */
  svgFor: (piece: PieceId) => string;
  /** The knit chart per piece; only read in 'chart' mode. */
  chartFor?: (piece: PieceId) => string;
  /** Two-column instructions — concise only. */
  twoColumn?: boolean;
  /** Templates mode: how each piece's drawing is cut across sheets. */
  tilePlanFor?: (piece: PieceId) => TilePlan;
  /** Height left on a sheet under its heading, in mm — sizes the charts. */
  sheetRoomMm: number;
  /** Printable height of one sheet, in mm — chart sheets are set to exactly this. */
  pageHeightMm: number;
  /** Chart mode: how a chart is banded down the page (landscape only). */
  chartBandsFor?: (piece: PieceId) => BandPlan;
  /** Full-page blocking diagram, rendered at the scale it will print. */
  blockingSvgFor?: (piece: PieceId) => string;
  /** Paper the document is laid out for; @page is emitted to match. */
  paperLabel: string;
  landscape: boolean;
  /** Heading facts: what this pattern is for. */
  sizeLabel: string;
  styleLabel: string;
  gaugeLabel: string;
  units: Units;
  templateLabel?: string;
}

function Sheet({ children, chart = false }: { children: ReactNode; chart?: boolean }): JSX.Element {
  // A chart sheet is a fixed-height flex column: the heading takes what it takes and
  // the chart gets exactly the rest. That replaces three rounds of guessing heading
  // heights in millimetres — the first sheet also carries the document header, so any
  // fixed allowance was wrong for one sheet or the other. Measuring beats estimating.
  return <section className={`print-sheet${chart ? ' chart-sheet' : ''}`}>{children}</section>;
}

/**
 * One roller template cut across sheets. A template is measured with a ruler, so it
 * must not be scaled — it keeps its size and takes the sheets it needs. (Charts are
 * NOT tiled: their symbols stay readable when scaled down, so a chart is simply fitted
 * to its page. Only a drawing that must hold true physical size belongs here.)
 */
function TiledDrawing({
  keyBase, title, meta, svg, plan,
}: {
  keyBase: string;
  title: string;
  meta: string;
  svg: string;
  plan: TilePlan;
}): JSX.Element[] {
  return plan.tiles.map((t) => (
    <Sheet key={`${keyBase}-${t.row}-${t.col}`}>
      {/* Exactly HEAD_MM tall and clipped — the plan subtracts this height from every
          tile, so anything taller pushes the window onto a second sheet. Two short
          lines only; longer notes belong on the cover. */}
      <div className="tile-head">
        <strong>{title}</strong>
        {!plan.single && (
          <span>
            {' '}— sheet {t.row * plan.cols + t.col + 1} of {plan.tiles.length}
            {' '}(across {t.col + 1}/{plan.cols}, down {t.row + 1}/{plan.rows})
          </span>
        )}
        {/* Every sheet is identified: tiles get taped, separated, and found again
            months later, so a lone sheet must say what it belongs to. */}
        <div className="tile-meta">{meta}</div>
      </div>
      {/* The window onto the drawing. Fixed physical size, overflow hidden; the SVG
          inside is shifted so this tile shows its own region. */}
      <div
        className="tile-window"
        style={{ width: `${plan.tileWidthMm}mm`, height: `${plan.tileHeightMm}mm` }}
      >
        <div
          className="tile-shift"
          style={{ left: `${-t.offsetXPx}px`, top: `${-t.offsetYPx}px` }}
          dangerouslySetInnerHTML={{ __html: svg }}
        />
        {/* Overlap guides: the strip duplicated on the neighbouring sheet. */}
        {t.col < plan.cols - 1 && <div className="tile-overlap right" />}
        {t.row < plan.rows - 1 && <div className="tile-overlap bottom" />}
        <span className="crop tl" /><span className="crop tr" />
        <span className="crop bl" /><span className="crop br" />
      </div>
    </Sheet>
  ));
}

export function PrintDoc({
  pattern,
  mode,
  svgFor,
  chartFor,
  twoColumn = false,
  tilePlanFor,
  sheetRoomMm,
  pageHeightMm,
  chartBandsFor,
  blockingSvgFor,
  paperLabel,
  landscape,
  sizeLabel,
  styleLabel,
  gaugeLabel,
  templateLabel,
}: PrintDocProps): JSX.Element {
  const head = (
    <header className="print-head">
      <h1>Knit-Helper 4000</h1>
      <p className="print-meta">
        {sizeLabel} · {styleLabel} · {gaugeLabel}
      </p>
    </header>
  );

  if (mode === 'templates') {
    // Each piece is cut into page-sized tiles. Every tile is strictly smaller than
    // the printable area, so "fit to page" has nothing to shrink and the drawing
    // comes out 1:1 whether or not the scale control has reset to its default.
    // @page cannot be set from an inline style, and it must agree with the paper the
    // tiles were planned for — otherwise the browser pages at one size while we cut
    // at another. One <style> element keeps the two in step.
    const firstPlan = tilePlanFor?.(PIECE_ORDER[0]);
    const pageRule = firstPlan
      ? `@page { size: ${firstPlan.paper.label} ${firstPlan.landscape ? 'landscape' : 'portrait'}; margin: ${MARGIN_MM}mm; }`
      : '';
    const anyTiled = PIECE_ORDER.some((id) => !(tilePlanFor?.(id)?.single ?? true));
    return (
      <div className="printdoc templates" aria-hidden="true">
        <style>{pageRule}</style>
        {/* Cover sheet. The assembly notes live here rather than on each tile: a tile's
            heading is a fixed height that the plan subtracts from the drawing area, so
            variable-length text there would make the tiles cut unequal amounts. */}
        <Sheet>
          {head}
          {templateLabel && <p className="print-note">{templateLabel}</p>}
          <h2 className="print-piece-title">What to print</h2>
          <ul className="cover-list">
            {PIECE_ORDER.map((id, i) => {
              const plan = tilePlanFor?.(id);
              if (!plan) return null;
              return (
                <li key={id}>
                  <strong>{pattern.pieces[i]?.title ?? ''}</strong> — {describePlan(plan)}
                </li>
              );
            })}
          </ul>
          {anyTiled && (
            <>
              <h2 className="print-piece-title">Joining the sheets</h2>
              <ol className="cover-list">
                <li>Trim each sheet to its corner marks.</li>
                <li>
                  The shaded strip down one edge is repeated on the next sheet — lay it
                  over its neighbour so the drawing lines up, and tape.
                </li>
                <li>
                  Work across each row first, then join the rows. Sheets are numbered
                  by position (across, down).
                </li>
                <li>
                  Check the 10&nbsp;cm calibration line with a ruler before knitting to
                  the template. If it is short, the printer scaled the page.
                </li>
              </ol>
            </>
          )}
        </Sheet>
        {PIECE_ORDER.map((id, i) => {
          const plan = tilePlanFor?.(id);
          if (!plan) return null;
          return (
            <TiledDrawing
              key={id}
              keyBase={id}
              title={pattern.pieces[i]?.title ?? ''}
              meta={`${sizeLabel} · ${gaugeLabel}`}
              svg={svgFor(id)}
              plan={plan}
            />
          );
        })}
      </div>
    );
  }

  // The pattern document pages at the chosen paper too — the full-page diagrams are
  // rendered to fit it, so the two have to agree.
  const patternPageRule = `@page { size: ${paperLabel} ${landscape ? 'landscape' : 'portrait'}; margin: ${PATTERN_MARGIN_MM}mm; }`;
  return (
    <div
      className="printdoc"
      aria-hidden="true"
      // How much height is left on a sheet once its heading has taken its share.
      // Depends on the paper, so it cannot be a fixed value in the stylesheet.
      // The printable height of one sheet. A chart sheet is set to exactly this and
      // lays its heading and chart out as a flex column, so the chart takes whatever
      // room the heading leaves rather than a height we guessed at.
      style={{ '--page-h': `${pageHeightMm}mm`, '--sheet-room': `${sheetRoomMm}mm` } as CSSProperties}
    >
      <style>{patternPageRule}</style>
      {pattern.pieces.map((piece, i) => {
        const id = PIECE_ORDER[i]; // undefined for Making Up — it has no piece to draw
        // Landscape charts fit the page WIDTH and run down it in full-width bands,
        // one per sheet. Splitting only one way means no sheet is ever a corner
        // sliver, and a chart is read row by row anyway, so a horizontal strip is
        // the natural unit. Portrait keeps the whole chart on one page instead.
        const bands = mode === 'chart' && id && chartFor ? chartBandsFor?.(id) : undefined;
        if (bands && bands.bands > 1 && id && chartFor) {
          const svg = chartFor(id);
          return Array.from({ length: bands.bands }, (_, b) => (
            <Sheet key={`${piece.title}-band-${b}`}>
              <div className="tile-head">
                <strong>{piece.title} — knit chart</strong>
                <span> — sheet {b + 1} of {bands.bands}, working upwards</span>
                <div className="tile-meta">{sizeLabel} · {gaugeLabel}</div>
              </div>
              <div
                className="band-window"
                style={{ width: `${bands.widthMm}mm`, height: `${Math.min(bands.bandHeightMm, bands.heightMm - b * bands.stepMm)}mm` }}
              >
                <div
                  className="band-shift"
                  style={{ top: `${-b * bands.stepMm}mm`, width: `${bands.widthMm}mm` }}
                  dangerouslySetInnerHTML={{ __html: svg }}
                />
              </div>
            </Sheet>
          ));
        }
        return (
          <Sheet key={piece.title} chart={mode === 'chart' && !!id}>
            {i === 0 && head}
            <h2 className="print-piece-title">{piece.title}</h2>
            {mode === 'chart' && id && chartFor ? (
              // Portrait: scaled to the room under the heading, so the chart lands on
              // its own title's page. Scaling shrinks the glyphs with the cells, which
              // is what a chart wants — its symbols are drawn at fixed pixel sizes, so
              // re-rendering at smaller cells would make them collide instead.
              <div className="print-chart" dangerouslySetInnerHTML={{ __html: chartFor(id) }} />
            ) : (
              <div className={twoColumn ? 'print-prose two-col' : 'print-prose'}>
                {piece.lines.map((line, j) => (
                  <p key={j}>{line}</p>
                ))}
              </div>
            )}
          </Sheet>
        );
      })}

      {/* The blocking diagrams, gathered at the end — one to a page and as large as
          the sheet allows. They are a different act from following the instructions:
          you knit from the words, then block the finished piece against the drawing,
          so they are worth more as full-page references than as thumbnails wedged
          above the text they were competing with. */}
      {PIECE_ORDER.map((id, i) => (
        <Sheet key={`diagram-${id}`}>
          <h2 className="print-piece-title">{pattern.pieces[i]?.title ?? ''} — blocking diagram</h2>
          <div className="print-diagram big" dangerouslySetInnerHTML={{ __html: (blockingSvgFor ?? svgFor)(id) }} />
        </Sheet>
      ))}
    </div>
  );
}
