/**
 * Garment assembly — the pieces of one complete pullover as Row[] each.
 *
 * Pure and I/O-free like the rest of the engine: it just calls the per-piece
 * generators and collects their row arrays. This is the natural input to a
 * renderer (prose, schematic, device feed), which walks each piece in turn.
 */

import type { SizeRecord, EaseStyleId } from '../data/types';
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
}

/** Every piece of the set-in crew pullover for one size / ease style / gauge. */
export function assembleGarment(
  size: SizeRecord,
  style: EaseStyleId,
  gauge: Gauge,
): Garment {
  const s = sleeves(size, style, gauge);
  return {
    back: backRows(size, style, gauge),
    front: frontRows(size, style, gauge),
    sleeveLeft: s.left,
    sleeveRight: s.right,
    neckband: neckbandRows(size, style, gauge),
  };
}
