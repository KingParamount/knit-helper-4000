/**
 * Assembly invariants — a reader over the generated row arrays that checks the
 * pieces actually fit *each other*: can the garment be sewn up?
 *
 * These are geometric facts, independent of any external pattern or oracle. A
 * garment can be internally consistent (sews up) yet the wrong size, or the right
 * size yet not sew up — two orthogonal properties. This module is only the first:
 * the shoulders must graft, the side seams must match, the sleeve underarm must
 * meet the body underarm, the back neck must close, and — the hard one — the
 * sleeve-cap edge must ease into the armhole it sews into.
 *
 * The original's manual states the target directly: a set-in classic cap is
 * "designed to fit exactly into the armhole" (sweaters manual, set-in shoulder).
 * Prose is ours; the geometric fact is not authored, so we check it.
 */

import type { SizeRecord, EaseStyleId, NeckStyle, BackNeckStyle, ShoulderStyle, GarmentOptions } from '../data/types';
import type { Gauge } from '../gauge';
import { garmentWidths } from '../dimensions';
import { backPlan, armholeShaping, lowerPanelRows, armholeOpening } from './back';
import { frontNeckPlan } from './front';
import { sleevePlan, sleeveRows } from './sleeve';
import { raglanPlan, raglanBackRows, raglanFrontRows } from './raglan';
import { armholeBandPlan } from './armhole-band';
import { boatPlan, boatPieceRows } from './boat';
import { pickupPerRow } from './neckband';
import { seamEdgeLength, CAP_SECTIONS } from './seams';

// Re-exported so callers have one import for the whole assembly surface.
export { seamEdgeLength } from './seams';
export { armholeSeamLength, armholeOpening } from './back';

/** The sleeve-cap sewn perimeter: two curved side edges + the flat crown. */
export function capPerimeter(size: SizeRecord, style: EaseStyleId, gauge: Gauge): number {
  const cap = seamEdgeLength(sleeveRows('sleeve_l', size, style, gauge), CAP_SECTIONS, gauge);
  const crown = sleevePlan(size, style, gauge).capTopSts * (4 / gauge.bodySt);
  return 2 * cap + crown;
}

/**
 * Raw tape-length ratio of the cap perimeter to the armhole opening, minus one. A
 * geometric diagnostic ONLY — NOT the cap-fit criterion. It reads high (~+20–26%) for
 * a correctly-filled set-in cap because the cap edge is a diagonal staircase whose
 * tape runs far longer than a near-vertical armhole edge; the two are sewn row-for-row,
 * not tape-to-tape. The fit test is the row/height fill in `assemblyReport` (a cap that
 * fills ~0.85 of the armhole depth), not this number.
 */
export function capEase(size: SizeRecord, style: EaseStyleId, gauge: Gauge): number {
  return capPerimeter(size, style, gauge) / armholeOpening(size, style, gauge) - 1;
}

export interface Invariant {
  label: string;
  ok: boolean;
  detail: string;
}

export interface AssemblyReport {
  size: string;
  invariants: Invariant[];
  allOk: boolean;
}

/**
 * Every assembly invariant for one garment. Tolerances: counts that must graft or
 * seam allow a 1-stitch slack (the documented L/R short-row discrepancy); the cap
 * ease must be a small non-negative fraction — negative means the cap is too short
 * to reach round the armhole, and much over ~10% means it will pucker at the head.
 */
export function assemblyReport(
  size: SizeRecord,
  style: EaseStyleId,
  gauge: Gauge,
  neck: NeckStyle = 'round',
  shoulder: ShoulderStyle = 'set_in',
  backNeck: BackNeckStyle = 'scoop',
  opts: GarmentOptions = {},
): AssemblyReport {
  // Raglan has no cap or shoulder graft — its invariants are different (the four raglan
  // seams match row-for-row and the pieces meet at the neck), so it is reported separately.
  if (shoulder === 'raglan') return raglanAssemblyReport(size, style, gauge, neck, opts);
  // Sleeveless has no sleeve join at all — an armhole band round each armhole instead.
  if (opts.sleeveLength === 'sleeveless') return sleevelessAssemblyReport(size, style, gauge, neck, shoulder, backNeck, opts);
  // A boat has no neck shaping, no shoulder graft and no separate neckband — its top is a
  // straight edge with an integral band, butt-seamed part way in from each armhole.
  if (neck === 'boat') return boatAssemblyReport(size, style, gauge, shoulder, opts);

  const bp = backPlan(size, style, gauge, shoulder, backNeck, opts);
  const shaping = armholeShaping(bp.bodySts, bp.upperBackSts);
  const achieved = shaping.achievedSts;
  const backShoulder = Math.round((achieved - bp.backNeckSts) / 2);
  const front = frontNeckPlan(size, style, gauge, neck, shoulder, opts);
  const sleeve = sleevePlan(size, style, gauge, shoulder, opts);

  const backSide = lowerPanelRows('back', size, style, gauge, shoulder, opts).length;
  const frontSide = lowerPanelRows('front', size, style, gauge, shoulder, opts).length;

  // The sleeve↔body join. Set-in eases a fitted cap into the shaped armhole; drop
  // sews a straight sleeve top (its width) to the armhole opening (2 × depth).
  const sw = 4 / gauge.bodySt;
  let join: Invariant;
  if (shoulder === 'drop') {
    const sleeveTopIn = sleeve.sleeveTopSts * sw;
    const armholeOpenIn = 2 * garmentWidths(size, style, 'drop').armholeDepth;
    const dPct = ((sleeveTopIn - armholeOpenIn) / armholeOpenIn) * 100;
    join = {
      label: 'sleeve top fits armhole',
      ok: Math.abs(dPct) <= 4,
      detail: `sleeve top ${sleeveTopIn.toFixed(1)}" ≈ armhole ${armholeOpenIn.toFixed(1)}"`,
    };
  } else {
    // A set-in cap sews to the armhole selvedge ROW-FOR-ROW, so the two edges match
    // by row count: the cap must fill nearly the whole armhole depth. (NOT by tape-
    // length — the cap's diagonal staircase lets a short, flat cap fake a tape-match
    // to a tall vertical armhole; that blind spot passed a 0.55×-armhole cap. See
    // sleeve.ts CAP_FILL.) Real men's caps fill ~0.79–0.89 (Berroco Anthony).
    const rowH = 4 / gauge.bodyRow;
    const capHeightIn = sleeve.capHeightRows * rowH;
    const armholeDepthIn = garmentWidths(size, style, 'set_in').armholeDepth;
    const fill = capHeightIn / armholeDepthIn;
    join = {
      label: 'cap fits armhole',
      ok: fill >= 0.78 && fill <= 0.95,
      detail: `cap fills ${(fill * 100).toFixed(0)}% of the armhole (${capHeightIn.toFixed(1)}"/${armholeDepthIn.toFixed(1)}")`,
    };
  }

  const invariants: Invariant[] = [
    {
      label: 'shoulder graft',
      ok: Math.abs(backShoulder - front.shoulderSts) <= 1,
      detail: `back ${backShoulder} = front ${front.shoulderSts}`,
    },
    {
      label: 'side seam',
      ok: backSide === frontSide,
      detail: `back ${backSide} = front ${frontSide} rows`,
    },
    {
      label: 'underarm meet',
      ok: sleeve.underarmCastOff === shaping.castOffPerSide,
      detail: `sleeve ${sleeve.underarmCastOff} = body ${shaping.castOffPerSide}`,
    },
    {
      label: 'back neck closes',
      ok: Math.abs(achieved - (2 * backShoulder + bp.backNeckSts)) <= 1,
      detail: `2×${backShoulder} + ${bp.backNeckSts} ≈ ${achieved}`,
    },
    join,
  ];

  // A saddle's strap seams along the shoulder, so its length (rows) must match the shoulder
  // width the shoulder edge spans (in rows) — otherwise the strap and shoulder don't meet.
  if (shoulder === 'saddle') {
    const shoulderWidthRows = Math.round((backShoulder * gauge.bodyRow) / gauge.bodySt);
    invariants.push({
      label: 'saddle strap spans the shoulder',
      ok: Math.abs(sleeve.strapRows - shoulderWidthRows) <= 1,
      detail: `strap ${sleeve.strapRows} rows ≈ shoulder ${shoulderWidthRows} rows`,
    });
  }

  return {
    size: `${size.category} ${size.chest}"`,
    invariants,
    allOk: invariants.every((i) => i.ok),
  };
}

/**
 * Raglan assembly: no cap, no shoulder graft. The four raglan seams (2 body edges + 2
 * sleeve edges) match ROW-FOR-ROW because body and sleeve share the raglan span; the back
 * neck comes off held for the band, and the front decreases close to almost nothing at the
 * top (that remainder is part of the raglan seam, not the neck).
 */
function raglanAssemblyReport(
  size: SizeRecord,
  style: EaseStyleId,
  gauge: Gauge,
  neck: NeckStyle,
  opts: GarmentOptions = {},
): AssemblyReport {
  const rp = raglanPlan(size, style, gauge, opts);
  const sleeve = sleevePlan(size, style, gauge, 'raglan', opts);
  const back = raglanBackRows(size, style, gauge, opts);
  const front = raglanFrontRows(size, style, gauge, neck, opts);
  const backLower = lowerPanelRows('back', size, style, gauge, 'raglan', opts).length;
  const frontLower = lowerPanelRows('front', size, style, gauge, 'raglan', opts).length;
  const backNeck = back[back.length - 1].ops.find((o) => o.kind === 'take_off')?.count ?? 0;
  // The half-end remainders are the neck-section cast-offs (NOT the underarm cast-offs,
  // which are in the armhole section, nor the centre-front cast-off).
  const halfEnds = front
    .filter((r) => r.section === 'neck' && r.ops.some((o) => o.kind === 'bind_off' && o.side !== 'center'))
    .map((r) => (r.ops.find((o) => o.kind === 'bind_off') as { count: number }).count);
  const maxHalfEnd = halfEnds.length ? Math.max(...halfEnds) : 0;

  const invariants: Invariant[] = [
    {
      label: 'side seam',
      ok: backLower === frontLower,
      detail: `back ${backLower} = front ${frontLower} rows`,
    },
    {
      label: 'underarm meet',
      ok: sleeve.underarmCastOff === rp.underarmCastOff,
      detail: `sleeve ${sleeve.underarmCastOff} = body ${rp.underarmCastOff}`,
    },
    {
      // Body and sleeve raglan edges span the same rows, so they seam row-for-row.
      label: 'raglan seams match',
      ok: Math.abs(rp.ragRows - sleeve.capHeightRows) <= 1,
      detail: `body ${rp.ragRows} ≈ sleeve ${sleeve.capHeightRows} rows`,
    },
    {
      // The front raglan + neck decreases consume each half to about the sleeve crown.
      label: 'front neck closes',
      ok: maxHalfEnd <= sleeve.capTopSts + 1,
      detail: `front halves finish at ≤ ${maxHalfEnd} st (crown ${sleeve.capTopSts})`,
    },
    {
      label: 'back neck held',
      ok: backNeck > 0 && Math.abs(backNeck - rp.backNeckSts) <= 1,
      detail: `${backNeck} sts held for the band`,
    },
  ];
  return { size: `${size.category} ${size.chest}"`, invariants, allOk: invariants.every((i) => i.ok) };
}

/**
 * Sleeveless assembly: no sleeve, no cap, no underarm-meet. The body still grafts at the
 * shoulders, seams at the sides and closes the back neck; in place of the sleeve join,
 * each armhole gets a band whose pickup must match the armhole edge it sews round.
 */
function sleevelessAssemblyReport(
  size: SizeRecord,
  style: EaseStyleId,
  gauge: Gauge,
  neck: NeckStyle,
  shoulder: ShoulderStyle,
  backNeck: BackNeckStyle,
  opts: GarmentOptions,
): AssemblyReport {
  const bp = backPlan(size, style, gauge, shoulder, backNeck, opts);
  const shaping = armholeShaping(bp.bodySts, bp.upperBackSts);
  const achieved = shaping.achievedSts;
  const backShoulder = Math.round((achieved - bp.backNeckSts) / 2);
  const front = frontNeckPlan(size, style, gauge, neck, shoulder, opts);
  const band = armholeBandPlan(size, style, gauge, shoulder);

  const backSide = lowerPanelRows('back', size, style, gauge, shoulder, opts).length;
  const frontSide = lowerPanelRows('front', size, style, gauge, shoulder, opts).length;

  // The armhole the band sews round: two curved/straight edges (front + back) plus the
  // two flat underarm bases, in stitch-equivalents at this gauge — the same figure the
  // band derived its pickup from, checked here as an independent reconciliation.
  const edgeRows = 2 * bp.armholeRows + 2 * band.underarmCastOff;
  const expected = Math.round(edgeRows * pickupPerRow(gauge));

  const invariants: Invariant[] = [
    {
      label: 'shoulder graft',
      ok: Math.abs(backShoulder - front.shoulderSts) <= 1,
      detail: `back ${backShoulder} = front ${front.shoulderSts}`,
    },
    {
      label: 'side seam',
      ok: backSide === frontSide,
      detail: `back ${backSide} = front ${frontSide} rows`,
    },
    {
      label: 'back neck closes',
      ok: Math.abs(achieved - (2 * backShoulder + bp.backNeckSts)) <= 1,
      detail: `2×${backShoulder} + ${bp.backNeckSts} ≈ ${achieved}`,
    },
    {
      label: 'armhole band fits the armhole',
      ok: Math.abs(band.pickupTotal - expected) <= 1,
      detail: `band ${band.pickupTotal} ≈ armhole ${expected} sts`,
    },
  ];
  return { size: `${size.category} ${size.chest}"`, invariants, allOk: invariants.every((i) => i.ok) };
}

/**
 * Boat assembly: the front and back are the same straight-topped piece, so there is no
 * shoulder graft and no neckband. What must hold: the two pieces match, the sleeve fits
 * the armhole (as for any set-in/drop), and the butt-seam leaves a real, positive opening.
 */
function boatAssemblyReport(
  size: SizeRecord,
  style: EaseStyleId,
  gauge: Gauge,
  shoulder: ShoulderStyle,
  opts: GarmentOptions,
): AssemblyReport {
  const boat = boatPlan(size, style, gauge, shoulder, opts);
  const sleeve = sleevePlan(size, style, gauge, shoulder, opts);
  const backLen = boatPieceRows('back', size, style, gauge, shoulder, opts).length;
  const frontLen = boatPieceRows('front', size, style, gauge, shoulder, opts).length;

  // The sleeve↔armhole join is exactly as for a shaped-neck set-in / drop.
  let join: Invariant;
  if (shoulder === 'drop') {
    const sleeveTopIn = sleeve.sleeveTopSts * (4 / gauge.bodySt);
    const armholeOpenIn = 2 * garmentWidths(size, style, 'drop').armholeDepth;
    const dPct = ((sleeveTopIn - armholeOpenIn) / armholeOpenIn) * 100;
    join = {
      label: 'sleeve top fits armhole',
      ok: Math.abs(dPct) <= 4,
      detail: `sleeve top ${sleeveTopIn.toFixed(1)}" ≈ armhole ${armholeOpenIn.toFixed(1)}"`,
    };
  } else {
    const fill = (sleeve.capHeightRows * (4 / gauge.bodyRow)) / garmentWidths(size, style, 'set_in').armholeDepth;
    join = {
      label: 'cap fits armhole',
      ok: fill >= 0.78 && fill <= 0.95,
      detail: `cap fills ${(fill * 100).toFixed(0)}% of the armhole`,
    };
  }

  const invariants: Invariant[] = [
    {
      label: 'front and back match',
      ok: backLen === frontLen,
      detail: `back ${backLen} = front ${frontLen} rows (worked alike)`,
    },
    {
      label: 'butt-seam leaves an opening',
      ok: boat.shoulderSeamSts > 0 && boat.openingSts > 0 && boat.openingSts < boat.upperSts,
      detail: `seam ${boat.shoulderSeamSts} each, centre ${boat.openingSts} open of ${boat.upperSts}`,
    },
    join,
  ];
  return { size: `${size.category} ${size.chest}"`, invariants, allOk: invariants.every((i) => i.ok) };
}
