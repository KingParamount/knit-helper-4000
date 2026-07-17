/**
 * Assembly invariants — a reader over the generated row arrays that checks the
 * pieces actually fit *each other*: can the garment be sewn up?
 *
 * These are geometric facts, independent of any external pattern or oracle. A
 * garment can be internally consistent (sews up) yet the wrong size, or the right
 * size yet not sew up — two orthogonal properties. This module is only the first:
 * the shoulders must graft, the side seams must match, the sleeve underarm must
 * meet the body underarm, the back neck must close, and — the hard one — the
 * sleeve-cap edge must ease into the armhole it sews into.
 *
 * The original's manual states the target directly: a set-in classic cap is
 * "designed to fit exactly into the armhole" (sweaters manual, set-in shoulder).
 * Prose is ours; the geometric fact is not authored, so we check it.
 */

import type { SizeRecord, EaseStyleId, NeckStyle, ShoulderStyle } from '../data/types';
import type { Gauge } from '../gauge';
import { garmentWidths } from '../dimensions';
import { backPlan, armholeShaping, lowerPanelRows, armholeOpening } from './back';
import { frontNeckPlan } from './front';
import { sleevePlan, sleeveRows } from './sleeve';
import { seamEdgeLength, CAP_SECTIONS } from './seams';

// Re-exported so callers have one import for the whole assembly surface.
export { seamEdgeLength } from './seams';
export { armholeSeamLength, armholeOpening } from './back';

/** The sleeve-cap sewn perimeter: two curved side edges + the flat crown. */
export function capPerimeter(size: SizeRecord, style: EaseStyleId, gauge: Gauge): number {
  const cap = seamEdgeLength(sleeveRows('sleeve_l', size, style, gauge), CAP_SECTIONS, gauge);
  const crown = sleevePlan(size, style, gauge).capTopSts * (4 / gauge.bodySt);
  return 2 * cap + crown;
}

/** Cap ease as a fraction of the armhole opening. Small positive is the healthy band. */
export function capEase(size: SizeRecord, style: EaseStyleId, gauge: Gauge): number {
  return capPerimeter(size, style, gauge) / armholeOpening(size, style, gauge) - 1;
}

export interface Invariant {
  label: string;
  ok: boolean;
  detail: string;
}

export interface AssemblyReport {
  size: string;
  invariants: Invariant[];
  allOk: boolean;
}

/**
 * Every assembly invariant for one garment. Tolerances: counts that must graft or
 * seam allow a 1-stitch slack (the documented L/R short-row discrepancy); the cap
 * ease must be a small non-negative fraction — negative means the cap is too short
 * to reach round the armhole, and much over ~10% means it will pucker at the head.
 */
export function assemblyReport(
  size: SizeRecord,
  style: EaseStyleId,
  gauge: Gauge,
  neck: NeckStyle = 'round',
  shoulder: ShoulderStyle = 'set_in',
): AssemblyReport {
  const bp = backPlan(size, style, gauge, shoulder);
  const shaping = armholeShaping(bp.bodySts, bp.upperBackSts, gauge);
  const achieved = shaping.achievedSts;
  const backShoulder = Math.round((achieved - bp.backNeckSts) / 2);
  const front = frontNeckPlan(size, style, gauge, neck, shoulder);
  const sleeve = sleevePlan(size, style, gauge, shoulder);

  const backSide = lowerPanelRows('back', size, style, gauge, shoulder).length;
  const frontSide = lowerPanelRows('front', size, style, gauge, shoulder).length;

  // The sleeve↔body join. Set-in eases a fitted cap into the shaped armhole; drop
  // sews a straight sleeve top (its width) to the armhole opening (2 × depth).
  const sw = 4 / gauge.bodySt;
  let join: Invariant;
  if (shoulder === 'drop') {
    const sleeveTopIn = sleeve.sleeveTopSts * sw;
    const armholeOpenIn = 2 * garmentWidths(size, style, 'drop').armholeDepth;
    const dPct = ((sleeveTopIn - armholeOpenIn) / armholeOpenIn) * 100;
    join = {
      label: 'sleeve top fits armhole',
      ok: Math.abs(dPct) <= 4,
      detail: `sleeve top ${sleeveTopIn.toFixed(1)}" ≈ armhole ${armholeOpenIn.toFixed(1)}"`,
    };
  } else {
    const easePct = capEase(size, style, gauge) * 100;
    join = {
      label: 'cap fits armhole',
      ok: easePct >= -1 && easePct <= 10,
      detail: `ease ${easePct >= 0 ? '+' : ''}${easePct.toFixed(1)}%`,
    };
  }

  const invariants: Invariant[] = [
    {
      label: 'shoulder graft',
      ok: Math.abs(backShoulder - front.shoulderSts) <= 1,
      detail: `back ${backShoulder} = front ${front.shoulderSts}`,
    },
    {
      label: 'side seam',
      ok: backSide === frontSide,
      detail: `back ${backSide} = front ${frontSide} rows`,
    },
    {
      label: 'underarm meet',
      ok: sleeve.underarmCastOff === shaping.castOffPerSide,
      detail: `sleeve ${sleeve.underarmCastOff} = body ${shaping.castOffPerSide}`,
    },
    {
      label: 'back neck closes',
      ok: Math.abs(achieved - (2 * backShoulder + bp.backNeckSts)) <= 1,
      detail: `2×${backShoulder} + ${bp.backNeckSts} ≈ ${achieved}`,
    },
    join,
  ];

  return {
    size: `${size.category} ${size.chest}"`,
    invariants,
    allOk: invariants.every((i) => i.ok),
  };
}
