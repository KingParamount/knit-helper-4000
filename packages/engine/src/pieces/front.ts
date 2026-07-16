/**
 * The front piece. Identical to the back from cast-on through the curved armhole
 * and straight up to the neck line; then it differs — a crew neck is a deep,
 * curved (scooped) neckline, and the piece splits into a left and right half that
 * are worked separately up to their shoulders (which must end at the same stitch
 * count as the back shoulders, to graft).
 *
 * This module currently builds the front up to the neck line. The neck curve and
 * the two-sided shoulders come next — the split is a genuine new structure (the
 * first time a piece divides), so its representation is being settled first.
 */

import type { SizeRecord, EaseStyleId } from '../data/types';
import { type Gauge, rowsFor } from '../gauge';
import { type Row, carriageForRow } from '../row';
import { backPlan, panelThroughArmhole, armholeShaping } from './back';

/** Rows the front neck occupies below the shoulder line (crew depth). */
export function frontNeckDepthRows(size: SizeRecord, gauge: Gauge): number {
  return rowsFor(size.neck_depth, gauge);
}

export interface FrontNeckPlan {
  neckLineRow: number; // last full-width row before the neck splits
  bodySts: number; // live stitches at the neck line
  frontNeckSts: number; // total removed for the neck (centre + the two edges)
  shoulderSts: number; // each shoulder — must equal the back shoulder to graft
}

export function frontNeckPlan(
  size: SizeRecord,
  style: EaseStyleId,
  gauge: Gauge,
): FrontNeckPlan {
  const plan = backPlan(size, style, gauge);
  const bodySts = armholeShaping(plan.castOnSts, plan.upperBackSts, gauge).achievedSts;
  const shoulderSts = Math.round((bodySts - plan.backNeckSts) / 2); // match the back
  return {
    neckLineRow: plan.totalRows - frontNeckDepthRows(size, gauge),
    bodySts,
    frontNeckSts: bodySts - 2 * shoulderSts,
    shoulderSts,
  };
}

/** The front from cast-on up to the neck line (before the neck splits). */
export function frontToNeck(size: SizeRecord, style: EaseStyleId, gauge: Gauge): Row[] {
  const rows = panelThroughArmhole('front', size, style, gauge);
  const { neckLineRow } = frontNeckPlan(size, style, gauge);
  let index = rows.length;
  let stitches = rows[rows.length - 1].stitches;
  while (index < neckLineRow) {
    index += 1;
    rows.push({
      index,
      piece: 'front',
      stitches,
      carriage: carriageForRow(index),
      ops: [],
      section: 'upper_front',
    });
  }
  return rows;
}
