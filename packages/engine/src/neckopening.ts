/**
 * Neck-opening geometry and the back-neck scoop that keeps a crew passing over the
 * head. A leaf module (size + gauge only), so back.ts and the neckband can build the
 * scoop and fit.ts can check it, all without an import cycle.
 *
 * The head passes through the geometric HOLE, not the neckband stitch count. The hole
 * is ~an ellipse: neck width side-to-side, total depth = front scoop + back scoop. A
 * flat back (depth 0) makes it too snug on every size; scooping the back opens it.
 */

import type { SizeRecord } from './data/types';
import { type Gauge, rowsFor } from './gauge';

/**
 * Comfort dial: the neck opening must reach the head within this factor of stretch.
 * A geometric ratio (opening × stretch ≥ head). ~1.25× is an easy tug — matches real
 * worn crews (a graded 6yo crew sits ~1.3×).
 */
export const NECK_OPENING_STRETCH = 1.25;

/** The most stretch a crew may lean on and still be wearable (a firm kids' pull-over). */
export const NECK_STRETCH_MAX = 1.5;

/** A crew suits everyone but babies, whose heads are too large for the neck (→ placket). */
export function crewSuitable(size: SizeRecord): boolean {
  return size.category !== 'Baby';
}

// --- V-neck depth (validated at Tier C: women ×2, men ×2, kid ×1) ---------------
// Real patterns anchor the V a distance above the underarm that grows with size, so
// the depth is ~a fraction of the armhole, floored to read as a V, and capped for
// MODESTY on adults. Kids have no modesty cap — their V just needs to clear the head.

/** V depth ≈ this fraction of the armhole depth (real patterns cluster ~0.6–0.7). */
export const VNECK_DEPTH_FRACTION = 0.7;
/** A V should drop at least this far to read as a V (not a deep crew). */
export const MIN_V_DEPTH_IN = 2.5;

/**
 * Modesty cap on the V depth, by who wears it. Men wear shallower Vs than women; a
 * large bust shouldn't plunge. Kids get no modesty cap (their concern is head-fit).
 * Adult bands nudged +0.5" less conservative than the first cut, per real patterns.
 */
export function maxVDepthIn(size: SizeRecord): number {
  switch (size.category) {
    case 'Man':
      return 6.0;
    case 'Woman':
      return 7.5;
    default:
      return Infinity; // Child / Baby — bounded by head-fit, not modesty
  }
}

/** The V depth (inches) for an armhole of this depth: proportional, floored, capped. */
export function vNeckDepthIn(armholeDepthIn: number, size: SizeRecord): number {
  return Math.min(
    maxVDepthIn(size),
    Math.max(MIN_V_DEPTH_IN, armholeDepthIn * VNECK_DEPTH_FRACTION),
  );
}

/** Geometric neck-opening circumference (inches): ellipse of width W, total depth D. */
export function neckOpeningPerimeter(widthIn: number, depthIn: number): number {
  const a = widthIn / 2;
  const b = depthIn / 2;
  return Math.PI * (3 * (a + b) - Math.sqrt((3 * a + b) * (a + 3 * b))); // Ramanujan
}

/**
 * A modest back-neck drop every crew gets, even when the head does not force more.
 * Also the floor the shaping needs: the short-row shoulders live in the back-neck
 * region, so it can't be shallower than the shoulder slope (~1").
 */
const MIN_BACK_NECK_DROP_IN = 1.25;

/**
 * Back-neck scoop depth (inches), solved so the opening admits the head at
 * NECK_OPENING_STRETCH. Floored at a standard drop, capped at the front depth (a back
 * neck is never deeper than the front). Non-crew sizes just get the floor.
 */
export function backNeckDepthIn(size: SizeRecord): number {
  const front = size.neck_depth;
  const floor = MIN_BACK_NECK_DROP_IN;
  if (!crewSuitable(size)) return floor;
  const target = size.head_circ / NECK_OPENING_STRETCH;
  // Opening grows monotonically with back depth; find the shallowest that reaches target.
  for (let d = floor; d <= front; d += 0.05) {
    if (neckOpeningPerimeter(size.back_neck, front + d) >= target) return d;
  }
  return front; // capped: as deep as the front, the most a back neck should scoop
}

/** Back-neck scoop depth in rows. */
export function backNeckDepthRows(size: SizeRecord, gauge: Gauge): number {
  return rowsFor(backNeckDepthIn(size), gauge);
}
