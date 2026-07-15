/**
 * size + ease_style -> finished garment widths (the eased dimensions).
 *
 * This is the first slice of GarmentDimensions: the four widths the manual says
 * ease is applied to (chest, back width, armhole, upper arm). Lengths, neck
 * geometry and rib widths come later. See `data/dimensions_model.md`.
 *
 * Works in the size row's own unit (inches for the inch rows). mm-canonicalisation
 * is a render/gauge-boundary concern, deferred until gauge is wired in.
 *
 * WARNING: only `chest` is trustworthy. `backWidth`, `armhole` and `sleeveTop`
 * carry flagged ease assumptions (open item E1) to be confirmed at the Woman-36"
 * checkpoint — ideally against one readout of the original's dimensions screen.
 */

import type { SizeRecord, EaseStyleId } from './data/types';
import { easeBase } from './data/options';

/**
 * Fraction of the chest ease (`base·ease_factor`) applied to each width.
 * Only `chest` is settled; the rest are assumptions — see `dimensions_model.md`.
 */
export const EASE_SHARE = {
  chest: 1, // solid — manual worked examples
  backWidth: 0.5, // ASSUMPTION: a flat back panel spans ~half the circumference
  armhole: 1, // ASSUMPTION: magnitude unknown
  sleeveTop: 1, // ASSUMPTION: upper arm is a circumference like the chest
} as const;

export interface GarmentWidths {
  unit: 'in';
  /** The chest ease, `base·ease_factor`, in inches (negative for skintight). */
  ease: number;
  /** Body width the chest dimension is built on: larger of chest/hip (straight body). */
  bodyWidthBasis: number;
  /** True when the hip, not the chest, governs the width. */
  hipGoverns: boolean;
  chest: number;
  backWidth: number;
  armhole: number;
  sleeveTop: number;
}

/** The multiplicative ease amount for this size + style (see `ease_model.md`). */
export function easeAmount(size: SizeRecord, style: EaseStyleId): number {
  return easeBase(style) * size.ease_factor;
}

/** The four eased widths for a straight-body garment. */
export function garmentWidths(size: SizeRecord, style: EaseStyleId): GarmentWidths {
  const ease = easeAmount(size, style);
  // manual.txt:488 — straight body is governed by the larger of chest/hip
  const bodyWidthBasis = Math.max(size.chest, size.hip);
  return {
    unit: 'in',
    ease,
    bodyWidthBasis,
    hipGoverns: size.hip > size.chest,
    chest: bodyWidthBasis + EASE_SHARE.chest * ease,
    backWidth: size.back_width + EASE_SHARE.backWidth * ease,
    // armhole baseline = 2·arm_depth (manual.txt:257,506), plus flagged ease
    armhole: 2 * size.arm_depth + EASE_SHARE.armhole * ease,
    sleeveTop: size.upper_arm + EASE_SHARE.sleeveTop * ease,
  };
}
