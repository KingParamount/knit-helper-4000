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

import { Fragment } from 'react';
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
  /** Hand knitting: the band is worked in place, so it has no blocking shape. */
  handBand?: boolean;
  /** Paper the document is laid out for; @page is emitted to match. */
  paperLabel: string;
  landscape: boolean;
  /** Heading facts: what this pattern is for. */
  titleLabel: string;
  sizeLabel: string;
  styleLabel: string;
  gaugeLabel: string;
  units: Units;
  templateLabel?: string;
}

function Sheet({ children, chart = false }: { children: ReactNode; chart?: boolean }): JSX.Element {
  // Every sheet starts a fresh page (break-BEFORE, in CSS) — one full-page item per
  // page. A chart sheet is additionally a fixed-height flex column: the heading takes
  // what it takes and the chart gets exactly the rest, which beats guessing heading
  // heights in millimetres (the first sheet also carries the document header).
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
  handBand = false,
  paperLabel,
  landscape,
  titleLabel,
  sizeLabel,
  styleLabel,
  gaugeLabel,
  templateLabel,
}: PrintDocProps): JSX.Element {
  const head = (
    <header className="print-head">
      <h1>{titleLabel}</h1>
      <p className="print-style">
        {styleLabel} · {gaugeLabel}
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

      {/* CHART mode: each piece's chart on its own sheet (banded down the page in
          landscape, whole-chart-to-a-page in portrait). */}
      {mode === 'chart' &&
        pattern.pieces.map((piece, i) => {
          // The sleeveless armhole band occupies the 'sleeve' schematic slot, so its
          // prose piece ('armband') looks its chart up there.
          const id = piece.piece === 'armband' ? 'sleeve' : piece.piece;
          if (!id || !chartFor) return null;
          const bands = chartBandsFor?.(id);
          if (bands && bands.bands > 1) {
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
            <Sheet key={piece.title} chart>
              {i === 0 && head}
              <h2 className="print-piece-title">{piece.title}</h2>
              <div className="print-chart" dangerouslySetInnerHTML={{ __html: chartFor(id) }} />
            </Sheet>
          );
        })}

      {/* CONCISE prose: the WHOLE document flows through one two-column block. The reader
          takes the entire left column of a page, then the entire right (column-fill:
          auto); a section heading simply flows on inline — it never restarts the
          columns. The header spans both columns at the top. */}
      {mode === 'prose' && twoColumn && (
        <div className="print-flow print-prose two-col">
          {head}
          {pattern.pieces.map((piece) => (
            <Fragment key={piece.title}>
              <h2 className="print-piece-title">{piece.title}</h2>
              {piece.lines.map((line, j) => (
                <p key={j}>{line}</p>
              ))}
            </Fragment>
          ))}
        </div>
      )}

      {/* VERBOSE prose: sections flow one after another down a single column. Each keeps
          its heading and opening ~10 lines together (the 'lead' class), so a section
          never begins as an orphaned heading at the foot of a page — it moves whole to
          the next page instead. */}
      {mode === 'prose' && !twoColumn &&
        pattern.pieces.map((piece, i) => {
          const LEAD_LINES = 10;
          return (
            <div className="print-piece" key={piece.title}>
              {i === 0 && head}
              <h2 className="print-piece-title">{piece.title}</h2>
              <div className="print-prose">
                {piece.lines.map((line, j) => (
                  <p key={j} className={j < LEAD_LINES ? 'lead' : undefined}>{line}</p>
                ))}
              </div>
            </div>
          );
        })}

      {/* The blocking diagrams, gathered at the end — one to a page and as large as
          the sheet allows. They are a different act from following the instructions:
          you knit from the words, then block the finished piece against the drawing,
          so they are worth more as full-page references than as thumbnails wedged
          above the text they were competing with. */}
      {PIECE_ORDER.map((id) => {
        const title = pattern.pieces.find((p) => p.piece === id)?.title ?? '';
        // A hand knitter's neckband is picked up and worked straight onto the garment,
        // so it is never blocked as a piece — there is no shape to block it to. Saying
        // so is more use than drawing an outline nobody can act on.
        // Each diagram is a full-page sheet; the shared break-before rule starts it on a
        // fresh page (including the first one, after the flowing prose above).
        if (handBand && id === 'neckband') {
          return (
            <Sheet key="diagram-neckband">
              <h2 className="print-piece-title">{title}</h2>
              <p className="print-prose">
                The neckband is picked up and worked directly onto the neckline, so there
                is nothing to block. See its chart for where the shaping falls.
              </p>
            </Sheet>
          );
        }
        return (
          <Sheet key={`diagram-${id}`}>
            <h2 className="print-piece-title">{title} — blocking diagram</h2>
            <div className="print-diagram big" dangerouslySetInnerHTML={{ __html: (blockingSvgFor ?? svgFor)(id) }} />
          </Sheet>
        );
      })}
    </div>
  );
}
