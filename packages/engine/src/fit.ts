/**
 * Tier B — will it fit a human of that size? External fit checks: a garment can be
 * internally consistent (Tier A: it sews up) yet not go on a body.
 *
 * First check: a crew pullover must pass over the head. The head goes through the
 * geometric neck HOLE (an ellipse of neck width × total front+back depth), not the
 * neckband stitch count. A flat back makes that hole too snug on every size; the
 * back-neck scoop (neckopening.ts) opens it, solved to a comfortable stretch.
 */

import type {
  SizeRecord,
  EaseStyleId,
  NeckStyle,
  BackNeckStyle,
  ShoulderStyle,
  BodyLength,
  HemStyle,
  GarmentOptions,
} from './data/types';
import { garmentWidths, MIN_UPPER_ARM_EASE_IN } from './dimensions';
import type { Gauge } from './gauge';
import { backPlan, BODY_LENGTHS } from './pieces/back';
import {
  NECK_STRETCH_MAX,
  crewSuitable,
  neckOpeningPerimeter,
  backNeckDepthIn,
  frontOpeningDepthIn,
  vNeckDepthIn,
  maxVDepthIn,
  MIN_V_DEPTH_IN,
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

export function neckHeadFit(
  size: SizeRecord,
  neck: NeckStyle = 'round',
  backNeck: BackNeckStyle = 'scoop',
): NeckHeadFit {
  // The opening is the ellipse of neck width × (chosen front depth + chosen back depth).
  // A flat front or flat back drops its depth term, shrinking the opening — which is
  // exactly why a flat neck can fail to clear the head where a scoop/crew would not.
  const opening = neckOpeningPerimeter(
    size.back_neck,
    frontOpeningDepthIn(size, neck) + backNeckDepthIn(size, backNeck),
  );
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
export function neckFitVerdict(
  size: SizeRecord,
  neck: NeckStyle = 'round',
  backNeck: BackNeckStyle = 'scoop',
): { verdict: NeckFitVerdict; fit: NeckHeadFit } {
  const fit = neckHeadFit(size, neck, backNeck);
  let verdict: NeckFitVerdict;
  if (!crewSuitable(size)) verdict = 'crew_unsuitable';
  else if (fit.fits) verdict = 'ok';
  else verdict = 'neck_too_small';
  return { verdict, fit };
}

/**
 * May a flat neck (front and/or back) be offered at this size + neck combination? A flat
 * neck drops the depth that opens a crew over the head, so the head must still clear at
 * the chosen depths; a V front is open and always may. The UI uses this to block the flat
 * options where they would produce an unwearable neck (the agreed policy). Scoop never
 * blocks — it only opens the neck further.
 */
export function neckClearsHead(size: SizeRecord, neck: NeckStyle, backNeck: BackNeckStyle): boolean {
  if (neck === 'v') return true; // open
  return neckHeadFit(size, neck, backNeck).fits;
}

/** May a flat BACK be offered, given the current front neck? */
export function flatBackAllowed(size: SizeRecord, neck: NeckStyle = 'round'): boolean {
  return neckClearsHead(size, neck, 'flat');
}

/** May a flat FRONT be offered, given the current back neck? */
export function flatFrontAllowed(size: SizeRecord, backNeck: BackNeckStyle = 'scoop'): boolean {
  return neckClearsHead(size, 'flat', backNeck);
}

/** Does the hem sit at or below the hip (so the tube must clear the hip on the way down)? */
export function hemReachesHip(bodyLength: BodyLength): boolean {
  return BODY_LENGTHS.indexOf(bodyLength) >= BODY_LENGTHS.indexOf('hip');
}

/**
 * The body must keep at least a row pair of plain knitting between the rib and the
 * underarm, or the "body" is shorter than its own armhole + hem and cannot be built.
 */
export const MIN_BODY_ROWS = 2;

/**
 * May this body length be offered at this size / gauge / shoulder / hem? A short length
 * must still clear the armhole and the hem — a crop over a deep raglan armhole can ask
 * for a body shorter than its own top and bottom, which is unbuildable, so the UI
 * blocks it (the same block-not-warn policy as the flat neck). Longer lengths never
 * block: the tube just keeps going. The hem matters: a shallow band or no hem frees
 * rows, which is exactly what reopens crop×raglan.
 */
export function bodyLengthAllowed(
  size: SizeRecord,
  style: EaseStyleId,
  gauge: Gauge,
  shoulder: ShoulderStyle,
  bodyLength: BodyLength,
  hem: HemStyle = 'ribbing',
): boolean {
  return backPlan(size, style, gauge, shoulder, 'scoop', { bodyLength, hem }).bodyRows >= MIN_BODY_ROWS;
}

/**
 * May this hem be offered? A frill is hand-only for now: the doubled cast-on outruns
 * a machine bed at most sizes, and the gather (knit two together all the way across)
 * is a hand row. Blocked, not warned, when the technique is machine — a future
 * machine feature (a separately-knit, grafted ruffle).
 */
export function hemAllowed(hem: HemStyle, technique: 'machine' | 'hand'): boolean {
  return !(hem === 'frill' && technique === 'machine');
}

// --- The full Tier-B fit sweep: does the finished garment fit a human of this size? ---

/** Knit fabric stretches ~8% to pass over the hip. */
export const HIP_STRETCH = 1.08;
/** Each shoulder should be at least this wide, or the neck slides off. */
export const MIN_SHOULDER_IN = 1.25;

// The V-depth rule (fraction/floor/cap) lives in the leaf neckopening.ts, so the front
// can build it and the check can read it from one source; re-exported for callers.
export { MIN_V_DEPTH_IN, maxVDepthIn, vNeckDepthIn } from './neckopening';

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
  backNeck: BackNeckStyle = 'scoop',
  opts: GarmentOptions = {},
): FitReport {
  const w = garmentWidths(size, style, shoulder);
  const bodyLength = opts.bodyLength ?? 'hip';
  const neckFit = neckFitVerdict(size, neck, backNeck);
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
      // A hem above the hip never passes the hip, so the check only bites at hip length
      // or longer.
      label: 'hip clearance',
      ok: !hemReachesHip(bodyLength) || size.hip <= w.chest * HIP_STRETCH,
      detail: hemReachesHip(bodyLength)
        ? `hip ${size.hip}" vs finished ${w.chest.toFixed(1)}"`
        : `n/a (hem above hip at ${bodyLength})`,
    },
  ];

  // V depth (choice 1): proportional to the armhole, floored to read as a V, capped
  // for modesty on adults (kids are bounded by head-fit, not modesty). Tier-C-validated.
  if (neck === 'v') {
    const vDepth = vNeckDepthIn(w.armholeDepth, size);
    const capped = Number.isFinite(maxVDepthIn(size));
    checks.push({
      label: 'v depth sensible',
      ok: vDepth >= MIN_V_DEPTH_IN && vDepth <= maxVDepthIn(size),
      detail: `V drops ${vDepth.toFixed(1)}" (${capped ? `cap ${maxVDepthIn(size)}"` : 'head-fit'})`,
    });
  }

  // Drop armhole (choice 3): a drop's armhole must be deep enough for the arm — at
  // least the body arm depth, so the straight sleeve reaches the armpit.
  if (shoulder === 'drop') {
    checks.push({
      label: 'drop armhole deep enough',
      ok: w.armholeDepth >= size.arm_depth,
      detail: `drop ${w.armholeDepth.toFixed(1)}" vs arm depth ${size.arm_depth}"`,
    });
  }

  return { size: `${size.category} ${size.chest}"`, checks, allOk: checks.every((c) => c.ok) };
}
