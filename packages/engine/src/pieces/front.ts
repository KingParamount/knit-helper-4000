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
import { type Gauge, rowsFor, stitchesFor } from '../gauge';
import { type Row, carriageForRow } from '../row';
import { backPlan, panelThroughArmhole, armholeShaping, splitIntoSteps } from './back';

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
  const stitches = rows[rows.length - 1].stitches;
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

/** Crew-neck edge shaping for one side: a couple of cast-offs, then the rest decreased. */
export function frontNeckShaping(perSide: number): { castOffs: number[]; decs: number } {
  const co1 = Math.min(3, perSide);
  const co2 = Math.min(2, Math.max(0, perSide - co1));
  return { castOffs: [co1, co2].filter((n) => n > 0), decs: perSide - co1 - co2 };
}

/**
 * The complete front piece. Shared to the neck line, then a crew neck: cast off
 * the centre, and work each half (left then right) separately up to its shoulder.
 * Each half curves the neck edge (cast off ~1.5" worth, graduated) down to the
 * shoulder count, then short-row shoulders to match the back. Representation A:
 * one `front` piece, rows after the split carry `side`, and `stitches` counts the
 * half being worked (the machine's row counter resets at the split and per side).
 */
export function frontRows(size: SizeRecord, style: EaseStyleId, gauge: Gauge): Row[] {
  const rows = frontToNeck(size, style, gauge);
  const fp = frontNeckPlan(size, style, gauge);
  const perSide = stitchesFor(1.5, gauge); // ~1.5" curve each neck edge
  const centreCastOff = fp.frontNeckSts - 2 * perSide;
  const shaping = frontNeckShaping(perSide);
  const shoulderSteps = splitIntoSteps(fp.shoulderSts, 7);
  const heightRows = frontNeckDepthRows(size, gauge);

  let index = rows.length;

  // Split row: cast off the centre; the two halves are then worked separately.
  index += 1;
  rows.push({
    index,
    piece: 'front',
    stitches: fp.bodySts - centreCastOff, // both halves still live
    carriage: carriageForRow(index),
    ops: [{ kind: 'bind_off', count: centreCastOff, side: 'center' }],
    section: 'neck_split',
  });

  const workHalf = (side: 'left' | 'right'): void => {
    const neckEdge: 'L' | 'R' = side === 'left' ? 'R' : 'L'; // centre-facing edge
    const armEdge: 'L' | 'R' = side === 'left' ? 'L' : 'R';
    let sts = fp.shoulderSts + perSide;
    let used = 0;
    const push = (ops: Row['ops'], section: string): void => {
      index += 1;
      used += 1;
      for (const op of ops) {
        if (op.kind === 'bind_off') sts -= op.count;
        if (op.kind === 'decrease') sts -= op.count;
        // hold: still live, no change
      }
      rows.push({ index, piece: 'front', stitches: sts, carriage: carriageForRow(index), ops, section, side });
    };

    // Neck-edge curve: cast-offs, then decreases every other row.
    for (const co of shaping.castOffs) {
      push([{ kind: 'bind_off', count: co, side: neckEdge }], 'neck');
      push([], 'neck'); // return row
    }
    for (let d = 0; d < shaping.decs; d++) {
      push([{ kind: 'decrease', count: 1, side: neckEdge }], 'neck');
      if (d < shaping.decs - 1) push([], 'neck');
    }
    // Straight to the shoulder line, then short-row the shoulder. Hold each group
    // only on a row whose carriage ends at this half's armhole edge — that is the
    // side away from the carriage when the hold is set, so it does not make a hole
    // (see machine-holding-hole-rule). This can leave the two halves off by a row;
    // that is the accepted small discrepancy. Slope rate matches the back.
    const straight = Math.max(0, heightRows - used - 2 * shoulderSteps.length);
    for (let i = 0; i < straight; i++) push([], 'upper_front');
    for (const s of shoulderSteps) {
      if (carriageForRow(index + 1) !== armEdge) push([], 'shoulder'); // wait for the safe row
      push([{ kind: 'hold', count: s, side: armEdge }], 'shoulder');
    }
  };

  workHalf('left');
  workHalf('right');
  return rows;
}
