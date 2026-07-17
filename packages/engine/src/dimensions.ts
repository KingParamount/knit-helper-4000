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

import type { SizeRecord, EaseStyleId, ShoulderStyle } from './data/types';
import { easeBase } from './data/options';

/**
 * Fixed ease allowances for a set-in sleeve, in inches. The back-width seam sits on
 * the shoulder tip (zero ease) and the armhole depth is a fixed drop; both are
 * independent of the fit style. The *bicep* ease is NOT fixed — it tracks the fit
 * style (see `upperArmEase`): a snug fit is snug over the arm, a standard fit isn't.
 * Sources in `dimensions_model.md`.
 */
export const SETIN_ALLOWANCE_IN = {
  backWidth: 0.0, // set-in shoulder seam sits on the shoulder tip — zero ease
  armholeDepth: 1.0, // body arm depth + 1" → ~8.5" finished, central vs (bust/6)+5cm
} as const;

/** Bicep ease as a fraction of the chest ease — so it tracks the fit style. */
export const ARM_EASE_FRACTION = 0.75;
/** The sleeve must clear the arm even at the snuggest fit... */
export const MIN_UPPER_ARM_EASE_IN = 0.5;
/** ...and a set-in armhole can only ease in so much cap, so the bicep ease is capped. */
export const MAX_UPPER_ARM_EASE_IN = 2.5;

/**
 * Ease around the upper arm, scaled to the fit style. A snug (skintight/tight) fit is
 * snug over the bicep; a standard fit is comfortable; a loose fit is roomy — clamped
 * so the sleeve always clears the arm and never asks more cap than the armhole can take.
 */
export function upperArmEase(size: SizeRecord, style: EaseStyleId): number {
  const scaled = chestEase(size, style) * ARM_EASE_FRACTION;
  return Math.min(MAX_UPPER_ARM_EASE_IN, Math.max(MIN_UPPER_ARM_EASE_IN, scaled));
}

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

/** The finished widths for a straight-body garment, for the given shoulder style. */
export function garmentWidths(
  size: SizeRecord,
  style: EaseStyleId,
  shoulder: ShoulderStyle = 'set_in',
): GarmentWidths {
  const ease = chestEase(size, style);
  const sleeveTop = size.upper_arm + upperArmEase(size, style);
  // Set-in: a shaped-scye depth from the arm. Drop: the straight sleeve top (width)
  // sews to the front+back armhole edges, so the armhole depth is half that width.
  const armholeDepth =
    shoulder === 'drop' ? sleeveTop / 2 : size.arm_depth + SETIN_ALLOWANCE_IN.armholeDepth;
  return {
    unit: 'in',
    chestEase: ease,
    chest: size.chest + ease, // bust-only; hip clearance handled later by length model
    backWidth: size.back_width + SETIN_ALLOWANCE_IN.backWidth,
    armholeDepth,
    armhole: 2 * armholeDepth, // manual.txt:257,506 — around = twice the depth
    sleeveTop,
  };
}
