/**
 * Garment assembly — the pieces of one complete pullover as Row[] each.
 *
 * Pure and I/O-free like the rest of the engine: it just calls the per-piece
 * generators and collects their row arrays. This is the natural input to a
 * renderer (prose, schematic, device feed), which walks each piece in turn.
 */

import type {
  SizeRecord,
  EaseStyleId,
  NeckStyle,
  BackNeckStyle,
  ShoulderStyle,
  BodyLength,
  HemStyle,
  SleeveLength,
  GarmentOptions,
} from '../data/types';
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
  bodyLength: BodyLength;
  hem: HemStyle;
  sleeveLength: SleeveLength;
}

/** Every piece of the set-in pullover for one size / ease style / gauge / neck style. */
export function assembleGarment(
  size: SizeRecord,
  style: EaseStyleId,
  gauge: Gauge,
  neck: NeckStyle = 'round',
  shoulder: ShoulderStyle = 'set_in',
  backNeck: BackNeckStyle = 'scoop',
  opts: GarmentOptions = {},
): Garment {
  const s = sleeves(size, style, gauge, shoulder, opts);
  return {
    back: backRows(size, style, gauge, shoulder, backNeck, opts),
    front: frontRows(size, style, gauge, neck, shoulder, opts),
    sleeveLeft: s.left,
    sleeveRight: s.right,
    // The neckband is length- and hem-independent: it picks up from the neck opening
    // only, and its depth is the separate rib_neck measurement.
    neckband: neckbandRows(size, style, gauge, neck, shoulder, 'machine', backNeck),
    neck,
    backNeck,
    shoulder,
    bodyLength: opts.bodyLength ?? 'hip',
    hem: opts.hem ?? 'ribbing',
    sleeveLength: opts.sleeveLength ?? 'full',
  };
}
