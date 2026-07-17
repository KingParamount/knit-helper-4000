/**
 * Tier B — will it fit a human of that size? External fit checks: a garment can be
 * internally consistent (Tier A: it sews up) yet not go on a body.
 *
 * First check: a crew pullover must pass over the head. The head goes through the
 * geometric neck HOLE (an ellipse of neck width × total front+back depth), not the
 * neckband stitch count. A flat back makes that hole too snug on every size; the
 * back-neck scoop (neckopening.ts) opens it, solved to a comfortable stretch.
 */

import type { SizeRecord } from './data/types';
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
