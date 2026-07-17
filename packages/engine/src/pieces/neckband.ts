/**
 * The neckband: pick up stitches around the finished neck opening, work a short rib
 * band, and cast off loosely. Serves both neck styles — a crew has a front centre
 * cast-off to pick up along; a V has none (frontCentre = 0) and picks up along the
 * two long V edges instead, meeting at the point (finish — mitred or crossed — is a
 * prose choice presented in the pattern, not a construction fork).
 *
 * Pick-up: one stitch per stitch along the cast-off edges (back neck, front centre),
 * ~3 stitches per 4 rows along the shaped side edges. Band depth from the neck rib.
 * Worked flat here (seam one shoulder last); the count is the same as in the round.
 */

import type { SizeRecord, EaseStyleId, NeckStyle, ShoulderStyle } from '../data/types';
import { type Gauge, stitchesFor, ribRowsFor } from '../gauge';
import { type Row, carriageForRow } from '../row';
import { backPlan } from './back';
import { frontNeckPlan } from './front';

/** Stitches picked up per row along a shaped/vertical neck edge (3 per 4 rows). */
export const PICKUP_PER_ROW = 3 / 4;

export interface NeckbandPlan {
  backCentreSts: number; // picked up 1:1 along the back centre cast-off
  backSidePickup: number; // each shaped back-neck side edge (the back is now scooped)
  frontCentreSts: number; // picked up 1:1 along the front centre cast-off
  frontSidePickup: number; // each shaped front side edge
  pickupTotal: number;
  bandRows: number;
}

export function neckbandPlan(
  size: SizeRecord,
  style: EaseStyleId,
  gauge: Gauge,
  neck: NeckStyle = 'round',
  shoulder: ShoulderStyle = 'set_in',
): NeckbandPlan {
  const bp = backPlan(size, style, gauge, shoulder);
  const backCentreSts = bp.backNeckCentreSts; // centre cast-off of the back scoop
  const backSidePickup = Math.round(bp.backNeckRows * PICKUP_PER_ROW);
  const fp = frontNeckPlan(size, style, gauge, neck, shoulder);
  // A crew picks up along its front centre cast-off; a V has no centre — the two long
  // V edges meet at the point (frontCentre = 0), so its side pick-up runs the deep V.
  const frontCentreSts = neck === 'v' ? 0 : fp.frontNeckSts - 2 * stitchesFor(1.5, gauge);
  const frontSidePickup = Math.round(fp.neckDepthRows * PICKUP_PER_ROW);
  // A worked-flat rib band picks up an odd number (extra on the right) so both
  // selvedges are knit stitches; it is cast off in rib, with no drop to even.
  const rawPickup = backCentreSts + 2 * backSidePickup + frontCentreSts + 2 * frontSidePickup;
  const pickupTotal = rawPickup % 2 === 0 ? rawPickup + 1 : rawPickup;
  return {
    backCentreSts,
    backSidePickup,
    frontCentreSts,
    frontSidePickup,
    pickupTotal,
    bandRows: ribRowsFor(size.rib_neck, gauge),
  };
}

export function neckbandRows(
  size: SizeRecord,
  style: EaseStyleId,
  gauge: Gauge,
  neck: NeckStyle = 'round',
  shoulder: ShoulderStyle = 'set_in',
): Row[] {
  const p = neckbandPlan(size, style, gauge, neck, shoulder);
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
