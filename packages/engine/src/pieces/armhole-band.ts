/**
 * The armhole band — a sleeveless garment's answer to the sleeve. With no sleeve to
 * set in, each armhole is finished with a narrow band: on a machine it is knit as its
 * own strip and sewn round the armhole (the same reason the neckband is separate — a
 * curved armhole is awkward to pick up onto the bed); by hand it is picked up straight
 * off the armhole edge. Two of them, one per armhole ("make 2").
 *
 * The count follows the armhole edge, exactly as the neckband follows the neck edge:
 * the band has to cover the two curved selvedges (front + back) plus the flat underarm,
 * at this gauge's own stitch:row rate (pickupPerRow). Depth is the band rib (rib_neck),
 * kept shallow. Modelled on the Knitware sleeveless harvest (a picked-up, cast-off band
 * round the armhole), length-matched by pickupPerRow rather than KW's 1-per-row-then-
 * decrease. See knitware-phase4-harvest, and neckband.ts for the shared band idiom.
 */

import type { SizeRecord, EaseStyleId, ShoulderStyle } from '../data/types';
import { type Gauge, ribRowsFor } from '../gauge';
import { type Row, carriageForRow } from '../row';
import { backPlan, armholeShaping } from './back';
import { pickupPerRow } from './neckband';

export interface ArmholeBandPlan {
  pickupTotal: number; // cast on (machine) / picked up (hand) round one armhole, odd
  bandRows: number; // shallow rib depth
  armholeRows: number; // the armhole edge height each band spans (for the invariant)
  underarmCastOff: number; // flat underarm each side (0 for a drop's square armhole)
}

export function armholeBandPlan(
  size: SizeRecord,
  style: EaseStyleId,
  gauge: Gauge,
  shoulder: ShoulderStyle = 'set_in',
): ArmholeBandPlan {
  const bp = backPlan(size, style, gauge, shoulder, 'scoop', { sleeveLength: 'sleeveless' });
  // A drop armhole is a straight square notch (no shaping); a set-in has a shaped scye
  // with an underarm cast-off. Either way the band runs round two curved/straight edges
  // (front + back) plus the two flat underarm bases.
  const underarmCastOff =
    shoulder === 'drop' ? 0 : armholeShaping(bp.bodySts, bp.upperBackSts).castOffPerSide;
  const edgeRows = 2 * bp.armholeRows + 2 * underarmCastOff;
  const raw = Math.round(edgeRows * pickupPerRow(gauge));
  const pickupTotal = raw % 2 === 0 ? raw + 1 : raw; // odd, for a symmetric rib band
  const bandRows = Math.max(2, ribRowsFor(size.rib_neck, gauge));
  return { pickupTotal, bandRows, armholeRows: bp.armholeRows, underarmCastOff };
}

/**
 * One armhole band as Row[]: cast on (machine) round the armhole, work the shallow rib,
 * take off on waste yarn (the live edge sews to the armhole; hand picks up in place and
 * casts off — the prose splits on technique, keyed on the 'armband' piece, exactly as
 * the neckband splits on 'collar').
 */
export function armholeBandRows(
  size: SizeRecord,
  style: EaseStyleId,
  gauge: Gauge,
  shoulder: ShoulderStyle = 'set_in',
): Row[] {
  const p = armholeBandPlan(size, style, gauge, shoulder);
  const rows: Row[] = [];
  let index = 0;
  let stitches = 0;
  const push = (ops: Row['ops'], section: string): void => {
    index += 1;
    for (const op of ops) {
      if (op.kind === 'cast_on') stitches = op.count;
    }
    rows.push({ index, piece: 'armband', stitches, carriage: carriageForRow(index), ops, section });
  };

  push([{ kind: 'cast_on', count: p.pickupTotal }], 'cast_on');
  for (let i = 2; i < p.bandRows; i++) push([], 'rib');
  push([{ kind: 'take_off', count: stitches }], 'take_off');
  return rows;
}
