/**
 * The sleeve (set-in, bottom-up: cuff → rib → taper → cap). Both sleeves are
 * identical for a plain garment, so `sleeveRows` takes the piece id.
 *
 * The taper increases evenly from the cuff to the sleeve top. The cap casts off the
 * underarm to match the body, then a bell-shaped decrease (fast every-row zones at
 * the bottom and top, magic-formula even middle) up to a crown of ≈ (upper arm ÷ 4
 * − 0.5 cm). The cap *height* is not a fixed rule — it is solved so the cap
 * perimeter eases a small amount over the armhole opening it sews into (CAP_EASE),
 * which keeps the sleeve knittable across every body shape (see sleevePlan).
 */

import type { SizeRecord, EaseStyleId } from '../data/types';
import { garmentWidths } from '../dimensions';
import { type Gauge, stitchesFor, evenStitchesFor, rowsFor, ribRowsFor } from '../gauge';
import { type Row, type Piece, carriageForRow } from '../row';
import { backPlan, armholeShaping, armholeOpening } from './back';

/** Cuff = wrist + this ease. ASSUMPTION (flag) — a ribbed cuff also stretches. */
export const CUFF_EASE_IN = 1.0;

/** `count` increase rows spread as evenly as possible across `span` rows (interior). */
export function evenRows(count: number, span: number): number[] {
  const out: number[] = [];
  for (let i = 1; i <= count; i++) out.push(Math.round((i * span) / (count + 1)));
  return out;
}

/**
 * Target cap ease: the cap perimeter is designed to run this fraction longer than
 * the armhole opening it sews into — a small positive ease that lets the sleeve
 * head sit without puckering. This replaces the old "armhole depth − 7.5 cm" rule,
 * a fixed length that did not scale: it left babies' caps far too short (7.5 cm is
 * most of an infant armhole) and, combined with the broad-backed male block, men's
 * caps too long. Designing to the armhole makes cap height a result, not an input.
 */
const CAP_EASE = 0.05;
/** Decreases worked every row at each end of the cap (the fast bell ends). */
const CAP_FAST_EACH_END = 3;

export interface SleevePlan {
  ribCastOnSts: number; // cuff rib, cast on odd (bodyCuffSts + 1, extra on the right)
  bodyCuffSts: number; // even count after the rib drops one on the right
  ribRows: number;
  taperRows: number;
  incPerSide: number;
  sleeveTopSts: number; // achieved at the underarm
  underarmCastOff: number; // matches the body armhole
  capHeightRows: number; // ≈ armhole depth − 7.5 cm
  capDecPerSide: number;
  capTopSts: number; // bound off at the top (the crown)
}

export function sleevePlan(size: SizeRecord, style: EaseStyleId, gauge: Gauge): SleevePlan {
  const w = garmentWidths(size, style);
  const body = backPlan(size, style, gauge);

  const bodyCuffSts = evenStitchesFor(size.wrist + CUFF_EASE_IN, gauge); // even
  const ribCastOnSts = bodyCuffSts + 1; // rib cast on odd, extra on the right
  const ribRows = ribRowsFor(size.rib_body, gauge);
  // Sleeve length = arm length + the sourced length ease (ease_arml), less the rib.
  const taperRows = rowsFor(size.arm_length + size.ease_arml, gauge) - ribRows;
  const incPerSide = Math.round((stitchesFor(w.sleeveTop, gauge) - bodyCuffSts) / 2);
  const sleeveTopSts = bodyCuffSts + 2 * incPerSide; // even

  const underarmCastOff = armholeShaping(body.bodySts, body.upperBackSts, gauge).castOffPerSide;
  // Crown cast-off ≈ upper arm ÷ 4 − 0.5 cm; the cap width (and so the per-side
  // decrease count) is fixed by the arm — only the height is free to shape.
  const capTopTarget = stitchesFor(w.sleeveTop / 4 - 0.5 / 2.54, gauge);
  const capDecPerSide = Math.round((sleeveTopSts - 2 * underarmCastOff - capTopTarget) / 2);
  // The crown is whatever is left after the symmetric shaping — even, by construction.
  const capTopSts = sleeveTopSts - 2 * underarmCastOff - 2 * capDecPerSide;

  // Design the cap TO the armhole: choose the height so the cap perimeter eases
  // CAP_EASE over the armhole opening it sews into. `sleeveRows` builds each side
  // edge as `capDecPerSide` single decreases (diagonal steps) plus the remaining
  // plain rows (vertical), so per-side length = capDecPerSide·diag + (H − 3 −
  // capDecPerSide)·rh and perimeter = 2·side + crown. Invert that for H. (Holds for
  // capDecPerSide ≥ 6, i.e. every garment size; below that the fast zones overlap.)
  const sw = 4 / gauge.bodySt; // inches per stitch
  const rh = 4 / gauge.bodyRow; // inches per row
  const diag = Math.hypot(sw, rh);
  const crownLen = capTopSts * sw;
  const targetPerimeter = armholeOpening(size, style, gauge) * (1 + CAP_EASE);
  const idealHeight = 3 + capDecPerSide + (targetPerimeter - crownLen - 2 * capDecPerSide * diag) / (2 * rh);
  const minHeight = 3 + capDecPerSide; // all decreases, no plain rows — the flattest cap
  const maxHeight = rowsFor(w.armholeDepth, gauge); // never taller than the armhole
  const capHeightRows = Math.round(Math.min(maxHeight, Math.max(minHeight, idealHeight)));

  return {
    ribCastOnSts,
    bodyCuffSts,
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

  // Cuff cast-on (odd rib) + rib.
  push([{ kind: 'cast_on', count: p.ribCastOnSts }], 'rib');
  for (let i = 2; i <= p.ribRows; i++) push([], 'rib');

  // Taper: at the change to stocking, drop the rib's extra stitch on the right to
  // reach the even cuff count; then increase 1 st each end on evenly spread rows.
  const incAt = new Set(evenRows(p.incPerSide, p.taperRows));
  for (let t = 1; t <= p.taperRows; t++) {
    if (t === 1) push([{ kind: 'decrease', count: 1, side: 'R' }], 'taper');
    else push(incAt.has(t) ? [{ kind: 'increase', count: 1, side: 'both' }] : [], 'taper');
  }

  // Cap: cast off the underarm (matching the body), then a bell-shaped decrease
  // over the solved cap height — fast (every-row) zones at the bottom and top, and
  // a magic-formula even spread through the gentle middle to fill the height.
  // Finally cast off the crown.
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
