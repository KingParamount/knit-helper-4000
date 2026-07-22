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

/**
 * Raw tape-length ratio of the cap perimeter to the armhole opening, minus one. A
 * geometric diagnostic ONLY — NOT the cap-fit criterion. It reads high (~+20–26%) for
 * a correctly-filled set-in cap because the cap edge is a diagonal staircase whose
 * tape runs far longer than a near-vertical armhole edge; the two are sewn row-for-row,
 * not tape-to-tape. The fit test is the row/height fill in `assemblyReport` (a cap that
 * fills ~0.85 of the armhole depth), not this number.
 */
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
  const shaping = armholeShaping(bp.bodySts, bp.upperBackSts);
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
    // A set-in cap sews to the armhole selvedge ROW-FOR-ROW, so the two edges match
    // by row count: the cap must fill nearly the whole armhole depth. (NOT by tape-
    // length — the cap's diagonal staircase lets a short, flat cap fake a tape-match
    // to a tall vertical armhole; that blind spot passed a 0.55×-armhole cap. See
    // sleeve.ts CAP_FILL.) Real men's caps fill ~0.79–0.89 (Berroco Anthony).
    const rowH = 4 / gauge.bodyRow;
    const capHeightIn = sleeve.capHeightRows * rowH;
    const armholeDepthIn = garmentWidths(size, style, 'set_in').armholeDepth;
    const fill = capHeightIn / armholeDepthIn;
    join = {
      label: 'cap fits armhole',
      ok: fill >= 0.78 && fill <= 0.95,
      detail: `cap fills ${(fill * 100).toFixed(0)}% of the armhole (${capHeightIn.toFixed(1)}"/${armholeDepthIn.toFixed(1)}")`,
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
