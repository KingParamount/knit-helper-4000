/**
 * The hem — one plan shared by the body panels and the sleeve cuffs, since the hem
 * vocabulary applies one choice to both.
 *
 * Depth rules follow the recovered source's defaults, which match ordinary practice:
 * ribbing takes the size's own rib depth; a moss or garter band takes HALF that (a
 * flat band reads heavier than rib, so it runs shallower); a folded band is knit to
 * TWICE its finished depth (the facing folds inside); a frill is short — half the
 * rib depth — and starts with two garter rows so its free edge does not curl.
 *
 * Width rules likewise: rib pulls in, so it alone casts on the odd extra stitch
 * (dropped at the change — see gauge.ts on parity); every other hem is worked flat
 * at the full panel width. A frill casts on DOUBLE and halves across into the body.
 */

import type { SizeRecord, HemStyle } from '../data/types';
import { type Gauge, ribRowsFor } from '../gauge';
import type { Row } from '../row';

export interface HemPlan {
  hem: HemStyle;
  /** Stitches cast on: panel+1 for rib (odd), 2×panel for a frill, panel otherwise. */
  castOnSts: number;
  /** Rows the hem occupies in the knitted piece (a folded band includes its facing). */
  pieceRows: number;
  /**
   * Rows the hem contributes to the garment's hanging length. Equal to pieceRows for
   * every hem except the folded band, whose facing turns up inside and adds nothing.
   */
  lengthRows: number;
  /** Ops on the first body row after the hem (the rib drop, or the frill gather). */
  firstBodyOps: Row['ops'];
  /** Section name for hem row `index` (1-based within the hem). */
  sectionAt(index: number): string;
  /** Ops on hem row `index` (beyond the row-1 cast-on, which the caller emits). */
  opsAt(index: number): Row['ops'];
}

const NO_OPS: Row['ops'] = [];

export function hemPlan(size: SizeRecord, gauge: Gauge, hem: HemStyle, panelSts: number): HemPlan {
  switch (hem) {
    case 'ribbing': {
      const rows = ribRowsFor(size.rib_body, gauge);
      return {
        hem,
        castOnSts: panelSts + 1, // odd, extra stitch on the right
        pieceRows: rows,
        lengthRows: rows,
        firstBodyOps: [{ kind: 'decrease', count: 1, side: 'R' }],
        sectionAt: () => 'rib',
        opsAt: () => NO_OPS,
      };
    }
    case 'moss_band':
    case 'garter_band': {
      const rows = Math.max(2, ribRowsFor(size.rib_body / 2, gauge));
      return {
        hem,
        castOnSts: panelSts,
        pieceRows: rows,
        lengthRows: rows,
        firstBodyOps: NO_OPS,
        sectionAt: () => hem,
        opsAt: () => NO_OPS,
      };
    }
    case 'folded_band': {
      // Facing (inside) and outer half are the same depth; the fold row is the first
      // row of the outer half; the last row picks the cast-on edge up and knits it
      // together with the working stitches, closing the hem.
      const depth = Math.max(2, ribRowsFor(size.rib_body, gauge));
      const pieceRows = 2 * depth;
      return {
        hem,
        castOnSts: panelSts,
        pieceRows,
        lengthRows: depth,
        firstBodyOps: NO_OPS,
        sectionAt: (i) =>
          i <= depth ? 'folded_facing' : i === depth + 1 ? 'folded_turn' : i === pieceRows ? 'folded_join' : 'folded_outer',
        opsAt: (i) => (i === pieceRows ? [{ kind: 'pick_up', count: panelSts }] : NO_OPS),
      };
    }
    case 'frill': {
      const rows = Math.max(4, ribRowsFor(size.rib_body / 2, gauge));
      return {
        hem,
        castOnSts: 2 * panelSts,
        pieceRows: rows,
        lengthRows: rows,
        // The gather: knit two together all the way across, back to the panel width.
        firstBodyOps: [{ kind: 'decrease', count: panelSts, side: 'across' }],
        sectionAt: () => 'frill',
        opsAt: () => NO_OPS,
      };
    }
    case 'none':
      return {
        hem,
        castOnSts: panelSts,
        pieceRows: 0,
        lengthRows: 0,
        firstBodyOps: NO_OPS,
        sectionAt: () => 'body',
        opsAt: () => NO_OPS,
      };
  }
}

/** Every section name a hem can emit (the prose and schematic treat these as the band). */
export const HEM_SECTIONS: ReadonlySet<string> = new Set([
  'rib',
  'moss_band',
  'garter_band',
  'frill',
  'folded_facing',
  'folded_turn',
  'folded_outer',
  'folded_join',
]);

/** Hem sections whose LAST row borders the body (where the machine counter resets). */
export const HEM_END_SECTIONS: ReadonlySet<string> = new Set([
  'rib',
  'moss_band',
  'garter_band',
  'frill',
  'folded_join',
]);
