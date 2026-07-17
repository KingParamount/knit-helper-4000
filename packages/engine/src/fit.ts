/**
 * Tier B — will it fit a human of that size? External fit checks: a garment can be
 * internally consistent (Tier A: it sews up) yet not go on a body.
 *
 * First check: a crew pullover must pass over the head. The head goes through the
 * geometric neck HOLE (an ellipse of neck width × total front+back depth), not the
 * neckband stitch count. A flat back makes that hole too snug on every size; the
 * back-neck scoop (neckopening.ts) opens it, solved to a comfortable stretch.
 */

import type { SizeRecord, EaseStyleId } from './data/types';
import { garmentWidths } from './dimensions';
import {
  NECK_OPENING_STRETCH,
  NECK_STRETCH_MAX,
  crewSuitable,
  neckOpeningPerimeter,
  backNeckDepthIn,
} from './neckopening';

// Home of the dial and crew policy is the leaf neckopening.ts; re-exported for callers.
export { NECK_OPENING_STRETCH, NECK_STRETCH_MAX, crewSuitable, neckOpeningPerimeter, backNeckDepthIn } from './neckopening';

export interface NeckHeadFit {
  opening: number; // geometric neck-opening circumference, inches
  stretchedOpening: number; // opening × NECK_OPENING_STRETCH — the most it opens to
  headCirc: number;
  fits: boolean;
  marginPct: number;
}

export function neckHeadFit(size: SizeRecord): NeckHeadFit {
  const opening = neckOpeningPerimeter(size.back_neck, size.neck_depth + backNeckDepthIn(size));
  const stretchedOpening = opening * NECK_STRETCH_MAX;
  const headCirc = size.head_circ;
  return {
    opening,
    stretchedOpening,
    headCirc,
    fits: stretchedOpening >= headCirc,
    marginPct: (stretchedOpening - headCirc) / headCirc,
  };
}

export type NeckFitVerdict = 'ok' | 'crew_unsuitable' | 'neck_too_small';

/** Classify a size's crew-neck fit: ok, wrong style for the body, or still too small. */
export function neckFitVerdict(size: SizeRecord): { verdict: NeckFitVerdict; fit: NeckHeadFit } {
  const fit = neckHeadFit(size);
  let verdict: NeckFitVerdict;
  if (!crewSuitable(size)) verdict = 'crew_unsuitable';
  else if (fit.fits) verdict = 'ok';
  else verdict = 'neck_too_small';
  return { verdict, fit };
}

// --- The full Tier-B fit sweep: does the finished garment fit a human of this size? ---

/** Knit fabric stretches ~8% to pass over the hip. */
export const HIP_STRETCH = 1.08;
/** A set-in sleeve wants roughly this much ease around the upper arm to be comfortable. */
export const UPPER_ARM_COMFORT_EASE_IN = 1.5;
/** Each shoulder should be at least this wide, or the neck slides off. */
export const MIN_SHOULDER_IN = 1.25;

export interface FitCheck {
  label: string;
  ok: boolean;
  detail: string;
}

export interface FitReport {
  size: string;
  checks: FitCheck[];
  allOk: boolean;
}

/**
 * Every Tier-B fit relationship for one garment. Body-fit checks are independent of
 * shoulder/neck style, so this one report serves them all — a new style just has to
 * pass it. Checks read finished dimensions against the body measurement + a band.
 */
export function fitReport(size: SizeRecord, style: EaseStyleId): FitReport {
  const w = garmentWidths(size, style);
  const neck = neckFitVerdict(size);
  const upperArmEase = w.sleeveTop - size.upper_arm;
  const shoulder = (size.back_width - size.back_neck) / 2;
  const chestEase = w.chest - size.chest;

  const checks: FitCheck[] = [
    {
      label: 'neck clears head',
      ok: !crewSuitable(size) || neck.fit.fits,
      detail: crewSuitable(size) ? `${(neck.fit.headCirc / neck.fit.opening).toFixed(2)}×` : 'n/a → placket',
    },
    {
      label: 'neck not too wide',
      ok: shoulder >= MIN_SHOULDER_IN,
      detail: `shoulder ${shoulder.toFixed(2)}"`,
    },
    {
      label: 'chest ease sane',
      ok: style === 'skintight' || chestEase > 0,
      detail: `${chestEase >= 0 ? '+' : ''}${chestEase.toFixed(1)}"`,
    },
    {
      label: 'hip clearance',
      ok: size.hip <= w.chest * HIP_STRETCH,
      detail: `hip ${size.hip}" vs finished ${w.chest.toFixed(1)}"`,
    },
    {
      label: 'upper-arm ease',
      ok: upperArmEase >= UPPER_ARM_COMFORT_EASE_IN,
      detail: `+${upperArmEase.toFixed(1)}" (want ≥${UPPER_ARM_COMFORT_EASE_IN}")`,
    },
    {
      label: 'sleeve-length ease applied',
      ok: (size.ease_arml ?? 0) === 0,
      detail: `ease_arml ${size.ease_arml}" not added to the sleeve`,
    },
  ];
  return { size: `${size.category} ${size.chest}"`, checks, allOk: checks.every((c) => c.ok) };
}
