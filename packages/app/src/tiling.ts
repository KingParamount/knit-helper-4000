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

/** "3 sheets (3 × 1)" — what the knitter is about to feed the printer. */
export function describePlan(plan: TilePlan): string {
  const n = plan.tiles.length;
  if (plan.single) return 'one sheet';
  return `${n} sheet${n === 1 ? '' : 's'} (${plan.cols} across × ${plan.rows} down)`;
}
