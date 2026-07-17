/**
 * Tier B — will it fit a human of that size? External fit checks: a garment can be
 * internally consistent (Tier A: it sews up) yet not go on a body.
 *
 * First check: a crew pullover must pass over the head. The head goes through the
 * geometric neck HOLE (an ellipse of neck width × total front+back depth), not the
 * neckband stitch count. A flat back makes that hole too snug on every size; the
 * back-neck scoop (neckopening.ts) opens it, solved to a comfortable stretch.
 */

import type { SizeRecord, EaseStyleId, NeckStyle, ShoulderStyle } from './data/types';
import { garmentWidths, MIN_UPPER_ARM_EASE_IN } from './dimensions';
import { VNECK_POINT_ABOVE_UNDERARM_IN } from './pieces/front';
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
/** Each shoulder should be at least this wide, or the neck slides off. */
export const MIN_SHOULDER_IN = 1.25;
/** A V should drop at least this far to read as a V (not a deep crew). */
export const MIN_V_DEPTH_IN = 2.5;

/**
 * ...and no deeper than a modesty cap that varies by who's wearing it: men wear
 * markedly shallower Vs than women, and a large bust shouldn't plunge into
 * cleavage-revealing territory. Provisional bands — to confirm at Tier C.
 */
export function maxVDepthIn(size: SizeRecord): number {
  switch (size.category) {
    case 'Man':
      return 5.5;
    case 'Woman':
      return 7.0;
    case 'Child':
      return 5.0;
    default:
      return 4.0; // Baby
  }
}

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
export function fitReport(
  size: SizeRecord,
  style: EaseStyleId,
  neck: NeckStyle = 'round',
  shoulder: ShoulderStyle = 'set_in',
): FitReport {
  const w = garmentWidths(size, style, shoulder);
  const neckFit = neckFitVerdict(size);
  const upperArmEase = w.sleeveTop - size.upper_arm;
  const shoulderWidth = (size.back_width - size.back_neck) / 2;
  const chestEase = w.chest - size.chest;

  const checks: FitCheck[] = [
    // A crew must clear the head; a V is open, so head-clearance does not apply.
    neck === 'v'
      ? { label: 'neck clears head', ok: true, detail: 'n/a (open V)' }
      : {
          label: 'neck clears head',
          ok: !crewSuitable(size) || neckFit.fit.fits,
          detail: crewSuitable(size) ? `${(neckFit.fit.headCirc / neckFit.fit.opening).toFixed(2)}×` : 'n/a → placket',
        },
    {
      label: 'neck not too wide',
      ok: shoulderWidth >= MIN_SHOULDER_IN,
      detail: `shoulder ${shoulderWidth.toFixed(2)}"`,
    },
    {
      label: 'chest ease sane',
      ok: style === 'skintight' || chestEase > 0,
      detail: `${chestEase >= 0 ? '+' : ''}${chestEase.toFixed(1)}"`,
    },
    {
      label: 'sleeve clears the arm',
      ok: upperArmEase >= MIN_UPPER_ARM_EASE_IN,
      detail: `bicep ease +${upperArmEase.toFixed(1)}" (scales with fit style)`,
    },
    {
      // Straight body to the armholes is the standard construction (agreed), so a
      // hip wider than the chest is only tight at deliberately-snug styles. Informational.
      label: 'hip clearance',
      ok: size.hip <= w.chest * HIP_STRETCH,
      detail: `hip ${size.hip}" vs finished ${w.chest.toFixed(1)}"`,
    },
  ];

  // V depth (choice 1): a V should read as a V — deep enough, but modest.
  if (neck === 'v') {
    const vDepth = Math.max(size.neck_depth, w.armholeDepth - VNECK_POINT_ABOVE_UNDERARM_IN);
    checks.push({
      label: 'v depth sensible',
      ok: vDepth >= MIN_V_DEPTH_IN && vDepth <= maxVDepthIn(size),
      detail: `V drops ${vDepth.toFixed(1)}" (max ${maxVDepthIn(size)}")${vDepth <= size.neck_depth + 0.01 ? ' — clamped to crew!' : ''}`,
    });
  }

  // Drop armhole (choice 3): a drop shoulder is LOOSER, so its armhole should be at
  // least as deep as a fitted set-in one — currently it comes out shallower.
  if (shoulder === 'drop') {
    const setinDepth = garmentWidths(size, style, 'set_in').armholeDepth;
    checks.push({
      label: 'drop armhole deep enough',
      ok: w.armholeDepth >= setinDepth,
      detail: `drop ${w.armholeDepth.toFixed(1)}" vs set-in ${setinDepth.toFixed(1)}"`,
    });
  }

  return { size: `${size.category} ${size.chest}"`, checks, allOk: checks.every((c) => c.ok) };
}
