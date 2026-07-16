/**
 * The sleeve (set-in, bottom-up: cuff → rib → taper → cap). Both sleeves are
 * identical for a plain garment, so `sleeveRows` takes the piece id.
 *
 * The taper increases evenly from the cuff to the sleeve top. The cap follows
 * standard set-in guidance (Craft Yarn Council / Sister Mountain): cast off the
 * underarm to match the body, a bell-shaped decrease (fast every-row zones at the
 * bottom and top, magic-formula even middle) over a height of ≈ armhole depth
 * − 7.5 cm, and a crown cast-off of ≈ (upper arm ÷ 4 − 0.5 cm).
 */

import type { SizeRecord, EaseStyleId } from '../data/types';
import { garmentWidths } from '../dimensions';
import { type Gauge, stitchesFor, rowsFor, ribRowsFor } from '../gauge';
import { type Row, type Piece, carriageForRow } from '../row';
import { backPlan, armholeShaping } from './back';

/** Cuff = wrist + this ease. ASSUMPTION (flag) — a ribbed cuff also stretches. */
export const CUFF_EASE_IN = 1.0;

/** `count` increase rows spread as evenly as possible across `span` rows (interior). */
export function evenRows(count: number, span: number): number[] {
  const out: number[] = [];
  for (let i = 1; i <= count; i++) out.push(Math.round((i * span) / (count + 1)));
  return out;
}

/** The cap is this much shorter than the armhole depth (7.5 cm), per Sister Mountain. */
const CAP_SHORTER_THAN_ARMHOLE_IN = 7.5 / 2.54;
/** Decreases worked every row at each end of the cap (the fast bell ends). */
const CAP_FAST_EACH_END = 3;

export interface SleevePlan {
  castOnSts: number; // cuff
  ribRows: number;
  taperRows: number;
  incPerSide: number;
  sleeveTopSts: number; // achieved at the underarm
  underarmCastOff: number; // matches the body armhole
  capHeightRows: number; // ≈ armhole depth − 7.5 cm
  capDecPerSide: number;
  capTopSts: number; // bound off at the top
}

export function sleevePlan(size: SizeRecord, style: EaseStyleId, gauge: Gauge): SleevePlan {
  const w = garmentWidths(size, style);
  const body = backPlan(size, style, gauge);

  const castOnSts = stitchesFor(size.wrist + CUFF_EASE_IN, gauge);
  const ribRows = ribRowsFor(size.rib_body, gauge);
  const taperRows = rowsFor(size.arm_length, gauge) - ribRows;
  const incPerSide = Math.round((stitchesFor(w.sleeveTop, gauge) - castOnSts) / 2);
  const sleeveTopSts = castOnSts + 2 * incPerSide;

  const underarmCastOff = armholeShaping(body.castOnSts, body.upperBackSts, gauge).castOffPerSide;
  // Cap height ≈ armhole depth − 7.5 cm; top cast-off ≈ (upper arm ÷ 4 − 0.5 cm).
  const capHeightRows = rowsFor(w.armholeDepth, gauge) - rowsFor(CAP_SHORTER_THAN_ARMHOLE_IN, gauge);
  const capTopSts = stitchesFor(w.sleeveTop / 4 - 0.5 / 2.54, gauge);
  const capDecPerSide = Math.round((sleeveTopSts - 2 * underarmCastOff - capTopSts) / 2);

  return {
    castOnSts,
    ribRows,
    taperRows,
    incPerSide,
    sleeveTopSts,
    underarmCastOff,
    capHeightRows,
    capDecPerSide,
    capTopSts,
  };
}

/** A complete sleeve for the given piece id. */
export function sleeveRows(
  piece: Piece,
  size: SizeRecord,
  style: EaseStyleId,
  gauge: Gauge,
): Row[] {
  const p = sleevePlan(size, style, gauge);
  const rows: Row[] = [];
  let index = 0;
  let stitches = 0;
  const push = (ops: Row['ops'], section: string): void => {
    index += 1;
    for (const op of ops) {
      if (op.kind === 'cast_on') stitches = op.count;
      if (op.kind === 'bind_off') stitches -= op.count;
      if (op.kind === 'increase') stitches += op.count * (op.side === 'both' ? 2 : 1);
      if (op.kind === 'decrease') stitches -= op.count * (op.side === 'both' ? 2 : 1);
    }
    rows.push({ index, piece, stitches, carriage: carriageForRow(index), ops, section });
  };

  // Cuff cast-on + rib.
  push([{ kind: 'cast_on', count: p.castOnSts }], 'rib');
  for (let i = 2; i <= p.ribRows; i++) push([], 'rib');

  // Taper: increase 1 st each end on evenly spread rows.
  const incAt = new Set(evenRows(p.incPerSide, p.taperRows));
  for (let t = 1; t <= p.taperRows; t++) {
    push(incAt.has(t) ? [{ kind: 'increase', count: 1, side: 'both' }] : [], 'taper');
  }

  // Cap: cast off the underarm (matching the body), then a bell-shaped decrease
  // over a height of ≈ armhole depth − 7.5 cm — fast (every-row) zones at the
  // bottom and top, and a magic-formula even spread through the gentle middle to
  // fill the height. Finally cast off the crown.
  push([{ kind: 'bind_off', count: p.underarmCastOff, side: carriageForRow(index + 1) }], 'cap');
  push([{ kind: 'bind_off', count: p.underarmCastOff, side: carriageForRow(index + 1) }], 'cap');

  const fast = Math.min(CAP_FAST_EACH_END, p.capDecPerSide);
  const middleDecs = Math.max(0, p.capDecPerSide - 2 * fast);
  const middleRows = Math.max(middleDecs, p.capHeightRows - 2 - 2 * fast - 1);
  for (let i = 0; i < fast; i++) push([{ kind: 'decrease', count: 1, side: 'both' }], 'cap'); // fast bottom
  const decAt = new Set(evenRows(middleDecs, middleRows));
  for (let r = 1; r <= middleRows; r++) {
    push(decAt.has(r) ? [{ kind: 'decrease', count: 1, side: 'both' }] : [], 'cap'); // gentle middle
  }
  for (let i = 0; i < fast; i++) push([{ kind: 'decrease', count: 1, side: 'both' }], 'cap'); // fast top
  push([{ kind: 'bind_off', count: p.capTopSts, side: 'center' }], 'cap'); // crown
  return rows;
}

/** Both sleeves (identical for a plain garment). */
export function sleeves(size: SizeRecord, style: EaseStyleId, gauge: Gauge): { left: Row[]; right: Row[] } {
  return {
    left: sleeveRows('sleeve_l', size, style, gauge),
    right: sleeveRows('sleeve_r', size, style, gauge),
  };
}
