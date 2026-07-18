/**
 * Tiling an oversized roller template across sheets of paper.
 *
 * A KnitLeader (½) or KnitRadar (¼) template has to print at EXACT physical size or
 * it is worthless — you feed it through the machine and it drives the row counter.
 * A woman's 36" back at half scale is ~286mm wide, which does not fit A4, and an
 * oversized drawing meets one of three fates, none of them good:
 *
 *   - the print dialogue scales it down to fit (and Firefox RESETS to "fit to page
 *     width" every time it opens, so asking the knitter to select 100% does not
 *     stick — that is the failure this module exists to remove);
 *   - the browser clips the overflow (Chrome/Safari), losing a third of the width
 *     with no error and no visual tell;
 *   - or Firefox spills it across sheets, which is what we want but is not
 *     behaviour we can rely on elsewhere.
 *
 * So we tile explicitly: cut the drawing into page-sized pieces ourselves. Because
 * every sheet is then comfortably SMALLER than the printable area, "fit to page" has
 * nothing to shrink and prints 1:1 — the output is the same whether or not the scale
 * control has reset. Tiles carry an overlap so they can be taped, and the knitter
 * picks the paper here (a page cannot read the paper size chosen in the print
 * dialogue — there is no API for it — so the two have to be told the same thing).
 *
 * Pure arithmetic: no DOM, no I/O.
 */

/** CSS pixels per inch when printing — fixed by the CSS spec, not by the device. */
export const CSS_PX_PER_IN = 96;

export const mmToPx = (mm: number): number => (mm / 25.4) * CSS_PX_PER_IN;
export const pxToMm = (px: number): number => (px / CSS_PX_PER_IN) * 25.4;

export interface Paper {
  id: PaperId;
  label: string;
  widthMm: number;
  heightMm: number;
}

export type PaperId = 'a4' | 'a3' | 'letter';

export const PAPERS: Paper[] = [
  { id: 'a4', label: 'A4', widthMm: 210, heightMm: 297 },
  { id: 'a3', label: 'A3', widthMm: 297, heightMm: 420 },
  { id: 'letter', label: 'Letter', widthMm: 216, heightMm: 279 },
];

/** Printer margin we ask for, and the overlap left on tiles for taping. */
export const MARGIN_MM = 10;
export const OVERLAP_MM = 10;
/** The pattern document is read, not measured, so it gets a roomier text margin. */
export const PATTERN_MARGIN_MM = 14;
/** Room a full-page diagram or chart must leave for its piece heading. */
export const DIAGRAM_HEAD_MM = 16;
/**
 * Held back from the printable area so a tile is always strictly smaller than the
 * page. A tile exactly equal to the printable area can still tip a "shrink to fit"
 * heuristic into acting; a couple of millimetres of slack costs nothing and keeps
 * every dialogue setting landing on 1:1.
 */
export const SAFETY_MM = 2;
/**
 * Height reserved on every tile for its heading (which piece, which sheet, what size).
 * It has to be budgeted HERE, not just styled: the heading sits above the window onto
 * the drawing, so a tile window sized to the whole printable area plus a heading is
 * taller than the page and spills onto a second sheet. Fixed for every tile so all
 * sheets cut the same amount of drawing — anything variable and the tiles stop lining
 * up. The CSS clips to this height; keep the heading to two short lines.
 */
export const HEAD_MM = 12;

export interface Tile {
  row: number;
  col: number;
  /** Offset INTO the drawing, in px — the tile shows the region starting here. */
  offsetXPx: number;
  offsetYPx: number;
}

export interface TilePlan {
  tiles: Tile[];
  rows: number;
  cols: number;
  /** The visible window of one tile. */
  tileWidthPx: number;
  tileHeightPx: number;
  tileWidthMm: number;
  tileHeightMm: number;
  paper: Paper;
  landscape: boolean;
  /** True when the drawing fits one sheet and no tiling is needed. */
  single: boolean;
}

/**
 * Lay a drawing of `wPx` × `hPx` out over sheets of `paper`.
 *
 * Tiles step by (tile − overlap) so each carries a duplicated strip of its
 * neighbour to tape along. The last row/column may overhang the drawing; that is
 * fine — it just prints white.
 */
export function planTiles(
  wPx: number,
  hPx: number,
  paper: Paper,
  landscape = false,
): TilePlan {
  const pageW = landscape ? paper.heightMm : paper.widthMm;
  const pageH = landscape ? paper.widthMm : paper.heightMm;
  const tileWidthMm = pageW - 2 * MARGIN_MM - SAFETY_MM;
  const tileHeightMm = pageH - 2 * MARGIN_MM - SAFETY_MM - HEAD_MM;
  const tileWidthPx = mmToPx(tileWidthMm);
  const tileHeightPx = mmToPx(tileHeightMm);

  const single = wPx <= tileWidthPx && hPx <= tileHeightPx;
  if (single) {
    return {
      tiles: [{ row: 0, col: 0, offsetXPx: 0, offsetYPx: 0 }],
      rows: 1, cols: 1,
      tileWidthPx, tileHeightPx, tileWidthMm, tileHeightMm,
      paper, landscape, single: true,
    };
  }

  const overlapPx = mmToPx(OVERLAP_MM);
  const stepX = tileWidthPx - overlapPx;
  const stepY = tileHeightPx - overlapPx;
  const cols = Math.max(1, Math.ceil((wPx - overlapPx) / stepX));
  const rows = Math.max(1, Math.ceil((hPx - overlapPx) / stepY));

  const tiles: Tile[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      tiles.push({ row: r, col: c, offsetXPx: c * stepX, offsetYPx: r * stepY });
    }
  }
  return {
    tiles, rows, cols,
    tileWidthPx, tileHeightPx, tileWidthMm, tileHeightMm,
    paper, landscape, single: false,
  };
}

/**
 * Scales a drawing can be rendered at. Neat fractions only: the calibration line is
 * labelled "10 cm at 1/N scale", so an arbitrary 0.287 would print an honest line
 * under a dishonest label. A little white space beats a wrong number.
 */
export const NICE_FACTORS = [1, 1 / 2, 1 / 3, 1 / 4, 1 / 5, 1 / 6, 1 / 8, 1 / 10];

/**
 * The largest neat scale at which a drawing fits `maxWPx` × `maxHPx`.
 *
 * Why fit by re-rendering instead of letting CSS shrink the SVG: `scaleFactor` scales
 * the DRAWING (the cells), while the labels and the padding around them are fixed px.
 * So rendering smaller makes the text relatively BIGGER, whereas CSS scaling shrinks
 * everything together — which is how a full-size back ended up on the page at 0.34
 * with its labels at 2.8pt, unreadable. Render at the size it will print.
 *
 * Takes the metrics at factor 1 and solves per axis: only the cell area scales, the
 * padding is constant, so W(f) = (W₁ − 2·padX)·f + 2·padX.
 */
export function fitScaleFactor(
  m: { W: number; H: number; pad: number; padX: number; topExtra: number },
  maxWPx: number,
  maxHPx: number,
): number {
  const drawW = m.W - 2 * m.padX;
  const drawH = m.H - 2 * m.pad - m.topExtra;
  const roomW = maxWPx - 2 * m.padX;
  const roomH = maxHPx - 2 * m.pad - m.topExtra;
  // No room even for the margins — take the smallest scale and let CSS cope.
  if (roomW <= 0 || roomH <= 0) return NICE_FACTORS[NICE_FACTORS.length - 1];
  const limit = Math.min(drawW > 0 ? roomW / drawW : Infinity, drawH > 0 ? roomH / drawH : Infinity);
  return NICE_FACTORS.find((f) => f <= limit) ?? NICE_FACTORS[NICE_FACTORS.length - 1];
}

export interface BandPlan {
  bands: number;
  /** The drawing scaled to the page width. */
  widthMm: number;
  heightMm: number;
  /** Visible height of one band, and how far each band advances. */
  bandHeightMm: number;
  stepMm: number;
}

/**
 * Split a drawing into full-width horizontal bands, one per sheet.
 *
 * The counterpart to planTiles, for drawings that MAY be scaled but are too tall once
 * scaled to the page width — knit charts in landscape. Two reasons it is bands and not
 * tiles: a chart is read row by row, so a horizontal strip is a natural unit; and
 * cutting only one way means no sheet is ever a corner sliver with four dots of ink on
 * it, which is what 2-D tiling a mostly-plain chart produced.
 *
 * Bands overlap by OVERLAP_MM so the join can be taped with a repeated row visible.
 */
export function planBands(
  naturalWMm: number,
  naturalHMm: number,
  pageWMm: number,
  pageHMm: number,
): BandPlan {
  const scale = naturalWMm > pageWMm ? pageWMm / naturalWMm : 1;
  const widthMm = naturalWMm * scale;
  const heightMm = naturalHMm * scale;
  if (heightMm <= pageHMm) {
    return { bands: 1, widthMm, heightMm, bandHeightMm: heightMm, stepMm: heightMm };
  }
  const stepMm = pageHMm - OVERLAP_MM;
  return {
    bands: Math.max(1, Math.ceil((heightMm - OVERLAP_MM) / stepMm)),
    widthMm, heightMm, bandHeightMm: pageHMm, stepMm,
  };
}

/** "3 sheets (3 × 1)" — what the knitter is about to feed the printer. */
export function describePlan(plan: TilePlan): string {
  const n = plan.tiles.length;
  if (plan.single) return 'one sheet';
  return `${n} sheet${n === 1 ? '' : 's'} (${plan.cols} across × ${plan.rows} down)`;
}
