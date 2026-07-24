/**
 * Neck-opening geometry and the back-neck scoop that keeps a crew passing over the
 * head. A leaf module (size + gauge only), so back.ts and the neckband can build the
 * scoop and fit.ts can check it, all without an import cycle.
 *
 * The head passes through the geometric HOLE, not the neckband stitch count. The hole
 * is ~an ellipse: neck width side-to-side, total depth = front scoop + back scoop. A
 * flat back (depth 0) makes it too snug on every size; scooping the back opens it.
 */

import type { SizeRecord, NeckStyle, BackNeckStyle } from './data/types';
import { type Gauge, rowsFor } from './gauge';

/**
 * The neck-edge curve worked each side of a shaped (crew/scoop) neck — cast off a
 * little, then decrease the rest. Sourced here so the front piece (front.ts), the back
 * scoop (back.ts) and the neckband pickup (neckband.ts) can never drift apart: the band
 * covers exactly the edge the piece shaped.
 */
export const NECK_CURVE_IN = 1.5;

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

// --- Scoop depth (front and, later, the deeper back scoop) -----------------------
/**
 * A scoop is a deeper, wider round. Its depth is a fraction of the armhole (Knitware's
 * scoop fronts measure ~0.55–0.60 of the armhole across the size range), floored so it
 * is never shallower than a plain crew — otherwise a shallow-armhole size would give a
 * "scoop" no deeper than the round it is meant to exceed.
 */
export const SCOOP_DEPTH_FRACTION = 0.57;
export function scoopDepthIn(armholeDepthIn: number, size: SizeRecord): number {
  return Math.max(size.neck_depth, armholeDepthIn * SCOOP_DEPTH_FRACTION);
}

// --- Square and high-round depths (front and back share these; symmetric) --------
// Both key off the measured neck depth (not the armhole) so the leaf stays gauge-only
// and the front and back necks match. Calibrated against the 2026-07-24 harvest.

/**
 * A square neck's depth. Knitware drops the square deep (~0.67× the armhole, 6.1" on a
 * Woman 36); we take the shallower modern draft (King, 2026-07-24) — deeper than a crew,
 * shallower than a scoop — so it reads as a square without plunging. neck_depth × 1.1 gives
 * ~4.0" (W36), ~4.6" (W50), ~2.6" (Child 24). The square shape comes from the flat base and
 * vertical sides, not the depth, so a modest drop still reads square.
 */
export const SQUARE_DEPTH_FACTOR = 1.1;
export function squareDepthIn(size: SizeRecord): number {
  return size.neck_depth * SQUARE_DEPTH_FACTOR;
}

/**
 * A high round is a crew that sits higher — the same round shape at roughly half the depth.
 * neck_depth × 0.6 reproduces the harvest exactly (W36 2.2", W50 2.5"). The shallower drop
 * shrinks the head opening, so a high round is head-checked and gated like a flat neck.
 */
export const HIGH_ROUND_DEPTH_FACTOR = 0.6;
export function highRoundDepthIn(size: SizeRecord): number {
  return size.neck_depth * HIGH_ROUND_DEPTH_FACTOR;
}

/**
 * Depth (inches) a front neck adds to the head opening, by style. A crew is the measured
 * neck depth; a scoop is deeper, so for head-clearance it clears at least as well as a
 * crew — we use the crew depth as a safe lower bound rather than the armhole (which the
 * leaf module does not know). A flat front sits at the shoulder line and adds nothing.
 * A V is open and is never head-checked, so it is treated as a crew here for completeness.
 */
export function frontOpeningDepthIn(size: SizeRecord, neck: NeckStyle): number {
  // A high round is shallower than a crew, so it reports its own reduced depth and can
  // genuinely fail the head check (gated like a flat neck). A square is deeper than a crew
  // and a scoop deeper still, so both are safe at the crew lower bound. 'boat' uses a
  // different construction and never reaches this path (its wide opening always clears).
  if (neck === 'flat') return 0;
  if (neck === 'high_round') return highRoundDepthIn(size);
  return size.neck_depth;
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
 * Back-neck depth (inches). A 'flat' back has no scoop — it sits at the floor, which is
 * the shoulder-slope minimum the short-rows need (it is not literally zero). A 'scoop'
 * back is solved so the opening admits the head at NECK_OPENING_STRETCH, floored at that
 * same drop and capped at the front depth (a back neck is never deeper than the front).
 * A 'square' back mirrors the square front (a real, deeper drop with vertical sides); a
 * 'high_round' back mirrors the shallow high-round front. Both are floored at the same
 * minimum drop. Non-crew sizes just get the floor.
 */
export function backNeckDepthIn(size: SizeRecord, back: BackNeckStyle = 'scoop'): number {
  const front = size.neck_depth;
  const floor = MIN_BACK_NECK_DROP_IN;
  if (back === 'flat') return floor;
  if (back === 'square') return Math.max(floor, squareDepthIn(size));
  if (back === 'high_round') return Math.max(floor, highRoundDepthIn(size));
  if (!crewSuitable(size)) return floor;
  const target = size.head_circ / NECK_OPENING_STRETCH;
  // Opening grows monotonically with back depth; find the shallowest that reaches target.
  for (let d = floor; d <= front; d += 0.05) {
    if (neckOpeningPerimeter(size.back_neck, front + d) >= target) return d;
  }
  return front; // capped: as deep as the front, the most a back neck should scoop
}

/** Back-neck depth in rows. */
export function backNeckDepthRows(size: SizeRecord, gauge: Gauge, back: BackNeckStyle = 'scoop'): number {
  return rowsFor(backNeckDepthIn(size, back), gauge);
}
