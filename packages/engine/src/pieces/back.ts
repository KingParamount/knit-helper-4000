/**
 * The back piece (set-in sleeve, straight body, bottom-up flat).
 *
 * `backPlan` lays out every section with row spans and stitch counts, including
 * the shaping *targets* (the counts shaping must hit). `lowerBackRows` generates
 * the actual Row[] for the unambiguous lower sections — cast-on, rib, body to the
 * underarm. Armhole / shoulder / back-neck shaping rows are not generated yet
 * (they need the sourced shaping method — see dimensions_model.md, next step).
 */

import type {
  SizeRecord,
  EaseStyleId,
  ShoulderStyle,
  BackNeckStyle,
  BodyLength,
  HemStyle,
  GarmentOptions,
} from '../data/types';
import { garmentWidths } from '../dimensions';
import {
  type Gauge,
  stitchesFor,
  evenStitchesFor,
  rowsFor,
  ribRowsFor,
} from '../gauge';
import { type Row, type Piece, carriageForRow } from '../row';
import { SEAM_ALLOWANCE_STS, seamEdgeLength, ARMHOLE_SECTIONS } from './seams';
import { backNeckDepthRows, NECK_CURVE_IN } from '../neckopening';
import { raglanBackRows } from './raglan';
import { hemPlan } from './hem';

export interface PlanSection {
  name: string;
  startRow: number;
  endRow: number;
  rows: number;
  stitches: number;
  note?: string;
}

export interface BackPlan {
  hem: HemStyle;
  ribCastOnSts: number; // hem cast-on: odd (body + 1) for rib, 2× body for a frill, body otherwise
  bodySts: number; // even body panel = half the finished chest (after the rib drop / frill gather)
  upperBackSts: number; // between the armholes
  backNeckSts: number;
  totalRows: number; // garment length in rows, shoulder line to hem edge
  /**
   * Rows the knitted piece is TALLER than totalRows: a folded band's facing turns
   * up inside, so the piece carries those rows without adding hanging length.
   * pieceTotalRows = totalRows + facing; zero for every other hem.
   */
  pieceTotalRows: number;
  ribRows: number; // rows in the hem section of the piece (whatever the hem style)
  hemLengthRows: number; // rows the hem contributes to hanging length (≤ ribRows)
  bodyRows: number; // plain body, top of hem to underarm
  armholeRows: number; // underarm to shoulder
  backNeckRows: number; // scoop depth: rows from the back neck line to the shoulder
  backNeckPerSide: number; // stitches shaped away each side of the scoop
  backNeckCentreSts: number; // stitches cast off flat at the centre of the scoop
  sections: PlanSection[];
  shaping: {
    armholeDecTotal: number; // castOn - upperBack, split across both sides
    shoulderStsEachApprox: number;
    note: string;
  };
}

/**
 * The nape-to-shoulder rise. The raw body length (neck_to_waist + waist_to_hip) is measured
 * to the NAPE; a garment hangs from the shoulder seam, which sits below the nape by the
 * neck/shoulder rise, so that rise comes off the length. It saturates — a baby's shoulders
 * sit at the nape (~0"), an adult's neck rises ~1.5" above the shoulder — and tracks
 * neck_depth. Calibrated to Knitware's finished Body Length across all 14 harvested sizes
 * (baby → man), residual ≤ ~0.4" (2–3 rows). See knitware-shaping-diff-batch1.
 */
function neckRiseInches(size: SizeRecord): number {
  return Math.min(1.6, Math.max(0, (size.neck_depth - 1.7) * 2.3));
}

/** Every body length, hem order — shortest to longest (the UI tile and fit checks share it). */
export const BODY_LENGTHS: readonly BodyLength[] = [
  'crop',
  'waist',
  'regular',
  'hip',
  'thigh',
  'above_knee',
  'knee',
  'calf',
  'ankle',
] as const;

/**
 * Nape-to-hem for each body-length landmark. The anchors (waist, hip, knee, ankle) are
 * measured columns; the in-between values interpolate:
 *  - crop sits just below the bust — nape-to-underbust runs ~80% of nape-to-waist on
 *    the published adult sizing tables (Craft Yarn Council / standard measurement
 *    charts put underbust ~3" above the waist on a ~16" back-waist length), and the
 *    same fraction degrades gracefully down the child/baby rows;
 *  - regular is the midpoint of waist and hip ("between waist and hips", options.json);
 *  - thigh is the midpoint of hip and knee (mid-thigh);
 *  - above_knee stops 10% of waist-to-knee short of the knee (~2" on an adult,
 *    scaling down for children rather than a fixed inch);
 *  - calf is the midpoint of knee and ankle (mid-calf).
 */
function napeToHemInches(size: SizeRecord, bodyLength: BodyLength): number {
  const ntw = size.neck_to_waist;
  switch (bodyLength) {
    case 'crop':
      return 0.8 * ntw;
    case 'waist':
      return ntw;
    case 'regular':
      return ntw + 0.5 * size.waist_to_hip;
    case 'hip':
      return ntw + size.waist_to_hip;
    case 'thigh':
      return ntw + (size.waist_to_hip + size.waist_to_knee) / 2;
    case 'above_knee':
      return ntw + 0.9 * size.waist_to_knee;
    case 'knee':
      return ntw + size.waist_to_knee;
    case 'calf':
      return ntw + (size.waist_to_knee + size.waist_to_ankle) / 2;
    case 'ankle':
      return ntw + size.waist_to_ankle;
  }
}

/** Body length to the SHOULDER line (nape-to-hem, less the neck/shoulder rise). */
export function bodyLengthInches(size: SizeRecord, bodyLength: BodyLength = 'hip'): number {
  return napeToHemInches(size, bodyLength) - neckRiseInches(size);
}

export function backPlan(
  size: SizeRecord,
  style: EaseStyleId,
  gauge: Gauge,
  shoulder: ShoulderStyle = 'set_in',
  backNeck: BackNeckStyle = 'scoop',
  opts: GarmentOptions = {},
): BackPlan {
  const w = garmentWidths(size, style, shoulder);

  // Two side seams, each eating a stitch from this panel's edges — cut it wider so
  // the sewn-up garment measures what the pattern says. Adding two keeps it even.
  const bodySts = evenStitchesFor(w.chest / 2, gauge) + 2 * SEAM_ALLOWANCE_STS; // even plain panel
  const hp = hemPlan(size, gauge, opts.hem ?? 'ribbing', bodySts);
  const ribCastOnSts = hp.castOnSts;
  // A drop shoulder knits the body straight — no armhole narrowing — so the "upper
  // back" is the full body width; a set-in narrows to the across-back measurement.
  const upperBackSts = shoulder === 'drop' ? bodySts : stitchesFor(size.back_width, gauge);
  const backNeckSts = stitchesFor(size.back_neck, gauge);

  const totalRows = rowsFor(bodyLengthInches(size, opts.bodyLength), gauge);
  const ribRows = hp.pieceRows;
  const armholeRows = rowsFor(w.armholeDepth, gauge);
  const bodyRows = totalRows - armholeRows - hp.lengthRows;
  const pieceTotalRows = totalRows + (hp.pieceRows - hp.lengthRows);
  const backNeckRows = backNeckDepthRows(size, gauge, backNeck);

  // Back-neck shaping (single source for backRows and the neckband). A 'flat' back casts
  // the whole neck off straight across — no side curve (perSide 0, centre = full width),
  // which is Knitware's default crew back. A 'scoop' curves each side: the curve is
  // capped so its cast-offs + decreases fit in the scoop depth alongside the short-row
  // shoulders, and so the flat centre stays positive.
  const achieved = armholeShaping(bodySts, upperBackSts).achievedSts;
  const backShoulderSts = Math.round((achieved - backNeckSts) / 2);
  const backSteps = splitIntoSteps(backShoulderSts, SHOULDER_STEP_STS);
  const backNeckPerSide =
    backNeck === 'flat'
      ? 0
      : Math.max(
          1,
          Math.min(
            stitchesFor(NECK_CURVE_IN, gauge),
            Math.floor((backNeckRows - 2 * backSteps.length) / 2),
            Math.floor((backNeckSts - 2) / 2),
          ),
        );
  const backNeckCentreSts = backNeckSts - 2 * backNeckPerSide;

  const sections: PlanSection[] = [
    ...(ribRows > 0
      ? [
          {
            name: hp.hem === 'ribbing' ? 'rib' : hp.hem,
            startRow: 1,
            endRow: ribRows,
            rows: ribRows,
            stitches: ribCastOnSts,
          },
        ]
      : []),
    {
      name: 'body',
      startRow: ribRows + 1,
      endRow: ribRows + bodyRows,
      rows: bodyRows,
      stitches: bodySts,
    },
    {
      name: 'armhole+shoulder',
      startRow: ribRows + bodyRows + 1,
      endRow: pieceTotalRows,
      rows: armholeRows,
      stitches: upperBackSts,
      note: 'shaping — not generated yet',
    },
  ];

  return {
    hem: hp.hem,
    ribCastOnSts,
    bodySts,
    upperBackSts,
    backNeckSts,
    totalRows,
    pieceTotalRows,
    ribRows,
    hemLengthRows: hp.lengthRows,
    bodyRows,
    armholeRows,
    backNeckRows,
    backNeckPerSide,
    backNeckCentreSts,
    sections,
    shaping: {
      armholeDecTotal: bodySts - upperBackSts,
      shoulderStsEachApprox: Math.round((upperBackSts - backNeckSts) / 2),
      note: 'armhole narrows body->upperBack; top splits into two shoulders + back neck',
    },
  };
}

/**
 * Row[] for the lower body panel: cast-on, rib, and plain body to the underarm.
 * Shared by front and back (identical below the neck for a straight pullover).
 */
export function lowerPanelRows(
  piece: Piece,
  size: SizeRecord,
  style: EaseStyleId,
  gauge: Gauge,
  shoulder: ShoulderStyle = 'set_in',
  opts: GarmentOptions = {},
): Row[] {
  const plan = backPlan(size, style, gauge, shoulder, 'scoop', opts);
  const hp = hemPlan(size, gauge, plan.hem, plan.bodySts);
  const lastPlainRow = plan.ribRows + plan.bodyRows; // underarm
  const firstBodyRow = plan.ribRows + 1;
  const rows: Row[] = [];
  for (let index = 1; index <= lastPlainRow; index++) {
    const inHem = index <= plan.ribRows;
    // The hem sets the cast-on and the change-row ops: rib is cast on odd (bodySts + 1)
    // and drops the extra stitch at the change to stocking, so both rib selvedges are
    // knit stitches; a frill casts on double and gathers across on the first body row;
    // a folded band picks its cast-on edge up and knits the hem closed on its last row.
    let ops: Row['ops'] = [];
    if (index === 1) ops = [{ kind: 'cast_on', count: plan.ribCastOnSts }, ...hp.opsAt(index)];
    else if (inHem) ops = hp.opsAt(index);
    else if (index === firstBodyRow) ops = hp.firstBodyOps;
    rows.push({
      index,
      piece,
      stitches: inHem ? plan.ribCastOnSts : plan.bodySts,
      carriage: carriageForRow(index),
      ops,
      section: inHem ? hp.sectionAt(index) : 'body',
    });
  }
  return rows;
}

/** Lower back rows (thin wrapper over the shared panel). */
export function lowerBackRows(
  size: SizeRecord,
  style: EaseStyleId,
  gauge: Gauge,
  shoulder: ShoulderStyle = 'set_in',
  opts: GarmentOptions = {},
): Row[] {
  return lowerPanelRows('back', size, style, gauge, shoulder, opts);
}

/** One phase of the graduated decrease: `times` single decreases, one every `everyRows` rows. */
export interface DecPhase {
  everyRows: number; // 1 = every row, 2 = every other row, 4 = every 4th row
  times: number;
}

export interface ArmholeShaping {
  castOffPerSide: number; // underarm cast-off, each side (single step — see machine-castoff note)
  phases: DecPhase[]; // graduated: steep at the underarm, easing toward the shoulder
  achievedSts: number; // stitches remaining after shaping
}

/**
 * Graduated set-in armhole shaping for a curved scye: cast off ~1" at the underarm
 * each side, then decrease one stitch each end at a rate that eases as it climbs —
 * fast at the bottom (every row), then every other row, then every 4th near the top.
 * A curved armhole cups the sleeve cap better than a straight taper. Standard
 * three-phase set-in construction (steep→gentle); the sleeve cap is generated to
 * match. Decreases are recorded technique-neutrally ("dec 1 st each end").
 */
export function armholeShaping(
  castOnSts: number,
  targetSts: number,
): ArmholeShaping {
  const perSide = Math.round((castOnSts - targetSts) / 2);
  // The underarm cast-off scales with garment WIDTH, not a fixed inch. Knitware casts
  // off ~5% of the half-chest panel across the whole range (baby ~2 → large adult ~8);
  // matched to the stitch on 12 of 13 harvested sizes. A fixed 1" over-cuts small sizes
  // (a baby lost 5 where Knitware takes 2) and under-cuts large ones. Capped at perSide
  // (never more than the whole armhole decrease — a tiny armhole is all cast-off, no taper).
  const castOffPerSide = Math.min(perSide, Math.round(0.05 * castOnSts));
  const d = Math.max(0, perSide - castOffPerSide);
  const fast = Math.round(d * 0.3); // every row
  const gentle = Math.round(d * 0.2); // every 4th row
  const medium = d - fast - gentle; // every other row (the bulk)
  const phases: DecPhase[] = [
    { everyRows: 1, times: fast },
    { everyRows: 2, times: medium },
    { everyRows: 4, times: gentle },
  ].filter((p) => p.times > 0);
  return { castOffPerSide, phases, achievedSts: castOnSts - 2 * perSide };
}

/**
 * A body panel from cast-on through the armhole decreases (ends at the achieved
 * back width). Shared by front and back. Above this each piece differs: the back
 * goes straight to the shoulders + flat neck; the front adds the neck curve.
 */
export function panelThroughArmhole(
  piece: Piece,
  size: SizeRecord,
  style: EaseStyleId,
  gauge: Gauge,
  shoulder: ShoulderStyle = 'set_in',
  opts: GarmentOptions = {},
): Row[] {
  const plan = backPlan(size, style, gauge, shoulder, 'scoop', opts);
  const rows = lowerPanelRows(piece, size, style, gauge, shoulder, opts);
  // A drop shoulder has no armhole shaping — the body runs straight; the armhole
  // region is just the upper part of the straight side, added above by the piece.
  if (shoulder === 'drop') return rows;
  const shaping = armholeShaping(plan.bodySts, plan.upperBackSts);

  let index = rows.length; // last body row (underarm)
  let stitches = plan.bodySts;
  const push = (ops: Row['ops']): void => {
    index += 1;
    for (const op of ops) {
      if (op.kind === 'bind_off') stitches -= op.count;
      if (op.kind === 'decrease') stitches -= op.count * (op.side === 'both' ? 2 : 1);
    }
    rows.push({ index, piece, stitches, carriage: carriageForRow(index), ops, section: 'armhole' });
  };

  // Underarm cast-off, one side per row (a block cast-off follows the carriage).
  push([{ kind: 'bind_off', count: shaping.castOffPerSide, side: carriageForRow(index + 1) }]);
  push([{ kind: 'bind_off', count: shaping.castOffPerSide, side: carriageForRow(index + 1) }]);
  // Graduated single decreases each end: (everyRows-1) plain rows, then a decrease row.
  for (const phase of shaping.phases) {
    for (let t = 0; t < phase.times; t++) {
      for (let p = 0; p < phase.everyRows - 1; p++) push([]); // plain rows
      push([{ kind: 'decrease', count: 1, side: 'both' }]); // decrease row
    }
  }
  return rows;
}

/** The back through the armhole (thin wrapper over the shared panel). */
export function backThroughArmhole(
  size: SizeRecord,
  style: EaseStyleId,
  gauge: Gauge,
  shoulder: ShoulderStyle = 'set_in',
  opts: GarmentOptions = {},
): Row[] {
  return panelThroughArmhole('back', size, style, gauge, shoulder, opts);
}

/**
 * Stitches per short-row shoulder step. ~5 gives a ~1" shoulder slope at the
 * target size (5 steps × 2 rows = 10 rows ≈ 1"), the standard set-in drop.
 */
export const SHOULDER_STEP_STS = 5;

/** Split `total` stitches into near-equal steps of roughly `target` each. */
export function splitIntoSteps(total: number, target: number): number[] {
  const steps = Math.max(1, Math.round(total / target));
  const base = Math.floor(total / steps);
  const extra = total - base * steps;
  return Array.from({ length: steps }, (_, i) => base + (i < extra ? 1 : 0));
}

/**
 * The complete back piece: cast-on → rib → body → curved armhole → straight to the
 * back neck line → a scooped back neck (split, each half's neck edge shaped down to
 * the shoulder) → short-row shoulders held for grafting.
 *
 * The back neck is scooped, not a flat cast-off: real crews drop the back neck, and
 * the scoop is what opens the neck enough to pass the head (see neckopening.ts). The
 * construction mirrors the front's crew neck at a shallower, solved depth; the curve
 * (perSide) is capped so it fits inside that depth alongside the short-row shoulders.
 * Held shoulder stitches stay live for grafting, so `stitches` counts live needles.
 */
export function backRows(
  size: SizeRecord,
  style: EaseStyleId,
  gauge: Gauge,
  shoulder: ShoulderStyle = 'set_in',
  backNeck: BackNeckStyle = 'scoop',
  opts: GarmentOptions = {},
): Row[] {
  // A raglan back is a different construction (a straight diagonal to the neck, no shoulder);
  // it is built in its own module. (Runtime-only import cycle — both are called, not loaded.)
  if (shoulder === 'raglan') return raglanBackRows(size, style, gauge, opts);
  const plan = backPlan(size, style, gauge, shoulder, backNeck, opts);
  const rows = backThroughArmhole(size, style, gauge, shoulder, opts);
  const achieved = rows[rows.length - 1].stitches;
  const backNeckSts = plan.backNeckSts;
  const shoulderSts = Math.round((achieved - backNeckSts) / 2);
  const steps = splitIntoSteps(shoulderSts, SHOULDER_STEP_STS);
  const depth = plan.backNeckRows;
  const perSide = plan.backNeckPerSide;
  const centreCastOff = plan.backNeckCentreSts;
  const co1 = Math.min(3, perSide);
  const co2 = Math.min(2, Math.max(0, perSide - co1));
  const castOffs = [co1, co2].filter((n) => n > 0);
  const decs = perSide - co1 - co2;

  let index = rows.length;

  // Straight to the back neck line (leaving `depth` rows for the scoop + shoulders).
  // Heights are in piece rows (a folded hem's facing makes the piece taller than the
  // garment), so the piece total is the right register here.
  const straightToSplit = Math.max(0, plan.pieceTotalRows - depth - rows.length);
  for (let i = 0; i < straightToSplit; i++) {
    index += 1;
    rows.push({ index, piece: 'back', stitches: achieved, carriage: carriageForRow(index), ops: [], section: 'upper_back' });
  }

  // Split: cast off the centre back neck; the two halves are worked separately.
  index += 1;
  rows.push({
    index,
    piece: 'back',
    stitches: achieved - centreCastOff, // both halves still live
    carriage: carriageForRow(index),
    ops: [{ kind: 'bind_off', count: centreCastOff, side: 'center' }],
    section: 'neck_split',
  });

  const workHalf = (side: 'left' | 'right'): void => {
    const neckEdge: 'L' | 'R' = side === 'left' ? 'R' : 'L'; // centre-facing edge
    const armEdge: 'L' | 'R' = side === 'left' ? 'L' : 'R';
    let sts = shoulderSts + perSide;
    let used = 0;
    const push = (ops: Row['ops'], section: string): void => {
      index += 1;
      used += 1;
      for (const op of ops) {
        if (op.kind === 'bind_off') sts -= op.count;
        if (op.kind === 'decrease') sts -= op.count;
        // hold: still live, no change
      }
      rows.push({ index, piece: 'back', stitches: sts, carriage: carriageForRow(index), ops, section, side });
    };
    // Neck-edge curve: cast-offs, then decreases every other row.
    for (const co of castOffs) {
      push([{ kind: 'bind_off', count: co, side: neckEdge }], 'neck');
      push([], 'neck'); // return row
    }
    for (let d = 0; d < decs; d++) {
      push([{ kind: 'decrease', count: 1, side: neckEdge }], 'neck');
      if (d < decs - 1) push([], 'neck');
    }
    // Straight to the shoulder line, then shape the shoulder. A set-in/drop shoulder is
    // short-rowed and held live for a three-needle join (held only on a carriage-safe row
    // so it does not hole — the machine-holding-hole rule). A saddle shoulder is CAST OFF
    // in the same steps instead, because the sleeve's saddle strap seams to it (a row edge
    // cannot join to live stitches). Slope rate matches the front.
    const straight = Math.max(0, depth - used - 2 * steps.length);
    for (let i = 0; i < straight; i++) push([], 'upper_back');
    for (const s of steps) {
      if (shoulder === 'saddle') {
        push([{ kind: 'bind_off', count: s, side: armEdge }], 'shoulder');
        push([], 'shoulder'); // return row
      } else {
        if (carriageForRow(index + 1) !== armEdge) push([], 'shoulder'); // wait for the safe row
        push([{ kind: 'hold', count: s, side: armEdge }], 'shoulder');
      }
    }
  };

  workHalf('left');
  workHalf('right');
  return rows;
}

/** Length (inches) of one curved armhole edge, underarm to shoulder — what the cap sews to. */
export function armholeSeamLength(size: SizeRecord, style: EaseStyleId, gauge: Gauge): number {
  return seamEdgeLength(backRows(size, style, gauge), ARMHOLE_SECTIONS, gauge);
}

/** The armhole opening the sleeve eases into: back edge + front edge (identical shaping). */
export function armholeOpening(size: SizeRecord, style: EaseStyleId, gauge: Gauge): number {
  return 2 * armholeSeamLength(size, style, gauge);
}
