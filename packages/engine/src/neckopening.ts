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
