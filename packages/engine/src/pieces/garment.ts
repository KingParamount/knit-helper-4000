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
import { armholeBandRows } from './armhole-band';

export interface Garment {
  back: Row[];
  front: Row[];
  /** The two sleeves — empty for a sleeveless garment (which gains `armholeBand`). */
  sleeveLeft: Row[];
  sleeveRight: Row[];
  /** One armhole band, worked twice — present only for a sleeveless garment. */
  armholeBand?: Row[];
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
  // Sleeveless has no sleeve pieces — each armhole gets a picked-up band instead.
  const sleeveless = opts.sleeveLength === 'sleeveless';
  const s = sleeveless ? { left: [], right: [] } : sleeves(size, style, gauge, shoulder, opts);
  return {
    back: backRows(size, style, gauge, shoulder, backNeck, opts),
    front: frontRows(size, style, gauge, neck, shoulder, opts),
    sleeveLeft: s.left,
    sleeveRight: s.right,
    ...(sleeveless ? { armholeBand: armholeBandRows(size, style, gauge, shoulder) } : {}),
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
