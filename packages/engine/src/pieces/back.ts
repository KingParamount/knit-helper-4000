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
  rowsFor,
  ribRowsFor,
} from '../gauge';
import { type Row, carriageForRow } from '../row';

export interface PlanSection {
  name: string;
  startRow: number;
  endRow: number;
  rows: number;
  stitches: number;
  note?: string;
}

export interface BackPlan {
  castOnSts: number; // hem = half the finished chest (flat back panel)
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

  const castOnSts = stitchesFor(w.chest / 2, gauge);
  const upperBackSts = stitchesFor(size.back_width, gauge);
  const backNeckSts = stitchesFor(size.back_neck, gauge);

  const totalRows = rowsFor(bodyLengthInches(size), gauge);
  const ribRows = ribRowsFor(size.rib_body, gauge);
  const armholeRows = rowsFor(w.armholeDepth, gauge);
  const bodyRows = totalRows - armholeRows - ribRows;

  const sections: PlanSection[] = [
    { name: 'rib', startRow: 1, endRow: ribRows, rows: ribRows, stitches: castOnSts },
    {
      name: 'body',
      startRow: ribRows + 1,
      endRow: ribRows + bodyRows,
      rows: bodyRows,
      stitches: castOnSts,
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
    castOnSts,
    upperBackSts,
    backNeckSts,
    totalRows,
    ribRows,
    bodyRows,
    armholeRows,
    sections,
    shaping: {
      armholeDecTotal: castOnSts - upperBackSts,
      shoulderStsEachApprox: Math.round((upperBackSts - backNeckSts) / 2),
      note: 'armhole narrows castOn->upperBack; top splits into two shoulders + back neck',
    },
  };
}

/**
 * Row[] for the lower back: cast-on, rib, and plain body to the underarm.
 * Stops at the underarm; the array continues once shaping is added.
 */
export function lowerBackRows(
  size: SizeRecord,
  style: EaseStyleId,
  gauge: Gauge,
): Row[] {
  const plan = backPlan(size, style, gauge);
  const lastPlainRow = plan.ribRows + plan.bodyRows; // underarm
  const rows: Row[] = [];
  for (let index = 1; index <= lastPlainRow; index++) {
    rows.push({
      index,
      piece: 'back',
      stitches: plan.castOnSts,
      carriage: carriageForRow(index),
      ops: index === 1 ? [{ kind: 'cast_on', count: plan.castOnSts }] : [],
      section: index <= plan.ribRows ? 'rib' : 'body',
    });
  }
  return rows;
}

export interface ArmholeShaping {
  bindOffPerSide: number; // underarm cast-off, each side
  decPerSide: number; // single decreases each side, every other row
  achievedSts: number; // stitches remaining after shaping
}

/**
 * Standard set-in armhole shaping: cast off ~1" at the underarm each side, then
 * decrease one stitch each side every other row until the back width is reached.
 * The row array records "decrease n at edge" without prescribing the technique
 * (fully-fashioned vs edge) — that is the knitter's choice.
 */
export function armholeShaping(
  castOnSts: number,
  targetSts: number,
  gauge: Gauge,
): ArmholeShaping {
  const perSide = Math.round((castOnSts - targetSts) / 2);
  const bindOffPerSide = Math.min(stitchesFor(1.0, gauge), perSide); // ~1" underarm
  return {
    bindOffPerSide,
    decPerSide: perSide - bindOffPerSide,
    achievedSts: castOnSts - 2 * perSide,
  };
}

/**
 * The back from cast-on through the armhole decreases (ends at the achieved back
 * width). Above this is straight to the shoulder line, then short-row shoulders
 * and the back neck — the next increment.
 */
export function backThroughArmhole(
  size: SizeRecord,
  style: EaseStyleId,
  gauge: Gauge,
): Row[] {
  const plan = backPlan(size, style, gauge);
  const rows = lowerBackRows(size, style, gauge);
  const shaping = armholeShaping(plan.castOnSts, plan.upperBackSts, gauge);

  let index = rows.length; // last body row (underarm)
  let stitches = plan.castOnSts;
  const push = (ops: Row['ops']): void => {
    index += 1;
    for (const op of ops) {
      if (op.kind === 'bind_off') stitches -= op.count;
      if (op.kind === 'decrease') stitches -= op.count * (op.side === 'both' ? 2 : 1);
    }
    rows.push({
      index,
      piece: 'back',
      stitches,
      carriage: carriageForRow(index),
      ops,
      section: 'armhole',
    });
  };

  // Underarm cast-off, one side per row (a block cast-off follows the carriage).
  push([{ kind: 'bind_off', count: shaping.bindOffPerSide, side: carriageForRow(index + 1) }]);
  push([{ kind: 'bind_off', count: shaping.bindOffPerSide, side: carriageForRow(index + 1) }]);
  // Single decreases each end, every other row (transfers at both edges).
  for (let d = 0; d < shaping.decPerSide; d++) {
    push([{ kind: 'decrease', count: 1, side: 'both' }]); // shaping row
    if (d < shaping.decPerSide - 1) push([]); // plain row between
  }
  return rows;
}
