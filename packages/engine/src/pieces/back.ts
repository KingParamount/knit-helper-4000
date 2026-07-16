/**
 * The back piece (set-in sleeve, straight body, bottom-up flat).
 *
 * `backPlan` lays out every section with row spans and stitch counts, including
 * the shaping *targets* (the counts shaping must hit). `lowerBackRows` generates
 * the actual Row[] for the unambiguous lower sections — cast-on, rib, body to the
 * underarm. Armhole / shoulder / back-neck shaping rows are not generated yet
 * (they need the sourced shaping method — see dimensions_model.md, next step).
 */

import type { SizeRecord, EaseStyleId } from '../data/types';
import { garmentWidths } from '../dimensions';
import {
  type Gauge,
  stitchesFor,
  evenStitchesFor,
  rowsFor,
  ribRowsFor,
} from '../gauge';
import { type Row, type Piece, carriageForRow } from '../row';
import { seamEdgeLength, ARMHOLE_SECTIONS } from './seams';

export interface PlanSection {
  name: string;
  startRow: number;
  endRow: number;
  rows: number;
  stitches: number;
  note?: string;
}

export interface BackPlan {
  ribCastOnSts: number; // rib is cast on odd (body + 1, extra on the right)
  bodySts: number; // even body panel = half the finished chest (after the rib drop)
  upperBackSts: number; // between the armholes
  backNeckSts: number;
  totalRows: number;
  ribRows: number;
  bodyRows: number; // plain body, top of rib to underarm
  armholeRows: number; // underarm to shoulder
  sections: PlanSection[];
  shaping: {
    armholeDecTotal: number; // castOn - upperBack, split across both sides
    shoulderStsEachApprox: number;
    note: string;
  };
}

/** Hip-length body length from the size table (L1: passthrough, no ease-style ease). */
function bodyLengthInches(size: SizeRecord): number {
  return size.neck_to_waist + size.waist_to_hip;
}

export function backPlan(
  size: SizeRecord,
  style: EaseStyleId,
  gauge: Gauge,
): BackPlan {
  const w = garmentWidths(size, style);

  const bodySts = evenStitchesFor(w.chest / 2, gauge); // even plain panel
  const ribCastOnSts = bodySts + 1; // rib cast on odd, extra stitch on the right
  const upperBackSts = stitchesFor(size.back_width, gauge);
  const backNeckSts = stitchesFor(size.back_neck, gauge);

  const totalRows = rowsFor(bodyLengthInches(size), gauge);
  const ribRows = ribRowsFor(size.rib_body, gauge);
  const armholeRows = rowsFor(w.armholeDepth, gauge);
  const bodyRows = totalRows - armholeRows - ribRows;

  const sections: PlanSection[] = [
    { name: 'rib', startRow: 1, endRow: ribRows, rows: ribRows, stitches: ribCastOnSts },
    {
      name: 'body',
      startRow: ribRows + 1,
      endRow: ribRows + bodyRows,
      rows: bodyRows,
      stitches: bodySts,
    },
    {
      name: 'armhole+shoulder',
      startRow: ribRows + bodyRows + 1,
      endRow: totalRows,
      rows: armholeRows,
      stitches: upperBackSts,
      note: 'shaping — not generated yet',
    },
  ];

  return {
    ribCastOnSts,
    bodySts,
    upperBackSts,
    backNeckSts,
    totalRows,
    ribRows,
    bodyRows,
    armholeRows,
    sections,
    shaping: {
      armholeDecTotal: bodySts - upperBackSts,
      shoulderStsEachApprox: Math.round((upperBackSts - backNeckSts) / 2),
      note: 'armhole narrows body->upperBack; top splits into two shoulders + back neck',
    },
  };
}

/**
 * Row[] for the lower body panel: cast-on, rib, and plain body to the underarm.
 * Shared by front and back (identical below the neck for a straight pullover).
 */
export function lowerPanelRows(
  piece: Piece,
  size: SizeRecord,
  style: EaseStyleId,
  gauge: Gauge,
): Row[] {
  const plan = backPlan(size, style, gauge);
  const lastPlainRow = plan.ribRows + plan.bodyRows; // underarm
  const firstBodyRow = plan.ribRows + 1;
  const rows: Row[] = [];
  for (let index = 1; index <= lastPlainRow; index++) {
    const inRib = index <= plan.ribRows;
    // The rib is cast on odd (bodySts + 1); at the change to stocking the extra
    // stitch is dropped on the right, so both rib selvedges are knit stitches.
    let ops: Row['ops'] = [];
    if (index === 1) ops = [{ kind: 'cast_on', count: plan.ribCastOnSts }];
    else if (index === firstBodyRow) ops = [{ kind: 'decrease', count: 1, side: 'R' }];
    rows.push({
      index,
      piece,
      stitches: inRib ? plan.ribCastOnSts : plan.bodySts,
      carriage: carriageForRow(index),
      ops,
      section: inRib ? 'rib' : 'body',
    });
  }
  return rows;
}

/** Lower back rows (thin wrapper over the shared panel). */
export function lowerBackRows(size: SizeRecord, style: EaseStyleId, gauge: Gauge): Row[] {
  return lowerPanelRows('back', size, style, gauge);
}

/** One phase of the graduated decrease: `times` single decreases, one every `everyRows` rows. */
export interface DecPhase {
  everyRows: number; // 1 = every row, 2 = every other row, 4 = every 4th row
  times: number;
}

export interface ArmholeShaping {
  castOffPerSide: number; // underarm cast-off, each side (single step — see machine-castoff note)
  phases: DecPhase[]; // graduated: steep at the underarm, easing toward the shoulder
  achievedSts: number; // stitches remaining after shaping
}

/**
 * Graduated set-in armhole shaping for a curved scye: cast off ~1" at the underarm
 * each side, then decrease one stitch each end at a rate that eases as it climbs —
 * fast at the bottom (every row), then every other row, then every 4th near the top.
 * A curved armhole cups the sleeve cap better than a straight taper. Standard
 * three-phase set-in construction (steep→gentle); the sleeve cap is generated to
 * match. Decreases are recorded technique-neutrally ("dec 1 st each end").
 */
export function armholeShaping(
  castOnSts: number,
  targetSts: number,
  gauge: Gauge,
): ArmholeShaping {
  const perSide = Math.round((castOnSts - targetSts) / 2);
  const castOffPerSide = Math.min(stitchesFor(1.0, gauge), perSide); // ~1" underarm
  const d = Math.max(0, perSide - castOffPerSide);
  const fast = Math.round(d * 0.3); // every row
  const gentle = Math.round(d * 0.2); // every 4th row
  const medium = d - fast - gentle; // every other row (the bulk)
  const phases: DecPhase[] = [
    { everyRows: 1, times: fast },
    { everyRows: 2, times: medium },
    { everyRows: 4, times: gentle },
  ].filter((p) => p.times > 0);
  return { castOffPerSide, phases, achievedSts: castOnSts - 2 * perSide };
}

/**
 * A body panel from cast-on through the armhole decreases (ends at the achieved
 * back width). Shared by front and back. Above this each piece differs: the back
 * goes straight to the shoulders + flat neck; the front adds the neck curve.
 */
export function panelThroughArmhole(
  piece: Piece,
  size: SizeRecord,
  style: EaseStyleId,
  gauge: Gauge,
): Row[] {
  const plan = backPlan(size, style, gauge);
  const rows = lowerPanelRows(piece, size, style, gauge);
  const shaping = armholeShaping(plan.bodySts, plan.upperBackSts, gauge);

  let index = rows.length; // last body row (underarm)
  let stitches = plan.bodySts;
  const push = (ops: Row['ops']): void => {
    index += 1;
    for (const op of ops) {
      if (op.kind === 'bind_off') stitches -= op.count;
      if (op.kind === 'decrease') stitches -= op.count * (op.side === 'both' ? 2 : 1);
    }
    rows.push({ index, piece, stitches, carriage: carriageForRow(index), ops, section: 'armhole' });
  };

  // Underarm cast-off, one side per row (a block cast-off follows the carriage).
  push([{ kind: 'bind_off', count: shaping.castOffPerSide, side: carriageForRow(index + 1) }]);
  push([{ kind: 'bind_off', count: shaping.castOffPerSide, side: carriageForRow(index + 1) }]);
  // Graduated single decreases each end: (everyRows-1) plain rows, then a decrease row.
  for (const phase of shaping.phases) {
    for (let t = 0; t < phase.times; t++) {
      for (let p = 0; p < phase.everyRows - 1; p++) push([]); // plain rows
      push([{ kind: 'decrease', count: 1, side: 'both' }]); // decrease row
    }
  }
  return rows;
}

/** The back through the armhole (thin wrapper over the shared panel). */
export function backThroughArmhole(size: SizeRecord, style: EaseStyleId, gauge: Gauge): Row[] {
  return panelThroughArmhole('back', size, style, gauge);
}

/**
 * Stitches per short-row shoulder step. ~5 gives a ~1" shoulder slope at the
 * target size (5 steps × 2 rows = 10 rows ≈ 1"), the standard set-in drop.
 */
export const SHOULDER_STEP_STS = 5;

/** Split `total` stitches into near-equal steps of roughly `target` each. */
export function splitIntoSteps(total: number, target: number): number[] {
  const steps = Math.max(1, Math.round(total / target));
  const base = Math.floor(total / steps);
  const extra = total - base * steps;
  return Array.from({ length: steps }, (_, i) => base + (i < extra ? 1 : 0));
}

/**
 * The complete back piece: cast-on → rib → body → curved armhole → straight to
 * the shoulder line → short-row shoulders → flat back-neck cast-off.
 *
 * Shoulders are shaped by holding needle groups (the user's choice): the outer
 * (armhole-edge) group is held first, working inward, so the shoulder slopes down
 * toward the armhole. Held stitches stay live for grafting, so the piece ends with
 * the two shoulders (≈half the non-neck stitches each) on hold; `stitches` counts
 * live stitches on the needles, so holds do not change it. The flat back neck is a
 * single centre cast-off.
 */
export function backRows(size: SizeRecord, style: EaseStyleId, gauge: Gauge): Row[] {
  const plan = backPlan(size, style, gauge);
  const rows = backThroughArmhole(size, style, gauge);
  const achieved = rows[rows.length - 1].stitches;
  const backNeck = plan.backNeckSts;
  const shoulderSts = Math.round((achieved - backNeck) / 2);
  const steps = splitIntoSteps(shoulderSts, SHOULDER_STEP_STS);

  let index = rows.length;
  let stitches = achieved;
  const push = (ops: Row['ops'], section: string): void => {
    index += 1;
    for (const op of ops) {
      if (op.kind === 'bind_off') stitches -= op.count;
      if (op.kind === 'decrease') stitches -= op.count * (op.side === 'both' ? 2 : 1);
      // hold: needles held but still live — no change to the stitch count
    }
    rows.push({ index, piece: 'back', stitches, carriage: carriageForRow(index), ops, section });
  };

  // Straight to the shoulder line (reserve rows for the shoulders + neck cast-off).
  const shoulderRows = 2 * steps.length;
  const straightRows = Math.max(0, plan.totalRows - rows.length - shoulderRows - 1);
  for (let i = 0; i < straightRows; i++) push([], 'upper_back');

  // Short-row shoulders: hold each group on one side, then the mirror group on the
  // other, working outer→inner. Held at whichever side the carriage is on.
  for (const s of steps) {
    push([{ kind: 'hold', count: s, side: carriageForRow(index + 1) as 'L' | 'R' }], 'shoulder');
    push([{ kind: 'hold', count: s, side: carriageForRow(index + 1) as 'L' | 'R' }], 'shoulder');
  }

  // Flat back neck: cast off the centre; the two shoulders stay held for grafting.
  push([{ kind: 'bind_off', count: backNeck, side: 'center' }], 'neck');
  return rows;
}

/** Length (inches) of one curved armhole edge, underarm to shoulder — what the cap sews to. */
export function armholeSeamLength(size: SizeRecord, style: EaseStyleId, gauge: Gauge): number {
  return seamEdgeLength(backRows(size, style, gauge), ARMHOLE_SECTIONS, gauge);
}

/** The armhole opening the sleeve eases into: back edge + front edge (identical shaping). */
export function armholeOpening(size: SizeRecord, style: EaseStyleId, gauge: Gauge): number {
  return 2 * armholeSeamLength(size, style, gauge);
}
