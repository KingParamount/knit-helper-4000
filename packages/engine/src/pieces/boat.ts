/**
 * The boat (butted) neck — a whole-garment construction, not a front/back neck shape.
 *
 * A boat has no neck shaping and no shoulder shaping: the front and the back are worked
 * as TWO IDENTICAL straight-topped pieces. Each is the ordinary body + armhole up to the
 * across-back width, then straight to the top, finished with an integral rib band worked
 * on all the upper stitches and cast off. The neck opening is made in the making up: the
 * shoulders are BUTTED (straight cast-off edge to straight cast-off edge) and seamed only
 * a little way in from each armhole, leaving the wide centre open for the head.
 *
 * So a boat needs no separate neckband (the band is part of each piece), and — because
 * the top is a straight edge with no cap-strap or raglan line to meet — it is a set-in or
 * drop shoulder only (saddle and raglan are blocked). Selecting a boat front forces the
 * back to a boat too; they are the same piece. Numbers from the 2026-07-24 harvest:
 * the neck opening runs ~0.69 of the upper-body width across every size, i.e. each
 * shoulder is seamed ~0.155 of the width in from the armhole. The band depth matches the
 * body's own ribbing (rib_body): Woman 36 2.5", Woman 50 3.0", Child 24 1.75" — dead on KW.
 */

import type { SizeRecord, EaseStyleId, ShoulderStyle, GarmentOptions } from '../data/types';
import { type Gauge, ribRowsFor } from '../gauge';
import { type Row, type Piece, carriageForRow } from '../row';
import { backPlan, panelThroughArmhole, armholeShaping } from './back';

/** Neck opening ÷ upper-body width — the wide centre left unseamed (harvest 0.68–0.69). */
export const BOAT_OPENING_FRACTION = 0.69;
/** Each shoulder seam ÷ upper-body width — how far in from each armhole the butt-seam runs. */
export const BOAT_SHOULDER_SEAM_FRACTION = 0.155;

export interface BoatPlan {
  upperSts: number; // achieved upper-body width = the band width (front and back alike)
  bandRows: number; // integral rib band depth (matches the body hem, rib_body)
  shoulderSeamSts: number; // each butted shoulder seam, in from the armhole
  openingSts: number; // the wide centre left open for the neck
  bandStartRow: number; // piece row where the integral band begins
  pieceTotalRows: number; // top of the band (≈ the crew shoulder line)
}

export function boatPlan(
  size: SizeRecord,
  style: EaseStyleId,
  gauge: Gauge,
  shoulder: ShoulderStyle = 'set_in',
  opts: GarmentOptions = {},
): BoatPlan {
  const plan = backPlan(size, style, gauge, shoulder, 'flat', opts);
  const upperSts = armholeShaping(plan.bodySts, plan.upperBackSts).achievedSts;
  const bandRows = ribRowsFor(size.rib_body, gauge);
  // Seam each shoulder ~0.155 of the width in from the armhole; the rest is the opening.
  const shoulderSeamSts = Math.round(BOAT_SHOULDER_SEAM_FRACTION * upperSts);
  const openingSts = upperSts - 2 * shoulderSeamSts;
  const pieceTotalRows = plan.pieceTotalRows;
  return {
    upperSts,
    bandRows,
    shoulderSeamSts,
    openingSts,
    bandStartRow: pieceTotalRows - bandRows,
    pieceTotalRows,
  };
}

/**
 * One boat piece — the front and back are identical, so this builds either. Body and
 * armhole from the shared panel, then straight to the band, then the integral rib band
 * worked on every stitch and cast off. No neck split, no shoulder shaping.
 */
export function boatPieceRows(
  piece: Piece,
  size: SizeRecord,
  style: EaseStyleId,
  gauge: Gauge,
  shoulder: ShoulderStyle = 'set_in',
  opts: GarmentOptions = {},
): Row[] {
  const rows = panelThroughArmhole(piece, size, style, gauge, shoulder, opts);
  const bp = boatPlan(size, style, gauge, shoulder, opts);
  let index = rows.length;
  const sts = rows[rows.length - 1].stitches; // the achieved upper width

  // Straight to the band start (the shoulder line, less the band depth).
  while (index < bp.bandStartRow) {
    index += 1;
    rows.push({ index, piece, stitches: sts, carriage: carriageForRow(index), ops: [], section: 'upper' });
  }
  // The integral rib band, worked on every upper stitch.
  for (let i = 0; i < bp.bandRows; i++) {
    index += 1;
    rows.push({ index, piece, stitches: sts, carriage: carriageForRow(index), ops: [], section: 'boat_band' });
  }
  // Cast off the whole band (in rib). On a machine this is one operation across the bed.
  // Section 'castoff' renders as a plain "cast off all N loosely" (as the neckband does),
  // NOT the back-neck centre cast-off (which would wrongly add grafting/shoulder prose).
  index += 1;
  rows.push({
    index,
    piece,
    stitches: 0,
    carriage: carriageForRow(index),
    ops: [{ kind: 'bind_off', count: sts, side: 'center' }],
    section: 'castoff',
  });
  return rows;
}
