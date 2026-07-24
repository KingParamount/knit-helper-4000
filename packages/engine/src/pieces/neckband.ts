/**
 * The neckband — knit as its OWN strip and sewn onto the neckline in making up (the
 * machine-knitting reality: picking a curved neck up onto the needles is awkward, so
 * we knit a band the length of the neck opening and ease it on). Cast on the count the
 * neck opening needs; that cast-on edge is the neat outer edge. Work the band, hang
 * contrast markers on the penultimate row wherever the band meets a seam (waypoints to
 * ease it on), and take it off on waste yarn — that live edge is sewn to the neckline.
 *
 * Neck styles differ at the front: a crew is a plain strip whose ends meet at the open
 * shoulder; a V mitres both ends (a fully-fashioned decrease at EACH end every row — an
 * EDGE decrease, which is knittable, unlike a centred one) so the two ends meet at the
 * centre front and seam into a clean point (see vneck-band-both-finishes).
 *
 * The count follows the neck opening: 1 st per st along cast-off edges (back neck,
 * front centre), ~3 sts per 4 rows along the shaped side edges. Depth from the neck rib.
 */

import type { SizeRecord, EaseStyleId, NeckStyle, BackNeckStyle, ShoulderStyle, Technique, CollarStyle } from '../data/types';
import { type Gauge, evenStitchesFor, ribRowsFor, rowsFor } from '../gauge';

// --- Collar depths & finish (below the pickup; calibrated to the 2026-07-24 harvest) --------
/** turtleneck depth as a fraction of the neck circumference (W36 5.0", W50 6.3"). */
const TURTLE_NECK_FACTOR = 0.37;
/** cowl depth as a multiple of the turtleneck (the harvest read 2.25× at both sizes). */
const COWL_TURTLE_RATIO = 2.25;

/** Band depth (inches) for a collar. The short bands scale with rib_neck; turtle/cowl with neck. */
export function collarDepthIn(size: SizeRecord, collar: CollarStyle): number {
  switch (collar) {
    case 'none':
      return 0;
    case 'single_band':
      return size.rib_neck;
    case 'double_band': // knit to twice the finished depth, folded to the inside
    case 'funnel':
      return 2 * size.rib_neck;
    case 'rolled_edge':
      return 2.5 * size.rib_neck;
    case 'turtleneck':
      return TURTLE_NECK_FACTOR * size.neck;
    case 'cowl':
      return COWL_TURTLE_RATIO * TURTLE_NECK_FACTOR * size.neck;
  }
}

/** A collar's stitch: rib holds its shape (bands, turtleneck); stocking rolls (rolled edge, cowl). */
export function collarStitch(collar: CollarStyle): 'rib' | 'stocking' {
  return collar === 'rolled_edge' || collar === 'cowl' ? 'stocking' : 'rib';
}
import { type Row, carriageForRow } from '../row';
import { backPlan } from './back';
import { frontNeckPlan } from './front';
import { saddleStrapWidthIn, sleevePlan } from './sleeve';
import { raglanPlan } from './raglan';

/**
 * Stitches to pick up per ROW of a vertical/shaped neck edge, for THIS gauge.
 *
 * The rule of thumb is 3 stitches for every 4 rows, and it is quoted everywhere — but
 * it is a field approximation, not an algorithm. The band has to cover a length: an
 * edge `n` rows tall measures n / rowsPerInch, and covering that takes
 * n × stitchesPerInch / rowsPerInch stitches. So the rate is the gauge's own
 * stitch-to-row ratio, and 3/4 is only right when rows and stitches sit at exactly
 * 4:3.
 *
 * Our DEFAULT_GAUGE is 30 sts × 40 rows — precisely 4:3 — so the fixed rule was exact
 * there and quietly wrong everywhere else: 7% short at 18 sts × 22.4 rows, 4% short at
 * a hand 4-ply, 3% over at aran. A band 7% short of its neckline drags the neck in.
 *
 * It also hid from the whole test suite, which swept only DEFAULT_GAUGE — the one
 * gauge at which the bug does not exist. Hence the second sweep gauge in fit.test.ts.
 */
export function pickupPerRow(gauge: Gauge): number {
  return gauge.bodySt / gauge.bodyRow;
}

/** The rule-of-thumb rate, kept for reference: exact only at a 4:3 row-to-stitch gauge. */
export const PICKUP_PER_ROW = 3 / 4;

export interface NeckbandPlan {
  backCentreSts: number; // 1:1 along the back centre cast-off
  backSidePickup: number; // each shaped back-neck side edge (the back is scooped)
  frontCentreSts: number; // 1:1 along the front centre cast-off (0 for a V)
  frontSidePickup: number; // each shaped front side edge
  strapEndSts: number; // saddle only: each strap end at the neck (0 otherwise)
  pickupTotal: number; // stitches the neck opening needs = the band cast-on
  bandRows: number; // band depth in rows (per the collar)
  mitreRows: number; // V only: rows of end-mitre shaping (0 for a crew)
  finalSts: number; // live stitches taken off on waste yarn (cast-on − the mitres)
  waypoints: number[]; // stitch positions (in the final row) where the band meets a seam
  collar: CollarStyle;
  stitch: 'rib' | 'stocking'; // rib holds its shape; stocking rolls
  fold: boolean; // double band: knit twice the depth and fold to the inside
}

export function neckbandPlan(
  size: SizeRecord,
  style: EaseStyleId,
  gauge: Gauge,
  neck: NeckStyle = 'round',
  shoulder: ShoulderStyle = 'set_in',
  backNeck: BackNeckStyle = 'scoop',
  collar: CollarStyle = 'single_band',
): NeckbandPlan {
  // A raglan neckline is different: the back neck (held) + each sleeve top (its little
  // crown) + the front neck. The sleeve crowns sit between the back and front at the
  // raglan seams, so both count in the band. There is no scooped side on the held back.
  if (shoulder === 'raglan') return raglanNeckbandPlan(size, style, gauge, collar);

  const bp = backPlan(size, style, gauge, shoulder, backNeck);
  const backCentreSts = bp.backNeckCentreSts; // centre cast-off (full width for a flat/square back)
  // Pick up along the back-neck side edge over its depth — UNLESS the back is flat, whose
  // straight cast-off has no side edge to speak of. A square back has perSide 0 (a flat base)
  // yet real vertical sides over its depth, so it must be keyed on the style, not on perSide.
  const backSidePickup = backNeck === 'flat' ? 0 : Math.round(bp.backNeckRows * pickupPerRow(gauge));
  const fp = frontNeckPlan(size, style, gauge, neck, shoulder);
  // The front centre cast-off comes straight from the piece's own split (0 for a V, whose
  // two long edges are the band's ends; the full front neck for a flat, which has no side
  // edge to pick up along). A flat front has no shaped side edge, like a flat back.
  const frontCentreSts = fp.centreCastOff;
  const frontSidePickup = neck === 'flat' ? 0 : Math.round(fp.neckDepthRows * pickupPerRow(gauge));
  // A saddle's two straps run up to the neck, so each strap end joins the neck at the
  // shoulder. Only about half the strap width faces the neck arc (the rest turns into the
  // shoulder line), which matches Knitware's pickup (6 of a 12-st strap).
  const strapEndSts =
    shoulder === 'saddle' ? Math.round(evenStitchesFor(saddleStrapWidthIn(size), gauge) / 2) : 0;
  // Cast on odd (extra on the right) so both selvedges are knit stitches.
  const raw = backCentreSts + 2 * backSidePickup + frontCentreSts + 2 * frontSidePickup + 2 * strapEndSts;
  const pickupTotal = raw % 2 === 0 ? raw + 1 : raw;

  const stitch = collarStitch(collar);
  const depthIn = collarDepthIn(size, collar);
  // Rib holds its row gauge (tighter); a stocking band takes the body row gauge.
  const bandRows = stitch === 'rib' ? ribRowsFor(depthIn, gauge) : rowsFor(depthIn, gauge);
  // The V mitre eats a triangle at each end over the band depth (a ~45° corner for
  // square gauge); a crew has no mitre. Clamp so it never runs past the front-side edge.
  const mitreRows =
    neck === 'v' ? Math.max(0, Math.min(bandRows - 2, frontSidePickup - 1)) : 0;
  const finalSts = pickupTotal - 2 * mitreRows;

  // Waypoints: the stitch positions in the final (taken-off) row that meet a seam, so
  // the knitter can ease the band on. A crew's two ends sit at the open shoulder, so its
  // one interior waypoint is the OTHER shoulder. A V's two ends sit at the centre front,
  // so both shoulders are interior. Positions are symmetric in from each end.
  const clamp = (n: number): number => Math.max(1, Math.min(finalSts - 1, n));
  const backRun = 2 * backSidePickup + backCentreSts;
  const waypoints =
    neck === 'v'
      ? [clamp(frontSidePickup - mitreRows), clamp(finalSts - (frontSidePickup - mitreRows))]
      : shoulder === 'saddle'
        ? // Both shoulders are seamed (a strap at each), so ease the band to both.
          [clamp(backRun), clamp(finalSts - backRun)]
        : [clamp(backRun)];

  return {
    backCentreSts,
    backSidePickup,
    frontCentreSts,
    frontSidePickup,
    strapEndSts,
    pickupTotal,
    bandRows,
    mitreRows,
    finalSts,
    waypoints,
    collar,
    stitch,
    fold: collar === 'double_band',
  };
}

/**
 * The raglan neckline: the held back neck, each sleeve's little crown, and the front neck
 * (centre held + a shaped side each way). The sleeve crowns sit at the raglan seams between
 * the back and the front, so both count. The band eases to the four raglan seams.
 */
function raglanNeckbandPlan(size: SizeRecord, style: EaseStyleId, gauge: Gauge, collar: CollarStyle = 'single_band'): NeckbandPlan {
  const rp = raglanPlan(size, style, gauge);
  const sleeve = sleevePlan(size, style, gauge, 'raglan');
  const backCentreSts = rp.backNeckSts; // held flat, picked up 1:1
  const frontCentreSts = rp.frontNeckCentreSts;
  const frontSidePickup = Math.round(rp.frontNeckDepthRows * pickupPerRow(gauge));
  const sleeveTopPickup = Math.max(1, Math.round(sleeve.capTopSts / 2)); // each crown, into the neck
  const raw = backCentreSts + frontCentreSts + 2 * frontSidePickup + 2 * sleeveTopPickup;
  const pickupTotal = raw % 2 === 0 ? raw + 1 : raw;
  const stitch = collarStitch(collar);
  const bandRows = stitch === 'rib' ? ribRowsFor(collarDepthIn(size, collar), gauge) : rowsFor(collarDepthIn(size, collar), gauge);
  const finalSts = pickupTotal;
  const clamp = (n: number): number => Math.max(1, Math.min(finalSts - 1, n));
  // Waypoints at the four raglan seams, in pickup order: back, L sleeve, front, R sleeve.
  const p1 = backCentreSts;
  const p2 = p1 + sleeveTopPickup;
  const p3 = p2 + frontSidePickup + frontCentreSts + frontSidePickup;
  const p4 = p3 + sleeveTopPickup;
  return {
    backCentreSts,
    backSidePickup: 0,
    frontCentreSts,
    frontSidePickup,
    strapEndSts: 0,
    pickupTotal,
    bandRows,
    mitreRows: 0,
    finalSts,
    waypoints: [clamp(p1), clamp(p2), clamp(p3), clamp(p4)],
    collar,
    stitch,
    fold: collar === 'double_band',
  };
}

export function neckbandRows(
  size: SizeRecord,
  style: EaseStyleId,
  gauge: Gauge,
  neck: NeckStyle = 'round',
  shoulder: ShoulderStyle = 'set_in',
  technique: Technique = 'machine',
  backNeck: BackNeckStyle = 'scoop',
  collar: CollarStyle = 'single_band',
): Row[] {
  // 'none' has no band at all — the neck edge is finished plain in making up.
  if (collar === 'none') return [];
  const p = neckbandPlan(size, style, gauge, neck, shoulder, backNeck, collar);
  const rows: Row[] = [];
  let index = 0;
  let stitches = 0;
  const push = (ops: Row['ops'], section: string): void => {
    index += 1;
    for (const op of ops) {
      if (op.kind === 'cast_on') stitches = op.count;
      if (op.kind === 'decrease') stitches -= op.count * (op.side === 'both' ? 2 : 1);
      // take_off / mark leave the live count unchanged.
    }
    rows.push({ index, piece: 'collar', stitches, carriage: carriageForRow(index), ops, section });
  };

  // Rib collars keep the historical 'cast_on' section (rib tension); a stocking collar (rolled
  // edge / cowl) casts on at main tension and rolls, so its cast-on is tagged 'stocking'.
  push([{ kind: 'cast_on', count: p.pickupTotal }], p.stitch === 'stocking' ? 'stocking' : 'cast_on');
  // Band body: a V mitres BOTH ends (edge decrease each end, every row); a crew is plain.
  // Leaves two rows spare — one for the marker row (penultimate), one for the take-off.
  const bodyRows = Math.max(0, p.bandRows - 2);
  for (let i = 1; i <= bodyRows; i++) {
    if (neck === 'v' && i <= p.mitreRows) {
      // The SAME two stitches leave the band either way, but from different places, and
      // the chart has to show which. A machine cannot decrease mid-bed, so its band
      // mitres at the two ends and is seamed into a point at the centre front. A hand
      // knitter picked the band up around the neckline, so the point is shaped where it
      // actually is: a centred double decrease at a marked centre stitch, which rides
      // over the top as an unbroken line down the V.
      push(
        technique === 'hand'
          ? [{ kind: 'decrease', count: 2, side: 'center' }]
          : [{ kind: 'decrease', count: 1, side: 'both' }],
        'mitre',
      );
    }
    else push([], neck === 'v' ? 'mitre' : p.stitch);
  }
  // Penultimate row: hang the waypoint markers.
  push([{ kind: 'mark', positions: p.waypoints }], 'mark');
  // Off on waste yarn — the live edge that sews to the neckline.
  push([{ kind: 'take_off', count: stitches }], 'take_off');
  return rows;
}
