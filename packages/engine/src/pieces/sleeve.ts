/**
 * The sleeve (set-in, bottom-up: cuff → rib → taper → cap). Both sleeves are
 * identical for a plain garment, so `sleeveRows` takes the piece id.
 *
 * The taper increases evenly from the cuff to the sleeve top. The cap casts off the
 * underarm to match the body, then a bell-shaped decrease (fast every-row zones at
 * the bottom and top, magic-formula even middle) up to a narrow crown (≈ CROWN_FRACTION
 * of the sleeve top). The cap *height* fills the armhole it sews into: a set-in cap is
 * sewn to the armhole selvedge ROW-FOR-ROW, so it must be nearly as many rows tall as
 * the armhole is deep (CAP_FILL) — see sleevePlan.
 */

import type { SizeRecord, EaseStyleId, ShoulderStyle } from '../data/types';
import { garmentWidths } from '../dimensions';
import { type Gauge, evenStitchesFor, rowsFor, ribRowsFor } from '../gauge';
import { type Row, type Piece, carriageForRow } from '../row';
import { backPlan, armholeShaping } from './back';
import { SEAM_ALLOWANCE_STS } from './seams';

/** Cuff = wrist + this ease. ASSUMPTION (flag) — a ribbed cuff also stretches. */
export const CUFF_EASE_IN = 1.0;

/**
 * A saddle strap's width (inches), scaling gently with size — Knitware's "Shldr Band
 * Width" runs ~1.5" (baby) to ~3.0" (large adult). The strap is the flat band the sleeve
 * cap narrows to and then works straight across the shoulder to the neck.
 */
export function saddleStrapWidthIn(size: SizeRecord): number {
  return Math.min(3.0, Math.max(1.5, size.chest * 0.05 + 0.6));
}

/**
 * A saddle strap's length in rows. The strap runs along the shoulder seam it sews to, so
 * its length is the shoulder WIDTH expressed in rows (stitches × row/stitch gauge). Verified
 * against Knitware at 20×26 (Baby shoulder 11 → 14 rows, Child 19 → 24, Man ~29 → 36).
 */
export function saddleStrapRows(shoulderSts: number, gauge: Gauge): number {
  return Math.round((shoulderSts * gauge.bodyRow) / gauge.bodySt);
}

/** `count` increase rows spread as evenly as possible across `span` rows (interior). */
export function evenRows(count: number, span: number): number[] {
  const out: number[] = [];
  for (let i = 1; i <= count; i++) out.push(Math.round((i * span) / (count + 1)));
  return out;
}

/**
 * Cap fill: the cap height as a fraction of the armhole depth. A set-in cap is sewn
 * to the armhole selvedge ROW-FOR-ROW — each cap row-end to one armhole row-end — so
 * the two edges match by row COUNT, not by tape-length. (Tape-length is a trap: the
 * cap edge is a diagonal staircase whose tape runs far longer than its height, so a
 * short, flat cap can fake a tape-match to a tall vertical armhole. That is exactly
 * how the old "ease the perimeter +5%" rule produced caps only ~0.55× the armhole.)
 * Real men's set-in caps fill ~0.79–0.89 of the armhole depth (Berroco Anthony); we
 * fill this fraction, floored so the decreases fit and capped at the armhole depth.
 */
const CAP_FILL = 0.86;
/**
 * Crown width as a fraction of the sleeve top: the flat top the cap binds off. A set-in
 * cap keeps a broad flat crown that sits along the top of the armhole; too narrow a crown
 * and the sleeve pulls to a peak at the shoulder instead of lying flat. Calibrated to
 * Knitware's ground truth, whose crown is a steady ~0.28 of the sleeve top across the whole
 * size range (baby ~9 → large adult ~25 sts; 26–33% measured). This supersedes an earlier
 * 0.14 taken from one modern pattern (Berroco Anthony) that made adult caps spike to a
 * ~2" point. Floored at MIN_CROWN_IN so a small sleeve's cap does not taper to a spike.
 */
const CROWN_FRACTION = 0.28;
const MIN_CROWN_IN = 1.5;
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
  capHeightRows: number; // fills ≈ CAP_FILL of the armhole depth
  capDecPerSide: number;
  capTopSts: number; // bound off at the top (the crown; the strap base for a saddle)
  strapRows: number; // saddle only: rows worked straight across the shoulder (0 otherwise)
}

export function sleevePlan(
  size: SizeRecord,
  style: EaseStyleId,
  gauge: Gauge,
  shoulder: ShoulderStyle = 'set_in',
): SleevePlan {
  const w = garmentWidths(size, style, shoulder);
  const body = backPlan(size, style, gauge, shoulder);

  // One underarm seam, eating a stitch from each of the sleeve's two edges — cut it
  // wider at both cuff and top so the sewn tube measures what it should.
  const bodyCuffSts = evenStitchesFor(size.wrist + CUFF_EASE_IN, gauge) + 2 * SEAM_ALLOWANCE_STS; // even
  const ribCastOnSts = bodyCuffSts + 1; // rib cast on odd, extra on the right
  const ribRows = ribRowsFor(size.rib_body, gauge);
  // Sleeve length = arm length + the sourced length ease (ease_arml), less the rib.
  const taperRows = rowsFor(size.arm_length + size.ease_arml, gauge) - ribRows;
  // NB the allowance is deliberately NOT added at the top. The sleeve top is not a
  // free edge — it is sewn into the armhole, and the Tier-A join invariant requires
  // the two to match. Widening it breaks that join (it did: drop-shoulder Child sizes
  // failed, where two stitches is a large fraction of a small armhole). The underarm
  // seam eats fabric along the tube, so the cuff carries the allowance and the top
  // stays pinned to the armhole it has to fit.
  // Measure against the UNROUNDED target. stitchesFor() would round the sleeve top to a
  // whole stitch first, and halving that rounds again — two roundings compounding in the
  // same direction. A Baby 18" at 12 sts/4in wants 22.50 stitches: pre-rounding gives 23,
  // then (23 − 16)/2 = 3.5 rounds up to 4 increases and lands on 24 (8.00"), where the
  // exact target picks 3 and lands on 22 (7.33") — the nearer of the two counts an even
  // total can reach. Invisible at a fine gauge, where half a stitch is a rounding error;
  // a third of an inch on chunky yarn.
  const exactTopSts = (w.sleeveTop * gauge.bodySt) / 4;
  const incPerSide = Math.round((exactTopSts - bodyCuffSts) / 2);
  const sleeveTopSts = bodyCuffSts + 2 * incPerSide; // even

  // A drop sleeve has no cap: it tapers to the top and binds off straight. The whole
  // top width becomes the sewn edge (capTopSts), the cap-shaping fields are 0.
  if (shoulder === 'drop') {
    return {
      ribCastOnSts,
      bodyCuffSts,
      ribRows,
      taperRows,
      incPerSide,
      sleeveTopSts,
      underarmCastOff: 0,
      capHeightRows: 0,
      capDecPerSide: 0,
      capTopSts: sleeveTopSts,
      strapRows: 0,
    };
  }

  const underarmCastOff = armholeShaping(body.bodySts, body.upperBackSts).castOffPerSide;
  // A saddle narrows the cap to the STRAP width (not the usual broad crown) and then works
  // the strap straight across the shoulder; a set-in narrows to a broad flat crown that is
  // bound off. The strap length is the shoulder width in rows (it seams to that shoulder).
  const achieved = armholeShaping(body.bodySts, body.upperBackSts).achievedSts;
  const shoulderSts = Math.round((achieved - body.backNeckSts) / 2);
  const strapRows = shoulder === 'saddle' ? saddleStrapRows(shoulderSts, gauge) : 0;
  const capTopTarget =
    shoulder === 'saddle'
      ? evenStitchesFor(saddleStrapWidthIn(size), gauge)
      : evenStitchesFor(Math.max(w.sleeveTop * CROWN_FRACTION, MIN_CROWN_IN), gauge);
  const capDecPerSide = Math.round((sleeveTopSts - 2 * underarmCastOff - capTopTarget) / 2);
  // The crown/strap base is whatever is left after the symmetric shaping — even, by construction.
  const capTopSts = sleeveTopSts - 2 * underarmCastOff - 2 * capDecPerSide;

  // Cap height fills the armhole it sews into (row-for-row, not tape-length — see
  // CAP_FILL). Floored so every decrease still fits (the flattest cap works them all
  // every row); capped at the armhole depth, which a cap never exceeds.
  const idealHeight = Math.round(rowsFor(w.armholeDepth, gauge) * CAP_FILL);
  const minHeight = 2 + capDecPerSide; // all decreases, no plain rows — the flattest cap
  const maxHeight = rowsFor(w.armholeDepth, gauge); // never taller than the armhole
  const capHeightRows = Math.min(maxHeight, Math.max(minHeight, idealHeight));

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
    strapRows,
  };
}

/** A complete sleeve for the given piece id. */
export function sleeveRows(
  piece: Piece,
  size: SizeRecord,
  style: EaseStyleId,
  gauge: Gauge,
  shoulder: ShoulderStyle = 'set_in',
): Row[] {
  const p = sleevePlan(size, style, gauge, shoulder);
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
      // take_off leaves the stitches live on waste yarn — no count change.
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

  // Drop shoulder: no cap — the whole straight top comes off on waste yarn (it sews
  // to the armhole edge in making up, so it stays live, not cast off).
  if (shoulder === 'drop') {
    push([{ kind: 'take_off', count: p.sleeveTopSts }], 'cap');
    return rows;
  }

  // Cap: cast off the underarm (matching the body), then a bell-shaped decrease
  // over the solved cap height — fast (every-row) zones at the bottom and top, and
  // a magic-formula even spread through the gentle middle to fill the height.
  // Finally cast off the crown.
  push([{ kind: 'bind_off', count: p.underarmCastOff, side: carriageForRow(index + 1) }], 'cap');
  push([{ kind: 'bind_off', count: p.underarmCastOff, side: carriageForRow(index + 1) }], 'cap');

  // Half the decreases at most, so the two fast zones cannot overlap. Taking
  // CAP_FAST_EACH_END from each end works 2× that many, which is more than the plan
  // allows once capDecPerSide falls below 6 — and it does at a coarse gauge on a small
  // sleeve. The cap then over-decreased, leaving fewer live stitches than the crown
  // take-off claimed (a Baby 18" at 18 sts × 22.4 rows built 6 decreases against a plan
  // of 5, and took off 6 stitches with 4 on the needles).
  const fast = Math.min(CAP_FAST_EACH_END, Math.floor(p.capDecPerSide / 2));
  const middleDecs = Math.max(0, p.capDecPerSide - 2 * fast);
  const middleRows = Math.max(middleDecs, p.capHeightRows - 2 - 2 * fast - 1);
  for (let i = 0; i < fast; i++) push([{ kind: 'decrease', count: 1, side: 'both' }], 'cap'); // fast bottom
  const decAt = new Set(evenRows(middleDecs, middleRows));
  for (let r = 1; r <= middleRows; r++) {
    push(decAt.has(r) ? [{ kind: 'decrease', count: 1, side: 'both' }] : [], 'cap'); // gentle middle
  }
  for (let i = 0; i < fast; i++) push([{ kind: 'decrease', count: 1, side: 'both' }], 'cap'); // fast top

  // A saddle continues on the crown stitches as a flat strap across the shoulder, then
  // casts off (the strap seams to the front and back shoulders; its end joins the neck).
  // A set-in/drop cap takes its crown off on waste yarn.
  if (shoulder === 'saddle') {
    for (let i = 0; i < p.strapRows; i++) push([], 'saddle');
    push([{ kind: 'bind_off', count: p.capTopSts, side: carriageForRow(index + 1) }], 'saddle');
    return rows;
  }
  push([{ kind: 'take_off', count: p.capTopSts }], 'cap'); // crown off on waste yarn
  return rows;
}

/** Both sleeves (identical for a plain garment). */
export function sleeves(
  size: SizeRecord,
  style: EaseStyleId,
  gauge: Gauge,
  shoulder: ShoulderStyle = 'set_in',
): { left: Row[]; right: Row[] } {
  return {
    left: sleeveRows('sleeve_l', size, style, gauge, shoulder),
    right: sleeveRows('sleeve_r', size, style, gauge, shoulder),
  };
}
