/**
 * Garment assembly — the pieces of one complete pullover as Row[] each.
 *
 * Pure and I/O-free like the rest of the engine: it just calls the per-piece
 * generators and collects their row arrays. This is the natural input to a
 * renderer (prose, schematic, device feed), which walks each piece in turn.
 */

import type { SizeRecord, EaseStyleId, NeckStyle, BackNeckStyle, ShoulderStyle } from '../data/types';
import type { Gauge } from '../gauge';
import type { Row } from '../row';
import { backRows } from './back';
import { frontRows } from './front';
import { sleeves } from './sleeve';
import { neckbandRows } from './neckband';

export interface Garment {
  back: Row[];
  front: Row[];
  sleeveLeft: Row[];
  sleeveRight: Row[];
  neckband: Row[];
  neck: NeckStyle;
  backNeck: BackNeckStyle;
  shoulder: ShoulderStyle;
}

/** Every piece of the set-in pullover for one size / ease style / gauge / neck style. */
export function assembleGarment(
  size: SizeRecord,
  style: EaseStyleId,
  gauge: Gauge,
  neck: NeckStyle = 'round',
  shoulder: ShoulderStyle = 'set_in',
  backNeck: BackNeckStyle = 'scoop',
): Garment {
  const s = sleeves(size, style, gauge, shoulder);
  return {
    back: backRows(size, style, gauge, shoulder, backNeck),
    front: frontRows(size, style, gauge, neck, shoulder),
    sleeveLeft: s.left,
    sleeveRight: s.right,
    neckband: neckbandRows(size, style, gauge, neck, shoulder, 'machine', backNeck),
    neck,
    backNeck,
    shoulder,
  };
}
