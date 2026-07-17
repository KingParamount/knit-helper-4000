/**
 * Schematic renderer (Phase 3) — the second renderer over the row array (see
 * CLAUDE.md rule 4). It builds each piece's outline once in STITCH/ROW coordinates
 * (the as-knitted shape), then draws it under two independent switches:
 *
 *  - `scale`:  'stitch'   — square cells, 1 st = 1 row (the true stitch/row grid);
 *              'measured' — each cell stretched to gauge, so the same outline becomes
 *                           the blocked, to-scale piece. The distortion is the gauge.
 *  - `grid`:   reference mesh every 5 st / 5 rows, on or off.
 *
 * Measured drawings can be emitted at a `scaleFactor` (1, 1/2, 1/4) for the roller
 * charting devices — Brother KnitLeader (1/2), Knitmaster KnitRadar (1/4), Toyota
 * KnitTracer (~1/2) — and carry real physical units so they print at exact size.
 *
 * Pure and I/O-free: outline model in, SVG string out.
 */

import type { Row, Carriage } from '../row';
import type { Gauge } from '../gauge';

/** A point in stitch/row space: x = stitches from the centre line, y = rows from cast-on. */
export interface Pt {
  x: number;
  y: number;
}

export type MeasureKind = 'width' | 'height';

/** A labelled dimension, carried in stitch/row terms; the renderer converts to inches/cm. */
export interface Measure {
  kind: MeasureKind;
  label: string;
  sts?: number; // for a width
  rows?: number; // for a height
  /** Placement in stitch/row space (the dimension line runs along here). */
  at: number; // width: the y it sits at; height: the x it sits at
  from: number; // width: x0; height: y0
  to: number; // width: x1; height: y1
}

/**
 * A shaping event to mark on the knit chart, in stitch/row cell coordinates
 * (x, y at the cell centre). `dec`/`inc` are single cells (lean shows the side);
 * `castoff` spans `span` cells.
 */
export interface ShapeMark {
  kind: 'dec' | 'inc' | 'castoff' | 'hold';
  x: number;
  y: number;
  span?: number;
  lean?: number; // dec only: +1 leans one way, −1 the other
  centre?: boolean; // a centre cast-off (offset above the row, not out to a side)
}

export interface PieceSchematic {
  piece: string;
  title: string;
  /** Closed polygon, stitch/row coordinates (x centred, y up from the cast-on edge). */
  outline: Pt[];
  widthSts: number; // full cast-on width
  heightRows: number;
  ribRows: number;
  gauge: Gauge;
  measures: Measure[];
  /** Shaping symbols for the per-stitch chart. */
  marks: ShapeMark[];
}

// ---------------------------------------------------------------------------
// Building the Back outline from its row array.
// ---------------------------------------------------------------------------

/**
 * The Back silhouette. Body and armhole edges come straight from the per-row live
 * stitch count (symmetric about the centre — a schematic approximation; the two
 * underarm cast-offs actually land a row apart). The shoulder slope and neck notch
 * are reconstructed from the plan, since short-row holds keep the live count flat.
 */
/**
 * A body piece with a scooped, split neck (both the front and — now that it has a
 * back-neck scoop — the back). Body and armhole come from the per-row live count up
 * to the split; above it the two halves share one y-range, so the neck edge and
 * shoulder staircase are read from the left half and mirrored, and the top comes
 * from the plan (not the halves' running row index).
 */
function splitNeckSchematic(
  rows: Row[],
  gauge: Gauge,
  opts: {
    piece: 'front' | 'back';
    title: string;
    neckLabel: string;
    bodySts: number;
    ribRows: number;
    totalRows: number;
    neckWidthSts: number;
  },
): PieceSchematic {
  const bodyHalf = opts.bodySts / 2;
  const split = rows.find((r) => r.section === 'neck_split');
  const splitY = split ? split.index : opts.totalRows;
  const centreCastOff = split ? (((split.ops[0] as { count?: number })?.count) ?? 0) : opts.neckWidthSts;
  const topY = opts.totalRows;
  const { rightPts, leftPts, underarmY, marks } = trackBodyEdges(rows, bodyHalf, splitY);
  const achievedHalf = rightPts[rightPts.length - 1].x;
  const neckTopHalf = opts.neckWidthSts / 2;
  const neckBottomHalf = centreCastOff / 2;

  marks.push({ kind: 'castoff', x: 0, y: splitY - 0.5, span: centreCastOff, centre: true }); // divide
  const leftRows = rows.filter((r) => r.side === 'left');
  const leftNeck: Pt[] = [{ x: -neckBottomHalf, y: splitY }];
  let nx = -neckBottomHalf;
  for (const r of leftRows) {
    const cy = r.index - 0.5;
    for (const op of r.ops) {
      if (op.kind !== 'bind_off' && op.kind !== 'decrease') continue;
      if (op.side !== 'R') continue;
      const before = nx;
      nx -= op.count; // the neck opening widens away from the centre
      if (leftNeck[leftNeck.length - 1].y < r.index - 1) leftNeck.push({ x: before, y: r.index - 1 });
      leftNeck.push({ x: nx, y: r.index });
      if (op.kind === 'bind_off') {
        marks.push({ kind: 'castoff', x: nx + op.count / 2, y: cy, span: op.count });
        marks.push({ kind: 'castoff', x: -(nx + op.count / 2), y: cy, span: op.count });
      } else {
        marks.push({ kind: 'dec', x: nx + 0.5, y: cy, lean: -1 });
        marks.push({ kind: 'dec', x: -(nx + 0.5), y: cy, lean: 1 });
      }
    }
  }
  const leftStair = shoulderStaircase(shoulderHolds(leftRows).filter((h) => h.side === 'L'), -achievedHalf, 1);
  const mirror = (p: Pt): Pt => ({ x: -p.x, y: p.y });
  rightPts.push(...leftStair.map(mirror), ...leftNeck.map(mirror).reverse());
  leftPts.push(...leftStair, ...[...leftNeck].reverse());
  // A shallow scoop can push a shoulder row a row past the planned top; clamp so the
  // outline stays within the piece height.
  const outline = [...rightPts, ...leftPts.reverse()].map((p) => ({ x: p.x, y: Math.min(p.y, topY) }));
  const lhm = holdMarks(shoulderHolds(leftRows), achievedHalf);
  marks.push(...lhm, ...lhm.map((m) => ({ ...m, x: -m.x })));

  const measures: Measure[] = [
    { kind: 'width', label: 'width', sts: opts.bodySts, at: 0, from: -bodyHalf, to: bodyHalf },
    { kind: 'width', label: opts.neckLabel, sts: opts.neckWidthSts, at: topY, from: -neckTopHalf, to: neckTopHalf },
    { kind: 'height', label: 'length', rows: topY, at: 0, from: 0, to: topY },
    { kind: 'height', label: 'armhole', rows: topY - underarmY, at: 0, from: underarmY, to: topY },
    { kind: 'height', label: 'neck depth', rows: topY - splitY, at: 0, from: splitY, to: topY },
  ];
  return {
    piece: opts.piece,
    title: opts.title,
    outline,
    widthSts: opts.bodySts,
    heightRows: topY,
    ribRows: opts.ribRows,
    gauge,
    measures,
    marks,
  };
}

export function backSchematic(
  rows: Row[],
  plan: { bodySts: number; backNeckSts: number; ribRows: number; totalRows: number },
  gauge: Gauge,
): PieceSchematic {
  return splitNeckSchematic(rows, gauge, {
    piece: 'back',
    title: 'The Back',
    neckLabel: 'back neck',
    bodySts: plan.bodySts,
    ribRows: plan.ribRows,
    totalRows: plan.totalRows,
    neckWidthSts: plan.backNeckSts,
  });
}

// ---------------------------------------------------------------------------
// The Front — body + armhole as the back, then a scooped neck between the shoulders.
// ---------------------------------------------------------------------------

export function frontSchematic(
  rows: Row[],
  plan: { bodySts: number; ribRows: number; totalRows: number },
  fnp: { neckLineRow: number; frontNeckSts: number; shoulderSts: number },
  gauge: Gauge,
): PieceSchematic {
  const bodyHalf = plan.bodySts / 2;
  const split = rows.find((r) => r.section === 'neck_split');
  const splitY = split ? split.index : fnp.neckLineRow;
  const centreCastOff = split
    ? (((split.ops[0] as { count?: number })?.count) ?? 0)
    : fnp.frontNeckSts;
  // The two neck halves continue the row index past the garment top, so take the
  // top from the plan rather than the last row index.
  const topY = plan.totalRows;
  // Below the split, the front is the back: track its true edges up to the split.
  const { rightPts, leftPts, underarmY, marks } = trackBodyEdges(rows, bodyHalf, splitY);
  const achievedHalf = rightPts[rightPts.length - 1].x; // armhole width reached
  const neckTopHalf = fnp.frontNeckSts / 2; // neck opening at the shoulders
  const neckBottomHalf = centreCastOff / 2; // the centre cast-off at the neck base

  // After the split the two halves are worked separately; the LEFT half is worked
  // first, so its row index still equals the physical row. Read the true neck edge
  // (its centre-facing R cast-offs/decreases) and shoulder (its armhole-edge holds)
  // from the left half, and mirror them to the right.
  marks.push({ kind: 'castoff', x: 0, y: splitY - 0.5, span: centreCastOff, centre: true }); // divide
  const leftRows = rows.filter((r) => r.side === 'left');
  const leftNeck: Pt[] = [{ x: -neckBottomHalf, y: splitY }];
  let nx = -neckBottomHalf;
  for (const r of leftRows) {
    const cy = r.index - 0.5;
    for (const op of r.ops) {
      if (op.kind !== 'bind_off' && op.kind !== 'decrease') continue;
      if (op.side !== 'R') continue;
      const before = nx;
      nx -= op.count; // the neck opening widens away from the centre
      // Close off the plateau (the return rows) so the edge steps rather than slopes.
      if (leftNeck[leftNeck.length - 1].y < r.index - 1) leftNeck.push({ x: before, y: r.index - 1 });
      leftNeck.push({ x: nx, y: r.index });
      if (op.kind === 'bind_off') {
        marks.push({ kind: 'castoff', x: nx + op.count / 2, y: cy, span: op.count });
        marks.push({ kind: 'castoff', x: -(nx + op.count / 2), y: cy, span: op.count });
      } else {
        marks.push({ kind: 'dec', x: nx + 0.5, y: cy, lean: -1 });
        marks.push({ kind: 'dec', x: -(nx + 0.5), y: cy, lean: 1 });
      }
    }
  }
  const leftStair = shoulderStaircase(
    shoulderHolds(leftRows).filter((h) => h.side === 'L'),
    -achievedHalf,
    1,
  );
  const mirror = (p: Pt): Pt => ({ x: -p.x, y: p.y });

  rightPts.push(...leftStair.map(mirror), ...leftNeck.map(mirror).reverse());
  leftPts.push(...leftStair, ...[...leftNeck].reverse());
  const outline = [...rightPts, ...leftPts.reverse()];
  const lhm = holdMarks(shoulderHolds(leftRows), achievedHalf); // left-half shoulder holds
  marks.push(...lhm, ...lhm.map((m) => ({ ...m, x: -m.x })));
  const measures: Measure[] = [
    { kind: 'width', label: 'width', sts: plan.bodySts, at: 0, from: -bodyHalf, to: bodyHalf },
    { kind: 'width', label: 'front neck', sts: fnp.frontNeckSts, at: topY, from: -neckTopHalf, to: neckTopHalf },
    { kind: 'height', label: 'length', rows: topY, at: 0, from: 0, to: topY },
    { kind: 'height', label: 'armhole', rows: topY - underarmY, at: 0, from: underarmY, to: topY },
    { kind: 'height', label: 'neck depth', rows: topY - splitY, at: 0, from: splitY, to: topY },
  ];
  return {
    piece: 'front',
    title: 'The Front',
    outline,
    widthSts: plan.bodySts,
    heightRows: topY,
    ribRows: plan.ribRows,
    gauge,
    measures,
    marks,
  };
}

/** Every short-row hold group, in row order, as {count, side, y}. */
function shoulderHolds(rows: Row[]): { count: number; side: Carriage; y: number }[] {
  const out: { count: number; side: Carriage; y: number }[] = [];
  for (const r of rows) {
    for (const op of r.ops) {
      if (op.kind === 'hold') out.push({ count: op.count, side: op.side, y: r.index });
    }
  }
  return out;
}

/** A hold glyph per short-row group, at the group's centre (from the armhole edge in). */
function holdMarks(
  holds: { count: number; side: Carriage; y: number }[],
  startHalf: number,
): ShapeMark[] {
  const out: ShapeMark[] = [];
  let rx = startHalf;
  let lx = -startHalf;
  for (const h of holds) {
    if (h.side === 'R') {
      out.push({ kind: 'hold', x: rx - h.count / 2, y: h.y - 0.5, span: h.count });
      rx -= h.count;
    } else {
      out.push({ kind: 'hold', x: lx + h.count / 2, y: h.y - 0.5, span: h.count });
      lx += h.count;
    }
  }
  return out;
}

/**
 * A short-row shoulder as its true staircase: each held group is a horizontal run
 * of `count` stitches ending at that group's row, with a vertical riser between
 * rows. `inward` is −1 stepping in from the right edge, +1 from the left.
 */
function shoulderStaircase(
  holds: { count: number; y: number }[],
  startX: number,
  inward: number,
): Pt[] {
  const pts: Pt[] = [];
  if (holds.length === 0) return pts;
  let x = startX;
  let lastY = holds[0].y;
  pts.push({ x, y: lastY });
  for (const h of holds) {
    if (h.y > lastY) {
      pts.push({ x, y: h.y }); // riser up to this group's row
      lastY = h.y;
    }
    x += inward * h.count; // step inward across the held stitches
    pts.push({ x, y: h.y });
  }
  return pts;
}

/** Track the true left/right edges of a bottom-up body panel from the ops, up to
 *  `stopY` (exclusive). The rib is a stitch wider (odd cast-on); clamp it. */
function trackBodyEdges(
  rows: Row[],
  bodyHalf: number,
  stopY: number,
): { rightPts: Pt[]; leftPts: Pt[]; underarmY: number; marks: ShapeMark[] } {
  const rightPts: Pt[] = [{ x: bodyHalf, y: 0 }];
  const leftPts: Pt[] = [{ x: -bodyHalf, y: 0 }];
  const marks: ShapeMark[] = [];
  let leftSts = 0;
  let rightSts = 0;
  let lastR = bodyHalf;
  let lastL = -bodyHalf;
  let rDone = false;
  let underarmY = 0;
  for (const r of rows) {
    if (r.index >= stopY) break;
    const cy = r.index - 0.5;
    for (const op of r.ops) {
      if (op.kind === 'cast_on') {
        rightSts = Math.ceil(op.count / 2);
        leftSts = Math.floor(op.count / 2);
      } else if (op.kind === 'bind_off') {
        if (op.side === 'R') {
          rightSts -= op.count;
          marks.push({ kind: 'castoff', x: rightSts + op.count / 2, y: cy, span: op.count });
        } else if (op.side === 'L') {
          leftSts -= op.count;
          marks.push({ kind: 'castoff', x: -(leftSts + op.count / 2), y: cy, span: op.count });
        }
      } else if (op.kind === 'decrease') {
        if (op.side === 'R' || op.side === 'both') {
          rightSts -= op.count;
          marks.push({ kind: 'dec', x: rightSts - 0.5, y: cy, lean: 1 });
        }
        if (op.side === 'L' || op.side === 'both') {
          leftSts -= op.count;
          marks.push({ kind: 'dec', x: -leftSts + 0.5, y: cy, lean: -1 });
        }
      } else if (op.kind === 'increase') {
        if (op.side === 'R' || op.side === 'both') {
          rightSts += op.count;
          marks.push({ kind: 'inc', x: rightSts - 0.5, y: cy });
        }
        if (op.side === 'L' || op.side === 'both') {
          leftSts += op.count;
          marks.push({ kind: 'inc', x: -leftSts + 0.5, y: cy });
        }
      }
    }
    const rx = r.section === 'rib' ? bodyHalf : rightSts;
    const lx = r.section === 'rib' ? -bodyHalf : -leftSts;
    // On a change, first close off the plateau (a flat run holds until the row
    // before), so a cast-off reads as a step and never a diagonal taper.
    if (rx !== lastR) {
      if (rightPts[rightPts.length - 1].y < r.index - 1) rightPts.push({ x: lastR, y: r.index - 1 });
      if (!rDone && rx < bodyHalf) {
        underarmY = r.index - 1;
        rDone = true;
      }
      rightPts.push({ x: rx, y: r.index });
      lastR = rx;
    }
    if (lx !== lastL) {
      if (leftPts[leftPts.length - 1].y < r.index - 1) leftPts.push({ x: lastL, y: r.index - 1 });
      leftPts.push({ x: lx, y: r.index });
      lastL = lx;
    }
  }
  return { rightPts, leftPts, underarmY, marks };
}

// ---------------------------------------------------------------------------
// The Sleeve — cuff, taper out to the underarm, then the set-in cap to the crown.
// ---------------------------------------------------------------------------

export function sleeveSchematic(
  rows: Row[],
  plan: { bodyCuffSts: number; sleeveTopSts: number; capTopSts: number; ribRows: number },
  gauge: Gauge,
): PieceSchematic {
  const cuffHalf = plan.bodyCuffSts / 2;
  const crown = rows[rows.length - 1]; // centre cast-off of the crown
  const topY = crown.index;
  const rightPts: Pt[] = [{ x: cuffHalf, y: 0 }];
  const leftPts: Pt[] = [{ x: -cuffHalf, y: 0 }];
  const marks: ShapeMark[] = [];
  let leftSts = 0;
  let rightSts = 0;
  let lastR = cuffHalf;
  let lastL = -cuffHalf;
  let capStartY = 0;
  let maxHalf = cuffHalf;
  for (const r of rows) {
    if (r.index >= topY) break;
    const cy = r.index - 0.5;
    for (const op of r.ops) {
      if (op.kind === 'cast_on') {
        rightSts = Math.ceil(op.count / 2);
        leftSts = Math.floor(op.count / 2);
      } else if (op.kind === 'increase') {
        rightSts += op.count;
        leftSts += op.count;
        marks.push({ kind: 'inc', x: rightSts - 0.5, y: cy });
        marks.push({ kind: 'inc', x: -leftSts + 0.5, y: cy });
      } else if (op.kind === 'bind_off') {
        if (op.side === 'R') {
          rightSts -= op.count;
          marks.push({ kind: 'castoff', x: rightSts + op.count / 2, y: cy, span: op.count });
        } else if (op.side === 'L') {
          leftSts -= op.count;
          marks.push({ kind: 'castoff', x: -(leftSts + op.count / 2), y: cy, span: op.count });
        }
      } else if (op.kind === 'decrease') {
        if (op.side === 'R' || op.side === 'both') {
          rightSts -= op.count;
          marks.push({ kind: 'dec', x: rightSts - 0.5, y: cy, lean: 1 });
        }
        if (op.side === 'L' || op.side === 'both') {
          leftSts -= op.count;
          marks.push({ kind: 'dec', x: -leftSts + 0.5, y: cy, lean: -1 });
        }
      }
    }
    if (r.section === 'cap' && capStartY === 0) capStartY = r.index - 1; // underarm
    const rx = r.section === 'rib' ? cuffHalf : rightSts;
    const lx = r.section === 'rib' ? -cuffHalf : -leftSts;
    if (rx > maxHalf) maxHalf = rx;
    // Close the plateau before a change, so the underarm cast-off steps in rather
    // than sloping diagonally from the last taper increase.
    if (rx !== lastR) {
      if (rightPts[rightPts.length - 1].y < r.index - 1) rightPts.push({ x: lastR, y: r.index - 1 });
      rightPts.push({ x: rx, y: r.index });
      lastR = rx;
    }
    if (lx !== lastL) {
      if (leftPts[leftPts.length - 1].y < r.index - 1) leftPts.push({ x: lastL, y: r.index - 1 });
      leftPts.push({ x: lx, y: r.index });
      lastL = lx;
    }
  }
  rightPts.push({ x: plan.capTopSts / 2, y: topY });
  leftPts.push({ x: -plan.capTopSts / 2, y: topY });
  const outline = [...rightPts, ...leftPts.reverse()];
  marks.push({ kind: 'castoff', x: 0, y: topY - 0.5, span: plan.capTopSts, centre: true }); // crown

  const measures: Measure[] = [
    { kind: 'width', label: 'cuff', sts: plan.bodyCuffSts, at: 0, from: -cuffHalf, to: cuffHalf },
    { kind: 'width', label: 'upper arm', sts: plan.sleeveTopSts, at: capStartY, from: -maxHalf, to: maxHalf },
    { kind: 'width', label: 'crown', sts: plan.capTopSts, at: topY, from: -plan.capTopSts / 2, to: plan.capTopSts / 2 },
    { kind: 'height', label: 'to underarm', rows: capStartY, at: 0, from: 0, to: capStartY },
    { kind: 'height', label: 'cap', rows: topY - capStartY, at: 0, from: capStartY, to: topY },
  ];
  return {
    piece: 'sleeve',
    title: 'The Sleeves (make 2)',
    outline,
    widthSts: Math.round(maxHalf * 2),
    heightRows: topY,
    ribRows: plan.ribRows,
    gauge,
    measures,
    marks,
  };
}

// ---------------------------------------------------------------------------
// The Neckband — a picked-up rib strip (worked flat, seamed at one shoulder).
// ---------------------------------------------------------------------------

export function neckbandSchematic(
  rows: Row[],
  plan: { pickupTotal: number; bandRows: number },
  gauge: Gauge,
): PieceSchematic {
  const half = plan.pickupTotal / 2;
  const h = plan.bandRows;
  const outline: Pt[] = [
    { x: half, y: 0 },
    { x: half, y: h },
    { x: -half, y: h },
    { x: -half, y: 0 },
  ];
  const measures: Measure[] = [
    { kind: 'width', label: 'pick-up', sts: plan.pickupTotal, at: 0, from: -half, to: half },
    { kind: 'height', label: 'band', rows: h, at: 0, from: 0, to: h },
  ];
  return {
    piece: 'neckband',
    title: 'Neckband',
    outline,
    widthSts: plan.pickupTotal,
    heightRows: h,
    ribRows: h, // all rib
    gauge,
    measures,
    marks: [],
  };
}

// ---------------------------------------------------------------------------
// SVG rendering.
// ---------------------------------------------------------------------------

export interface SvgOpts {
  scale?: 'stitch' | 'measured';
  scaleFactor?: number; // measured only: 1 (full), 0.5 (KnitLeader), 0.25 (KnitRadar)
  grid?: boolean;
  /** Stitch mode: draw a per-stitch chart (grid every 1 st/row) for knitting from. */
  chart?: boolean;
  units?: 'in' | 'cm' | 'both';
  /** Output pixels per stitch (stitch mode) or per inch (measured, before scaleFactor). */
  pxPerUnit?: number;
}

/** The knit-chart key, laid out as a horizontal row (it sits above the grid). */
function chartLegend(x0: number, y: number): string {
  const entries: { g: 'dec' | 'inc' | 'co' | 'hold' | 'rib'; c: string; label: string }[] = [
    { g: 'dec', c: '#243447', label: 'decrease' },
    { g: 'inc', c: '#2c6e49', label: 'increase' },
    { g: 'co', c: '#b23a3a', label: 'cast off' },
    { g: 'hold', c: '#9a7b1e', label: 'hold' },
    { g: 'rib', c: '#e9e4d6', label: 'rib' },
  ];
  const gy = y + 8;
  const out = [`<g font-size="11" fill="#3a4653">`];
  let x = x0;
  for (const e of entries) {
    const gx = x + 5;
    if (e.g === 'dec') out.push(`<line x1="${gx - 4}" y1="${gy + 4}" x2="${gx + 4}" y2="${gy - 4}" stroke="${e.c}" stroke-width="1.7"/>`);
    else if (e.g === 'inc') out.push(`<circle cx="${gx}" cy="${gy}" r="3.6" fill="none" stroke="${e.c}" stroke-width="1.5"/>`);
    else if (e.g === 'co') out.push(`<rect x="${gx - 3.8}" y="${gy - 3.8}" width="7.6" height="7.6" rx="1.4" fill="${e.c}"/>`);
    else if (e.g === 'hold') out.push(`<rect x="${gx - 3.8}" y="${gy - 3.8}" width="7.6" height="7.6" fill="none" stroke="${e.c}" stroke-width="1.5"/>`);
    else out.push(`<rect x="${gx - 4.5}" y="${gy - 4.5}" width="9" height="9" fill="${e.c}" stroke="#c9c2b0" stroke-width="0.7"/>`);
    out.push(`<text x="${gx + 11}" y="${(gy + 4).toFixed(1)}">${e.label}</text>`);
    x += 24 + e.label.length * 6.4;
  }
  out.push('</g>');
  return out.join('');
}

function fmtLen(inches: number, units: 'in' | 'cm' | 'both'): string {
  const cm = inches * 2.54;
  const inTxt = `${inches.toFixed(1)}in`;
  const cmTxt = `${cm.toFixed(1)}cm`;
  if (units === 'in') return inTxt;
  if (units === 'cm') return cmTxt;
  return `${inTxt} / ${cmTxt}`;
}

/**
 * Render a piece schematic to a self-contained SVG string. Stitch mode uses square
 * cells; measured mode stretches x by 4/stGauge and y by 4/rowGauge (inches), then
 * by `scaleFactor`, and labels physical dimensions.
 */
export function schematicSvg(s: PieceSchematic, opts: SvgOpts = {}): string {
  const scale = opts.scale ?? 'stitch';
  const grid = opts.grid ?? true;
  const units = opts.units ?? 'both';
  const measured = scale === 'measured';
  const factor = measured ? (opts.scaleFactor ?? 1) : 1;
  const px = opts.pxPerUnit ?? (measured ? 46 : 4);

  // Cell size in output px. Measured: inches per st/row × px-per-inch × scaleFactor.
  const inPerSt = 4 / s.gauge.bodySt;
  const inPerRow = 4 / s.gauge.bodyRow;
  const cellW = measured ? inPerSt * px * factor : px;
  const cellH = measured ? inPerRow * px * factor : px;

  const chart = !measured && (opts.chart ?? false);
  const pad = 82;
  const padX = chart ? 128 : 82; // wider side margins so the chart annotations fit
  const topExtra = chart ? 30 : 0; // a strip above the grid for the key
  const halfW = s.widthSts / 2;
  const W = s.widthSts * cellW + padX * 2;
  const H = s.heightRows * cellH + pad * 2 + topExtra;

  // stitch/row point → svg px (x centred, y flipped so cast-on is at the bottom).
  const X = (xSt: number): number => padX + (xSt + halfW) * cellW;
  const Y = (yRow: number): number => pad + topExtra + (s.heightRows - yRow) * cellH;

  const parts: string[] = [];
  parts.push(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W.toFixed(1)}" height="${H.toFixed(1)}" viewBox="0 0 ${W.toFixed(1)} ${H.toFixed(1)}" font-family="system-ui, sans-serif">`,
  );
  parts.push(`<rect width="${W.toFixed(1)}" height="${H.toFixed(1)}" fill="white"/>`);

  // Rib vs stocking: tint the rib band and label it (the rest is stocking stitch).
  if (s.ribRows > 0) {
    const ribTop = Y(s.ribRows);
    parts.push(
      `<rect x="${X(-halfW).toFixed(1)}" y="${ribTop.toFixed(1)}" width="${(s.widthSts * cellW).toFixed(1)}" height="${(Y(0) - ribTop).toFixed(1)}" fill="#e9e4d6"/>`,
    );
    parts.push(
      `<text x="${(X(-halfW) + 4).toFixed(1)}" y="${(Y(0) - 5).toFixed(1)}" font-size="11" fill="#7c745f">rib</text>`,
    );
  }

  // Grid + axis numbers. The chart draws a line through the CENTRE of every stitch
  // and every row: stitches numbered outward from the centre gap (no line at 0 —
  // it is the space between 1L and 1R), rows from 1 at the cast-on; heavy+numbered
  // every 10, a middle tier at 5. The measured view is a physical ruler instead —
  // every 1 cm (heavy every 5) or ½ in (heavy every 1) from the cast-on / left edge.
  if (grid) {
    const inch = measured && units === 'in';
    const mul = (u: number, m: number): boolean => m > 0 && Math.abs(u / m - Math.round(u / m)) < 1e-6;
    const strokes = [
      'stroke="#e7ebef" stroke-width="0.5"',
      'stroke="#d4dbe1" stroke-width="0.8"',
      'stroke="#c0cad4" stroke-width="1.1"',
    ];
    const g: string[] = ['<g font-size="10" fill="#8a96a2">'];
    if (chart) {
      const tier = (k: number): number => (mul(k, 10) ? 2 : mul(k, 5) ? 1 : 0);
      for (let k = 1; k - 0.5 <= halfW + 1e-6; k += 1) {
        const t = tier(k);
        for (const cx of [k - 0.5, -(k - 0.5)]) {
          g.push(`<line x1="${X(cx).toFixed(1)}" y1="${Y(0).toFixed(1)}" x2="${X(cx).toFixed(1)}" y2="${Y(s.heightRows).toFixed(1)}" ${strokes[t]}/>`);
        }
        if (t === 2) {
          g.push(`<text x="${X(k - 0.5).toFixed(1)}" y="${(Y(0) + 17).toFixed(1)}" text-anchor="middle">${k}R</text>`);
          g.push(`<text x="${X(-(k - 0.5)).toFixed(1)}" y="${(Y(0) + 17).toFixed(1)}" text-anchor="middle">${k}L</text>`);
        }
      }
      // The centre gap itself (between 1L and 1R) is 0 — a label, not a line.
      g.push(`<text x="${X(0).toFixed(1)}" y="${(Y(0) + 17).toFixed(1)}" text-anchor="middle" fill="#5b6873">0</text>`);
      for (let k = 1; k - 0.5 <= s.heightRows + 1e-6; k += 1) {
        const t = tier(k);
        g.push(`<line x1="${X(-halfW).toFixed(1)}" y1="${Y(k - 0.5).toFixed(1)}" x2="${X(halfW).toFixed(1)}" y2="${Y(k - 0.5).toFixed(1)}" ${strokes[t]}/>`);
        if (t === 2) g.push(`<text x="${(X(-halfW) - 8).toFixed(1)}" y="${(Y(k - 0.5) + 3.5).toFixed(1)}" text-anchor="end">${k}</text>`);
      }
      g.push(`<text x="${(X(-halfW) - 8).toFixed(1)}" y="${(Y(0) + 17).toFixed(1)}" text-anchor="end" fill="#5b6873">st · r</text>`);
    } else {
      const minorU = inch ? 0.5 : 1;
      const majorU = inch ? 1 : 5;
      const spuX = inch ? s.gauge.bodySt / 4 : s.gauge.bodySt / 4 / 2.54;
      const spuY = inch ? s.gauge.bodyRow / 4 : s.gauge.bodyRow / 4 / 2.54;
      const tier = (u: number): number => (mul(u, majorU) ? 2 : 0);
      for (let u = 0; u * spuX <= s.widthSts + 1e-6; u += minorU) {
        const xs = -halfW + u * spuX;
        const t = tier(u);
        g.push(`<line x1="${X(xs).toFixed(1)}" y1="${Y(0).toFixed(1)}" x2="${X(xs).toFixed(1)}" y2="${Y(s.heightRows).toFixed(1)}" ${strokes[t]}/>`);
        if (t === 2) g.push(`<text x="${X(xs).toFixed(1)}" y="${(Y(0) + 17).toFixed(1)}" text-anchor="middle">${Math.round(u)}</text>`);
      }
      for (let u = 0; u * spuY <= s.heightRows + 1e-6; u += minorU) {
        const ys = u * spuY;
        const t = tier(u);
        g.push(`<line x1="${X(-halfW).toFixed(1)}" y1="${Y(ys).toFixed(1)}" x2="${X(halfW).toFixed(1)}" y2="${Y(ys).toFixed(1)}" ${strokes[t]}/>`);
        if (t === 2) g.push(`<text x="${(X(-halfW) - 8).toFixed(1)}" y="${(Y(ys) + 3.5).toFixed(1)}" text-anchor="end">${Math.round(u)}</text>`);
      }
      g.push(`<text x="${(X(-halfW) - 8).toFixed(1)}" y="${(Y(0) + 17).toFixed(1)}" text-anchor="end" fill="#5b6873">${inch ? 'in' : 'cm'}</text>`);
    }
    g.push('</g>');
    parts.push(g.join(''));
  }

  // Outline (thinner on the chart so it reads as a row edge, not a heavy border).
  const d = s.outline
    .map((p, k) => `${k === 0 ? 'M' : 'L'} ${X(p.x).toFixed(1)} ${Y(p.y).toFixed(1)}`)
    .join(' ');
  parts.push(
    `<path d="${d} Z" fill="#4f6d8c1e" stroke="#33475b" stroke-width="${chart ? 1 : 2}" stroke-linejoin="round"/>`,
  );

  // Chart: shaping symbols nudged just off the cell they refer to, per-row
  // annotations (row number + net stitch change) down the right margin, and a key.
  if (chart && s.marks.length) {
    const DEC = '#243447';
    const INC = '#2c6e49';
    const CO = '#b23a3a';
    const HOLD = '#9a7b1e';
    // Offset a symbol clear of its cell: cast-offs and holds sit above the row,
    // edge decreases/increases just outside the edge.
    const at = (mk: ShapeMark): { cx: number; cy: number } =>
      mk.centre
        ? { cx: X(mk.x), cy: Y(mk.y + 1.3) }
        : mk.kind === 'hold'
          ? { cx: X(mk.x), cy: Y(mk.y + 1.0) }
          : { cx: X(mk.x + Math.sign(mk.x) * 1.3), cy: Y(mk.y) };
    const fills: string[] = [];
    const strokes: { d: string; sw: number; color: string }[] = [];
    for (const mk of s.marks) {
      const { cx, cy } = at(mk);
      if (mk.kind === 'castoff') {
        const r = cellW * 0.34;
        fills.push(
          `<rect x="${(cx - r).toFixed(1)}" y="${(cy - r).toFixed(1)}" width="${(2 * r).toFixed(1)}" height="${(2 * r).toFixed(1)}" rx="${(r * 0.4).toFixed(1)}" fill="${CO}" stroke="#fff" stroke-width="2" paint-order="stroke"/>`,
        );
      } else if (mk.kind === 'dec') {
        const r = cellW * 0.36;
        const l = mk.lean ?? 1;
        strokes.push({ d: `<line x1="${(cx - l * r).toFixed(1)}" y1="${(cy + r).toFixed(1)}" x2="${(cx + l * r).toFixed(1)}" y2="${(cy - r).toFixed(1)}"/>`, sw: Math.max(1.2, cellW * 0.34), color: DEC });
      } else if (mk.kind === 'inc') {
        strokes.push({ d: `<circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="${(cellW * 0.3).toFixed(1)}"/>`, sw: Math.max(1.1, cellW * 0.26), color: INC });
      } else {
        const r = cellW * 0.36;
        strokes.push({ d: `<rect x="${(cx - r).toFixed(1)}" y="${(cy - r).toFixed(1)}" width="${(2 * r).toFixed(1)}" height="${(2 * r).toFixed(1)}"/>`, sw: Math.max(1.1, cellW * 0.26), color: HOLD });
      }
    }
    parts.push(`<g>${fills.join('')}</g>`);
    parts.push(`<g fill="none" stroke="#fff" stroke-linecap="round">${strokes.map((g) => `<g stroke-width="${(g.sw + 2).toFixed(1)}">${g.d}</g>`).join('')}</g>`);
    parts.push(`<g fill="none" stroke-linecap="round">${strokes.map((g) => `<g stroke="${g.color}" stroke-width="${g.sw.toFixed(1)}">${g.d}</g>`).join('')}</g>`);

    // Per-row annotations: row (or row range) + net stitch change. A run of the same
    // change collapses to one range; the rest alternate left/right where they would
    // otherwise overlap, so two never sit on top of each other.
    const byRow = new Map<number, ShapeMark[]>();
    for (const mk of s.marks) {
      const r = Math.round(mk.y + 0.5);
      const arr = byRow.get(r) ?? [];
      arr.push(mk);
      byRow.set(r, arr);
    }
    const info = [...byRow.entries()]
      .map(([row, ms]) => {
        const change = ms.reduce((n, m) => n + (m.kind === 'castoff' ? -(m.span ?? 1) : m.kind === 'dec' ? -1 : m.kind === 'inc' ? 1 : 0), 0);
        const hold = change === 0 && ms.some((m) => m.kind === 'hold');
        return { row, change, hold, key: change !== 0 ? String(change) : hold ? 'H' : '' };
      })
      .filter((r) => r.key)
      .sort((a, b) => a.row - b.row);
    const groups: { start: number; end: number; change: number; hold: boolean; count: number }[] = [];
    for (const r of info) {
      const g = groups[groups.length - 1];
      if (g && (g.hold ? 'H' : String(g.change)) === r.key && r.row - g.end <= 2) {
        g.end = r.row;
        g.count += 1;
      } else groups.push({ start: r.row, end: r.row, change: r.change, hold: r.hold, count: 1 });
    }
    const MINGAP = 4;
    let lastR = -Infinity;
    let lastL = -Infinity;
    const annos = ['<g font-size="9" paint-order="stroke" stroke="#fff" stroke-width="2.6" fill="#7d735d">'];
    for (const g of groups) {
      const mid = (g.start + g.end) / 2;
      const rng = g.count > 1 ? `${g.start}–${g.end}` : `${g.start}`;
      const val = g.hold ? 'hold' : `${g.change > 0 ? '+' : '−'}${Math.abs(g.change)}`;
      const label = `${rng}  ${val}${g.count > 1 ? ` ×${g.count}` : ''}`;
      const right = mid - lastR >= MINGAP ? true : mid - lastL >= MINGAP ? false : mid - lastR >= mid - lastL;
      const cy = (Y(mid - 0.5) + 3.2).toFixed(1);
      if (right) {
        lastR = mid;
        annos.push(`<text x="${(X(halfW) + 10).toFixed(1)}" y="${cy}" text-anchor="start">${label}</text>`);
      } else {
        lastL = mid;
        annos.push(`<text x="${(X(-halfW) - 28).toFixed(1)}" y="${cy}" text-anchor="end">${label}</text>`);
      }
    }
    annos.push('</g>');
    parts.push(annos.join(''));

    // Key (legend) in the strip above the grid.
    parts.push(chartLegend(X(-halfW), pad + 6));
  }

  // Dimension labels (measured / overview) — kept clear of the axis numbers: widths
  // sit just ABOVE their line (the bottom / left margins are the ruler's); heights
  // run down the RIGHT margin (the full length outermost). The chart uses the
  // per-row annotations instead, so it skips these. A white halo keeps them legible.
  const labels: string[] = [
    `<g fill="#1b2733" font-size="13" paint-order="stroke" stroke="#ffffff" stroke-width="3.5" stroke-linejoin="round">`,
  ];
  for (const m of chart ? [] : s.measures) {
    if (m.kind === 'width' && m.sts != null) {
      const text = measured ? fmtLen(m.sts * inPerSt, units) : `${m.sts} sts`;
      const cx = X((m.from + m.to) / 2);
      const cy = Y(m.at) - 9;
      labels.push(`<text x="${cx.toFixed(1)}" y="${cy.toFixed(1)}" text-anchor="middle">${m.label} · ${text}</text>`);
    } else if (m.kind === 'height' && m.rows != null) {
      const text = measured ? fmtLen(m.rows * inPerRow, units) : `${m.rows} rows`;
      const cx = X(halfW) + (m.from === 0 ? 36 : 17); // full length outermost
      const cy = Y((m.from + m.to) / 2);
      labels.push(
        `<text x="${cx.toFixed(1)}" y="${cy.toFixed(1)}" text-anchor="middle" transform="rotate(-90 ${cx.toFixed(1)} ${cy.toFixed(1)})">${m.label} · ${text}</text>`,
      );
    }
  }
  labels.push(`</g>`);
  parts.push(labels.join(''));

  // Calibration ruler on measured drawings (a labelled 10 cm line to check print scale).
  if (measured) {
    const tenCmIn = 10 / 2.54;
    const len = tenCmIn * px * factor;
    const x0 = pad;
    const y0 = H - 20;
    parts.push(
      `<g stroke="#1b2733" stroke-width="1.5" fill="#1b2733" font-size="11">` +
        `<line x1="${x0}" y1="${y0}" x2="${(x0 + len).toFixed(1)}" y2="${y0}"/>` +
        `<line x1="${x0}" y1="${y0 - 5}" x2="${x0}" y2="${y0 + 5}"/>` +
        `<line x1="${(x0 + len).toFixed(1)}" y1="${y0 - 5}" x2="${(x0 + len).toFixed(1)}" y2="${y0 + 5}"/>` +
        `<text x="${(x0 + len / 2).toFixed(1)}" y="${y0 - 8}" text-anchor="middle" stroke="none">10 cm at ${factor === 1 ? 'full' : `1/${Math.round(1 / factor)}`} scale — check your print</text>` +
        `</g>`,
    );
  }

  parts.push(`</svg>`);
  return parts.join('\n');
}
