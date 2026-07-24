/**
 * The front piece. Shared with the back from cast-on through the armhole; then the
 * neck, in one of two styles:
 *   - 'round' (crew): a shallow scoop near the top — cast off the centre, curve each
 *     side down, then short-row the shoulders.
 *   - 'v': the split happens low (the V point sits ~VNECK_POINT_ABOVE_UNDERARM_IN
 *     above the underarm) with no centre cast-off; each side decreases steadily up to
 *     the shoulder, forming the long V.
 * Both halves must end at the back's shoulder count, to graft.
 */

import type { SizeRecord, EaseStyleId, NeckStyle, ShoulderStyle, GarmentOptions } from '../data/types';
import { type Gauge, rowsFor, stitchesFor } from '../gauge';
import { type Row, carriageForRow } from '../row';
import { backPlan, panelThroughArmhole, armholeShaping, splitIntoSteps, SHOULDER_STEP_STS } from './back';
import { vNeckDepthIn, scoopDepthIn, squareDepthIn, highRoundDepthIn, NECK_CURVE_IN } from '../neckopening';
import { raglanFrontRows } from './raglan';

/** Rows the crew neck occupies below the shoulder line. */
export function frontNeckDepthRows(size: SizeRecord, gauge: Gauge): number {
  return rowsFor(size.neck_depth, gauge);
}

/**
 * A scoop's centre cast-off as a fraction of the whole front neck. Knitware's scoop
 * holds a smaller centre than a crew (~0.35 vs ~0.5) and takes the rest in a longer side
 * curve, which is what makes it read as a scoop rather than a deep crew.
 */
const SCOOP_CENTRE_FRACTION = 0.35;
/**
 * A flat front works straight to the shoulder and casts the neck off in one line, so it
 * still needs a little depth for the short-row shoulders to live in (we short-row where
 * Knitware casts the shoulder off flat at neck depth 0). Same floor the back scoop uses.
 */
const FLAT_FRONT_DROP_IN = 1.25;

/**
 * How the front neck divides, by style: the centre cast-off and the per-side curve. The
 * two must sum to the whole front neck (centre + 2·perSide = frontNeckSts). Single source
 * so the piece and the neckband pickup cannot drift. A V has no centre (splits to a
 * point); a flat casts the whole neck off straight (no side curve).
 */
export function frontNeckSplit(
  neck: NeckStyle,
  frontNeckSts: number,
  gauge: Gauge,
): { centreCastOff: number; perSide: number } {
  if (neck === 'v') return { centreCastOff: 0, perSide: 0 };
  // A square, like a flat, casts its whole neck off straight across the base; its shape
  // comes from the depth and the vertical sides above, not from a side curve.
  if (neck === 'flat' || neck === 'square') return { centreCastOff: frontNeckSts, perSide: 0 };
  const perSide =
    neck === 'scoop'
      ? Math.floor((frontNeckSts - Math.round(frontNeckSts * SCOOP_CENTRE_FRACTION)) / 2)
      : stitchesFor(NECK_CURVE_IN, gauge); // round/crew/high_round: a fixed ~1.5" curve
  return { centreCastOff: frontNeckSts - 2 * perSide, perSide };
}

/** `count` events spread as evenly as possible across `span` rows. */
function evenlySpread(count: number, span: number): number[] {
  const out: number[] = [];
  for (let i = 1; i <= count; i++) out.push(Math.round((i * span) / (count + 1)));
  return out;
}

export interface FrontNeckPlan {
  neckLineRow: number; // last full-width row before the neck splits
  neckDepthRows: number; // rows from the split to the shoulder line
  bodySts: number; // live stitches at the neck line
  frontNeckSts: number; // total removed for the neck (centre + the two edges)
  shoulderSts: number; // each shoulder — must equal the back shoulder to graft
  centreCastOff: number; // stitches cast off flat at the centre (0 for a V; full width for flat)
  perSide: number; // stitches shaped away each side (0 for V/flat)
}

export function frontNeckPlan(
  size: SizeRecord,
  style: EaseStyleId,
  gauge: Gauge,
  neck: NeckStyle = 'round',
  shoulder: ShoulderStyle = 'set_in',
  opts: GarmentOptions = {},
): FrontNeckPlan {
  const plan = backPlan(size, style, gauge, shoulder, 'scoop', opts);
  const bodySts = armholeShaping(plan.bodySts, plan.upperBackSts).achievedSts;
  const shoulderSts = Math.round((bodySts - plan.backNeckSts) / 2); // match the back
  const frontNeckSts = bodySts - 2 * shoulderSts;
  // Depth by style: a V is ~a fraction of the armhole (floored/capped); a scoop is a
  // deeper fraction; a flat sits at the shoulder line (just the short-row floor); a crew
  // is the measured neck depth.
  const armholeDepthIn = plan.armholeRows * (4 / gauge.bodyRow);
  const neckDepthRows =
    neck === 'v'
      ? rowsFor(vNeckDepthIn(armholeDepthIn, size), gauge)
      : neck === 'scoop'
        ? rowsFor(scoopDepthIn(armholeDepthIn, size), gauge)
        : neck === 'square'
          ? rowsFor(squareDepthIn(size), gauge)
          : neck === 'high_round'
            ? rowsFor(highRoundDepthIn(size), gauge)
            : neck === 'flat'
              ? rowsFor(FLAT_FRONT_DROP_IN, gauge)
              : frontNeckDepthRows(size, gauge);
  const { centreCastOff, perSide } = frontNeckSplit(neck, frontNeckSts, gauge);
  return {
    // Piece-row register: a folded hem's facing makes the piece taller than the garment.
    neckLineRow: plan.pieceTotalRows - neckDepthRows,
    neckDepthRows,
    bodySts,
    frontNeckSts,
    shoulderSts,
    centreCastOff,
    perSide,
  };
}

/** The front from cast-on up to the neck line (before the neck splits). */
export function frontToNeck(
  size: SizeRecord,
  style: EaseStyleId,
  gauge: Gauge,
  neck: NeckStyle = 'round',
  shoulder: ShoulderStyle = 'set_in',
  opts: GarmentOptions = {},
): Row[] {
  const rows = panelThroughArmhole('front', size, style, gauge, shoulder, opts);
  const { neckLineRow } = frontNeckPlan(size, style, gauge, neck, shoulder, opts);
  let index = rows.length;
  const stitches = rows[rows.length - 1].stitches;
  while (index < neckLineRow) {
    index += 1;
    rows.push({
      index,
      piece: 'front',
      stitches,
      carriage: carriageForRow(index),
      ops: [],
      section: 'upper_front',
    });
  }
  return rows;
}

/** Crew-neck edge shaping for one side: a couple of cast-offs, then the rest decreased. */
export function frontNeckShaping(perSide: number): { castOffs: number[]; decs: number } {
  const co1 = Math.min(3, perSide);
  const co2 = Math.min(2, Math.max(0, perSide - co1));
  return { castOffs: [co1, co2].filter((n) => n > 0), decs: perSide - co1 - co2 };
}

/**
 * The complete front piece, for the chosen neck style. Shared to the neck line, then
 * split into a left and right half worked separately up to their shoulders (which
 * short-row to match the back). Rows after the split carry `side`, and `stitches`
 * counts the half being worked (the row counter resets at the split and per side).
 */
export function frontRows(
  size: SizeRecord,
  style: EaseStyleId,
  gauge: Gauge,
  neck: NeckStyle = 'round',
  shoulder: ShoulderStyle = 'set_in',
  opts: GarmentOptions = {},
): Row[] {
  if (shoulder === 'raglan') return raglanFrontRows(size, style, gauge, neck, opts);
  const rows = frontToNeck(size, style, gauge, neck, shoulder, opts);
  const fp = frontNeckPlan(size, style, gauge, neck, shoulder, opts);
  const shoulderSteps = splitIntoSteps(fp.shoulderSts, SHOULDER_STEP_STS);
  const perSide = fp.perSide;
  const centreCastOff = fp.centreCastOff; // full front-neck width for a flat; 0 for a V

  let index = rows.length;

  // Split row: a V just divides (no centre cast-off); every other style casts off its
  // centre (a flat casts off the whole front neck straight across in one line).
  index += 1;
  rows.push({
    index,
    piece: 'front',
    stitches: fp.bodySts - centreCastOff, // both halves still live
    carriage: carriageForRow(index),
    ops: neck === 'v' ? [] : [{ kind: 'bind_off', count: centreCastOff, side: 'center' }],
    section: 'neck_split',
  });

  const workHalf = (side: 'left' | 'right'): void => {
    const neckEdge: 'L' | 'R' = side === 'left' ? 'R' : 'L'; // centre-facing edge
    const armEdge: 'L' | 'R' = side === 'left' ? 'L' : 'R';
    let sts = neck === 'v' ? Math.floor((fp.bodySts - centreCastOff) / 2) : fp.shoulderSts + perSide;
    let used = 0;
    const push = (ops: Row['ops'], section: string): void => {
      index += 1;
      used += 1;
      for (const op of ops) {
        if (op.kind === 'bind_off') sts -= op.count;
        if (op.kind === 'decrease') sts -= op.count;
        // hold: still live, no change
      }
      rows.push({ index, piece: 'front', stitches: sts, carriage: carriageForRow(index), ops, section, side });
    };

    const fillToShoulder = (): void => {
      const straight = Math.max(0, fp.neckDepthRows - used - 2 * shoulderSteps.length);
      for (let i = 0; i < straight; i++) push([], 'upper_front');
    };

    if (neck === 'v') {
      // Steady neck-edge decreases from the half width down to the shoulder, spread
      // over the deep V (leaving room for the shoulder short-rows at the top).
      const decsNeeded = sts - fp.shoulderSts;
      const shaperRows = Math.max(decsNeeded, fp.neckDepthRows - 2 * shoulderSteps.length);
      const decAt = new Set(evenlySpread(decsNeeded, shaperRows));
      for (let r = 1; r <= shaperRows; r++) {
        push(decAt.has(r) ? [{ kind: 'decrease', count: 1, side: neckEdge }] : [], 'neck');
      }
    } else if (neck === 'flat' || neck === 'square') {
      // Flat/square: the whole neck came off at the split; nothing to shape at the sides,
      // straight up to the shoulder. A square's depth (set in the plan) makes those straight
      // sides tall and vertical; a flat sits just off the shoulder line.
      fillToShoulder();
    } else if (neck === 'scoop' || neck === 'high_round') {
      // Scoop / high round: a centre came off; the rest is a side curve of decreases only
      // (no cast-off step), spread over the depth, then straight to the shoulder. A high
      // round is the shallow case — its short depth packs the decreases to about every row.
      const shaperRows = Math.max(perSide, fp.neckDepthRows - 2 * shoulderSteps.length);
      const decAt = new Set(evenlySpread(perSide, shaperRows));
      for (let r = 1; r <= shaperRows; r++) {
        push(decAt.has(r) ? [{ kind: 'decrease', count: 1, side: neckEdge }] : [], 'neck');
      }
    } else {
      // Crew: cast-offs, then decreases every other row, then straight to the shoulder.
      const shaping = frontNeckShaping(perSide);
      for (const co of shaping.castOffs) {
        push([{ kind: 'bind_off', count: co, side: neckEdge }], 'neck');
        push([], 'neck'); // return row
      }
      for (let d = 0; d < shaping.decs; d++) {
        push([{ kind: 'decrease', count: 1, side: neckEdge }], 'neck');
        if (d < shaping.decs - 1) push([], 'neck');
      }
      fillToShoulder();
    }

    // Shape the shoulder to match the back: short-row and hold for set-in/drop (on a
    // carriage-safe row, machine-holding-hole rule), or cast off in steps for a saddle
    // (the sleeve strap seams to the cast-off edge — a row edge cannot join live stitches).
    for (const s of shoulderSteps) {
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
