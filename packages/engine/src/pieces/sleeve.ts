/**
 * The sleeve (set-in, bottom-up: cuff → rib → taper → cap). Both sleeves are
 * identical for a plain garment, so `sleeveRows` takes the piece id.
 *
 * The taper increases evenly from the cuff to the sleeve top. The cap is a
 * FIRST CUT — a standard set-in cap (cast off the underarm to match the body,
 * then decrease every other row and cast off the top). Making the cap edge length
 * precisely match the armhole edge is a known refinement, flagged not hidden.
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

export interface SleevePlan {
  castOnSts: number; // cuff
  ribRows: number;
  taperRows: number;
  incPerSide: number;
  sleeveTopSts: number; // achieved at the underarm
  underarmCastOff: number; // matches the body armhole
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
  const afterUnderarm = sleeveTopSts - 2 * underarmCastOff;
  const capDecPerSide = Math.round((afterUnderarm - stitchesFor(4.0, gauge)) / 2);
  const capTopSts = afterUnderarm - 2 * capDecPerSide;

  return {
    castOnSts,
    ribRows,
    taperRows,
    incPerSide,
    sleeveTopSts,
    underarmCastOff,
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

  // Cap: cast off the underarm (one side per row, following the carriage), then
  // decrease each end every other row, then cast off the top.
  push([{ kind: 'bind_off', count: p.underarmCastOff, side: carriageForRow(index + 1) }], 'cap');
  push([{ kind: 'bind_off', count: p.underarmCastOff, side: carriageForRow(index + 1) }], 'cap');
  for (let d = 0; d < p.capDecPerSide; d++) {
    push([{ kind: 'decrease', count: 1, side: 'both' }], 'cap');
    if (d < p.capDecPerSide - 1) push([], 'cap');
  }
  push([{ kind: 'bind_off', count: p.capTopSts, side: 'center' }], 'cap');
  return rows;
}

/** Both sleeves (identical for a plain garment). */
export function sleeves(size: SizeRecord, style: EaseStyleId, gauge: Gauge): { left: Row[]; right: Row[] } {
  return {
    left: sleeveRows('sleeve_l', size, style, gauge),
    right: sleeveRows('sleeve_r', size, style, gauge),
  };
}
