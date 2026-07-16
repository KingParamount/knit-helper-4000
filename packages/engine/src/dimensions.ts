/**
 * size + ease_style -> finished garment widths (the eased dimensions).
 *
 * First slice of GarmentDimensions. Derived from current (2026) knitting standards
 * rather than reproducing the original — see `data/dimensions_model.md`. Values are
 * sourced: Craft Yarn Council fit ladder for the chest ease; standard set-in-sleeve
 * allowances (Sister Mountain / Ann Budd) for the rest.
 *
 * Works in the size row's own unit (inches for the inch rows). mm-canonicalisation
 * is a render/gauge-boundary concern, deferred until gauge is wired in — note the
 * fixed allowances below are inch values and will need metric-native equivalents then.
 *
 * Scope: SET-IN sleeve, straight body. Other shoulder styles (drop, raglan, …) use
 * different allowances and are not modelled yet.
 */

import type { SizeRecord, EaseStyleId } from './data/types';
import { easeBase } from './data/options';

/**
 * Fixed ease allowances for a set-in sleeve, in inches. These do not scale with
 * the chest ease style — a set-in armhole/sleeve is fitted regardless of body
 * looseness. (A truly oversized garment loosens the sleeve slightly; treated as a
 * later refinement.) Sources in `dimensions_model.md`.
 */
export const SETIN_ALLOWANCE_IN = {
  backWidth: 0.0, // set-in shoulder seam sits on the shoulder tip — zero ease
  armholeDepth: 1.0, // body arm depth + 1" → ~8.5" finished, central vs (bust/6)+5cm
  upperArm: 1.0, // body upper arm + 1"
} as const;

export interface GarmentWidths {
  unit: 'in';
  /** The chest ease, `base·ease_factor`, in inches (negative for skintight). */
  chestEase: number;
  /** Finished body width = bust + chest ease (bust-only; hip clearance is deferred). */
  chest: number;
  /** Finished back width (between armhole seams). */
  backWidth: number;
  /** Finished armhole depth (vertical). */
  armholeDepth: number;
  /** Finished armhole measurement (around) = 2 × depth. */
  armhole: number;
  /** Finished sleeve top (upper arm circumference). */
  sleeveTop: number;
}

/** The multiplicative chest ease for this size + style (see `ease_model.md`). */
export function chestEase(size: SizeRecord, style: EaseStyleId): number {
  return easeBase(style) * size.ease_factor;
}

/** The finished widths for a set-in-sleeve, straight-body garment. */
export function garmentWidths(size: SizeRecord, style: EaseStyleId): GarmentWidths {
  const ease = chestEase(size, style);
  const armholeDepth = size.arm_depth + SETIN_ALLOWANCE_IN.armholeDepth;
  return {
    unit: 'in',
    chestEase: ease,
    chest: size.chest + ease, // bust-only; hip clearance handled later by length model
    backWidth: size.back_width + SETIN_ALLOWANCE_IN.backWidth,
    armholeDepth,
    armhole: 2 * armholeDepth, // manual.txt:257,506 — around = twice the depth
    sleeveTop: size.upper_arm + SETIN_ALLOWANCE_IN.upperArm,
  };
}
