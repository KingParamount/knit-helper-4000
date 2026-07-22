/**
 * The front piece. Shared with the back from cast-on through the armhole; then the
 * neck, in one of two styles:
 *   - 'round' (crew): a shallow scoop near the top — cast off the centre, curve each
 *     side down, then short-row the shoulders.
 *   - 'v': the split happens low (the V point sits ~VNECK_POINT_ABOVE_UNDERARM_IN
 *     above the underarm) with no centre cast-off; each side decreases steadily up to
 *     the shoulder, forming the long V.
 * Both halves must end at the back's shoulder count, to graft.
 */

import type { SizeRecord, EaseStyleId, NeckStyle, ShoulderStyle } from '../data/types';
import { type Gauge, rowsFor, stitchesFor } from '../gauge';
import { type Row, carriageForRow } from '../row';
import { backPlan, panelThroughArmhole, armholeShaping, splitIntoSteps, SHOULDER_STEP_STS } from './back';
import { vNeckDepthIn, NECK_CURVE_IN } from '../neckopening';

/** Rows the crew neck occupies below the shoulder line. */
export function frontNeckDepthRows(size: SizeRecord, gauge: Gauge): number {
  return rowsFor(size.neck_depth, gauge);
}

/** `count` events spread as evenly as possible across `span` rows. */
function evenlySpread(count: number, span: number): number[] {
  const out: number[] = [];
  for (let i = 1; i <= count; i++) out.push(Math.round((i * span) / (count + 1)));
  return out;
}

export interface FrontNeckPlan {
  neckLineRow: number; // last full-width row before the neck splits
  neckDepthRows: number; // rows from the split to the shoulder line
  bodySts: number; // live stitches at the neck line
  frontNeckSts: number; // total removed for the neck (centre + the two edges)
  shoulderSts: number; // each shoulder — must equal the back shoulder to graft
}

export function frontNeckPlan(
  size: SizeRecord,
  style: EaseStyleId,
  gauge: Gauge,
  neck: NeckStyle = 'round',
  shoulder: ShoulderStyle = 'set_in',
): FrontNeckPlan {
  const plan = backPlan(size, style, gauge, shoulder);
  const bodySts = armholeShaping(plan.bodySts, plan.upperBackSts).achievedSts;
  const shoulderSts = Math.round((bodySts - plan.backNeckSts) / 2); // match the back
  // A V's depth is ~a fraction of the armhole, floored to read as a V and capped for
  // modesty on adults (vNeckDepthIn); a crew is a shallow scoop.
  const armholeDepthIn = plan.armholeRows * (4 / gauge.bodyRow);
  const neckDepthRows =
    neck === 'v' ? rowsFor(vNeckDepthIn(armholeDepthIn, size), gauge) : frontNeckDepthRows(size, gauge);
  return {
    neckLineRow: plan.totalRows - neckDepthRows,
    neckDepthRows,
    bodySts,
    frontNeckSts: bodySts - 2 * shoulderSts,
    shoulderSts,
  };
}

/** The front from cast-on up to the neck line (before the neck splits). */
export function frontToNeck(
  size: SizeRecord,
  style: EaseStyleId,
  gauge: Gauge,
  neck: NeckStyle = 'round',
  shoulder: ShoulderStyle = 'set_in',
): Row[] {
  const rows = panelThroughArmhole('front', size, style, gauge, shoulder);
  const { neckLineRow } = frontNeckPlan(size, style, gauge, neck, shoulder);
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
 * The complete front piece, for the chosen neck style. Shared to the neck line, then
 * split into a left and right half worked separately up to their shoulders (which
 * short-row to match the back). Rows after the split carry `side`, and `stitches`
 * counts the half being worked (the row counter resets at the split and per side).
 */
export function frontRows(
  size: SizeRecord,
  style: EaseStyleId,
  gauge: Gauge,
  neck: NeckStyle = 'round',
  shoulder: ShoulderStyle = 'set_in',
): Row[] {
  const rows = frontToNeck(size, style, gauge, neck, shoulder);
  const fp = frontNeckPlan(size, style, gauge, neck, shoulder);
  const shoulderSteps = splitIntoSteps(fp.shoulderSts, SHOULDER_STEP_STS);
  const perSide = stitchesFor(NECK_CURVE_IN, gauge); // crew: ~1.5" curve each neck edge
  // Crew removes a centre chunk; a V divides at a single point (no centre cast-off).
  const centreCastOff = neck === 'v' ? 0 : fp.frontNeckSts - 2 * perSide;

  let index = rows.length;

  // Split row: crew casts off the centre; V just divides.
  index += 1;
  rows.push({
    index,
    piece: 'front',
    stitches: fp.bodySts - centreCastOff, // both halves still live
    carriage: carriageForRow(index),
    ops: neck === 'v' ? [] : [{ kind: 'bind_off', count: centreCastOff, side: 'center' }],
    section: 'neck_split',
  });

  const workHalf = (side: 'left' | 'right'): void => {
    const neckEdge: 'L' | 'R' = side === 'left' ? 'R' : 'L'; // centre-facing edge
    const armEdge: 'L' | 'R' = side === 'left' ? 'L' : 'R';
    let sts = neck === 'v' ? Math.floor((fp.bodySts - centreCastOff) / 2) : fp.shoulderSts + perSide;
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

    if (neck === 'v') {
      // Steady neck-edge decreases from the half width down to the shoulder, spread
      // over the deep V (leaving room for the shoulder short-rows at the top).
      const decsNeeded = sts - fp.shoulderSts;
      const shaperRows = Math.max(decsNeeded, fp.neckDepthRows - 2 * shoulderSteps.length);
      const decAt = new Set(evenlySpread(decsNeeded, shaperRows));
      for (let r = 1; r <= shaperRows; r++) {
        push(decAt.has(r) ? [{ kind: 'decrease', count: 1, side: neckEdge }] : [], 'neck');
      }
    } else {
      // Crew: cast-offs, then decreases every other row, then straight to the shoulder.
      const shaping = frontNeckShaping(perSide);
      for (const co of shaping.castOffs) {
        push([{ kind: 'bind_off', count: co, side: neckEdge }], 'neck');
        push([], 'neck'); // return row
      }
      for (let d = 0; d < shaping.decs; d++) {
        push([{ kind: 'decrease', count: 1, side: neckEdge }], 'neck');
        if (d < shaping.decs - 1) push([], 'neck');
      }
      const straight = Math.max(0, fp.neckDepthRows - used - 2 * shoulderSteps.length);
      for (let i = 0; i < straight; i++) push([], 'upper_front');
    }

    // Short-row the shoulder — held only on a row whose carriage ends at this half's
    // armhole edge, so it does not hole (machine-holding-hole rule). Matches the back.
    for (const s of shoulderSteps) {
      if (carriageForRow(index + 1) !== armEdge) push([], 'shoulder'); // wait for the safe row
      push([{ kind: 'hold', count: s, side: armEdge }], 'shoulder');
    }
  };

  workHalf('left');
  workHalf('right');
  return rows;
}
