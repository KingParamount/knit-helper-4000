/**
 * The crew neckband: pick up stitches around the finished neck opening, work a
 * short 1×1 rib (which pulls in for a snug crew fit), and cast off loosely.
 *
 * Pick-up count is the usual convention: one stitch per stitch along the cast-off
 * edges (back neck, front centre), and ~3 stitches per 4 rows along the shaped
 * front-neck side edges. Band depth from the size table's neck rib.
 *
 * Worked flat here (seam one shoulder last); the count is the same as in the round.
 */

import type { SizeRecord, EaseStyleId } from '../data/types';
import { type Gauge, stitchesFor, ribRowsFor } from '../gauge';
import { type Row, carriageForRow } from '../row';
import { backPlan } from './back';
import { frontNeckPlan, frontNeckDepthRows } from './front';

/** Stitches picked up per row along a shaped/vertical neck edge (3 per 4 rows). */
export const PICKUP_PER_ROW = 3 / 4;

export interface NeckbandPlan {
  backNeckSts: number; // picked up 1:1 along the back cast-off
  frontCentreSts: number; // picked up 1:1 along the front centre cast-off
  frontSidePickup: number; // each shaped front side edge
  pickupTotal: number;
  bandRows: number;
}

export function neckbandPlan(size: SizeRecord, style: EaseStyleId, gauge: Gauge): NeckbandPlan {
  const backNeckSts = backPlan(size, style, gauge).backNeckSts;
  const fp = frontNeckPlan(size, style, gauge);
  const frontCentreSts = fp.frontNeckSts - 2 * stitchesFor(1.5, gauge); // the centre cast-off
  const frontSidePickup = Math.round(frontNeckDepthRows(size, gauge) * PICKUP_PER_ROW);
  // A worked-flat 1x1 rib band picks up an odd number (extra on the right) so both
  // selvedges are knit stitches; it is cast off in rib, with no drop to even.
  const rawPickup = backNeckSts + frontCentreSts + 2 * frontSidePickup;
  const pickupTotal = rawPickup % 2 === 0 ? rawPickup + 1 : rawPickup;
  return {
    backNeckSts,
    frontCentreSts,
    frontSidePickup,
    pickupTotal,
    bandRows: ribRowsFor(size.rib_neck, gauge),
  };
}

export function neckbandRows(size: SizeRecord, style: EaseStyleId, gauge: Gauge): Row[] {
  const p = neckbandPlan(size, style, gauge);
  const rows: Row[] = [];
  let index = 0;
  let stitches = 0;
  const push = (ops: Row['ops'], section: string): void => {
    index += 1;
    for (const op of ops) {
      if (op.kind === 'pick_up') stitches = op.count;
      if (op.kind === 'bind_off') stitches -= op.count;
    }
    rows.push({ index, piece: 'collar', stitches, carriage: carriageForRow(index), ops, section });
  };
  push([{ kind: 'pick_up', count: p.pickupTotal }], 'pickup');
  for (let i = 0; i < p.bandRows; i++) push([], 'rib');
  push([{ kind: 'bind_off', count: p.pickupTotal, side: 'center' }], 'castoff'); // loosely
  return rows;
}
