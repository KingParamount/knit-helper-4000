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

import type { Row } from '../row';
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
export function backSchematic(
  rows: Row[],
  plan: {
    ribCastOnSts: number;
    bodySts: number;
    backNeckSts: number;
    ribRows: number;
    totalRows: number;
  },
  gauge: Gauge,
): PieceSchematic {
  const firstHold = rows.findIndex((r) => r.ops.some((o) => o.kind === 'hold'));
  const shoulderStartY = firstHold >= 0 ? rows[firstHold].index - 1 : rows.length - 1;
  const topY = rows[rows.length - 1].index; // neck cast-off row
  const achieved = firstHold >= 0 ? rows[firstHold - 1].stitches : rows[rows.length - 1].stitches;
  const neckHalf = plan.backNeckSts / 2;

  // Track the true left and right edges from the ops, so the two underarm cast-offs
  // (right, then left one row later) show as the real one-row stagger rather than an
  // averaged curve. The rib is a stitch wider (odd cast-on); clamp it to the body
  // width — the ≤1-stitch overhang would only read as noise — and mark it with a band.
  const bodyHalf = plan.bodySts / 2;
  const holdY = firstHold >= 0 ? rows[firstHold].index : Infinity;
  const rightPts: Pt[] = [{ x: bodyHalf, y: 0 }];
  const leftPts: Pt[] = [{ x: -bodyHalf, y: 0 }];
  let leftSts = 0;
  let rightSts = 0;
  let lastR = bodyHalf;
  let lastL = -bodyHalf;
  let rDone = false;
  let lDone = false;
  let underarmY = 0;
  for (const r of rows) {
    if (r.index >= holdY) break;
    for (const op of r.ops) {
      if (op.kind === 'cast_on') {
        rightSts = Math.ceil(op.count / 2); // odd cast-on: the extra stitch is on the right
        leftSts = Math.floor(op.count / 2);
      } else if (op.kind === 'bind_off') {
        if (op.side === 'R') rightSts -= op.count;
        else if (op.side === 'L') leftSts -= op.count;
      } else if (op.kind === 'decrease') {
        if (op.side === 'R' || op.side === 'both') rightSts -= op.count;
        if (op.side === 'L' || op.side === 'both') leftSts -= op.count;
      }
    }
    const rx = r.section === 'rib' ? bodyHalf : rightSts;
    const lx = r.section === 'rib' ? -bodyHalf : -leftSts;
    if (rx !== lastR) {
      if (!rDone && rx < bodyHalf) {
        underarmY = r.index - 1;
        rightPts.push({ x: bodyHalf, y: r.index - 1 }); // top of the full-width body
        rDone = true;
      }
      rightPts.push({ x: rx, y: r.index });
      lastR = rx;
    }
    if (lx !== lastL) {
      if (!lDone && lx > -bodyHalf) {
        leftPts.push({ x: -bodyHalf, y: r.index - 1 });
        lDone = true;
      }
      leftPts.push({ x: lx, y: r.index });
      lastL = lx;
    }
  }
  // The straight upper back and the (symmetric) shoulder slope up to the neck edge.
  rightPts.push({ x: achieved / 2, y: shoulderStartY }, { x: neckHalf, y: topY });
  leftPts.push({ x: -achieved / 2, y: shoulderStartY }, { x: -neckHalf, y: topY });

  const outline = [...rightPts, ...leftPts.reverse()];

  const measures: Measure[] = [
    { kind: 'width', label: 'width', sts: plan.bodySts, at: 0, from: -plan.bodySts / 2, to: plan.bodySts / 2 },
    { kind: 'width', label: 'upper back', sts: achieved, at: shoulderStartY, from: -achieved / 2, to: achieved / 2 },
    { kind: 'width', label: 'back neck', sts: plan.backNeckSts, at: topY, from: -neckHalf, to: neckHalf },
    { kind: 'height', label: 'length', rows: topY, at: plan.bodySts / 2, from: 0, to: topY },
    { kind: 'height', label: 'armhole', rows: topY - underarmY, at: -plan.bodySts / 2, from: underarmY, to: topY },
  ];

  return {
    piece: 'back',
    title: 'The Back',
    outline,
    widthSts: plan.bodySts,
    heightRows: topY,
    ribRows: plan.ribRows,
    gauge,
    measures,
  };
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
    ? ((split.ops[0] as { count: number }).count ?? 0)
    : fnp.frontNeckSts;
  // The two neck halves continue the row index past the garment top, so take the
  // top from the plan rather than the last row index.
  const topY = plan.totalRows;
  // Below the split, the front is the back: track its true edges up to the split.
  const { rightPts, leftPts, underarmY } = trackBodyEdges(rows, bodyHalf, splitY);
  const achievedHalf = rightPts[rightPts.length - 1].x; // armhole width reached
  const shoulderDropY = topY - 12; // the short-row shoulder occupies the top ~12 rows
  const neckTopHalf = fnp.frontNeckSts / 2; // neck opening at the shoulders
  const neckBottomHalf = centreCastOff / 2; // the centre cast-off at the neck base

  // Right side: straight up to the shoulder, slope in to the neck, then the scoop
  // down to the neck base (a quadratic through a corner control point).
  rightPts.push({ x: achievedHalf, y: shoulderDropY });
  rightPts.push({ x: neckTopHalf, y: topY });
  for (const t of [0.35, 0.7, 1]) {
    const x = (1 - t) * (1 - t) * neckTopHalf + 2 * (1 - t) * t * neckTopHalf + t * t * neckBottomHalf;
    const y = (1 - t) * (1 - t) * topY + 2 * (1 - t) * t * splitY + t * t * splitY;
    rightPts.push({ x, y });
  }
  leftPts.push({ x: -achievedHalf, y: shoulderDropY });
  leftPts.push({ x: -neckTopHalf, y: topY });
  for (const t of [0.35, 0.7, 1]) {
    const x = (1 - t) * (1 - t) * neckTopHalf + 2 * (1 - t) * t * neckTopHalf + t * t * neckBottomHalf;
    const y = (1 - t) * (1 - t) * topY + 2 * (1 - t) * t * splitY + t * t * splitY;
    leftPts.push({ x: -x, y });
  }

  const outline = [...rightPts, ...leftPts.reverse()];
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
  };
}

/** Track the true left/right edges of a bottom-up body panel from the ops, up to
 *  `stopY` (exclusive). The rib is a stitch wider (odd cast-on); clamp it. */
function trackBodyEdges(
  rows: Row[],
  bodyHalf: number,
  stopY: number,
): { rightPts: Pt[]; leftPts: Pt[]; underarmY: number } {
  const rightPts: Pt[] = [{ x: bodyHalf, y: 0 }];
  const leftPts: Pt[] = [{ x: -bodyHalf, y: 0 }];
  let leftSts = 0;
  let rightSts = 0;
  let lastR = bodyHalf;
  let lastL = -bodyHalf;
  let rDone = false;
  let lDone = false;
  let underarmY = 0;
  for (const r of rows) {
    if (r.index >= stopY) break;
    for (const op of r.ops) {
      if (op.kind === 'cast_on') {
        rightSts = Math.ceil(op.count / 2);
        leftSts = Math.floor(op.count / 2);
      } else if (op.kind === 'bind_off') {
        if (op.side === 'R') rightSts -= op.count;
        else if (op.side === 'L') leftSts -= op.count;
      } else if (op.kind === 'decrease') {
        if (op.side === 'R' || op.side === 'both') rightSts -= op.count;
        if (op.side === 'L' || op.side === 'both') leftSts -= op.count;
      } else if (op.kind === 'increase') {
        if (op.side === 'R' || op.side === 'both') rightSts += op.count;
        if (op.side === 'L' || op.side === 'both') leftSts += op.count;
      }
    }
    const rx = r.section === 'rib' ? bodyHalf : rightSts;
    const lx = r.section === 'rib' ? -bodyHalf : -leftSts;
    if (rx !== lastR) {
      if (!rDone && rx < bodyHalf) {
        underarmY = r.index - 1;
        rightPts.push({ x: bodyHalf, y: r.index - 1 });
        rDone = true;
      }
      rightPts.push({ x: rx, y: r.index });
      lastR = rx;
    }
    if (lx !== lastL) {
      if (!lDone && lx > -bodyHalf) {
        leftPts.push({ x: -bodyHalf, y: r.index - 1 });
        lDone = true;
      }
      leftPts.push({ x: lx, y: r.index });
      lastL = lx;
    }
  }
  return { rightPts, leftPts, underarmY };
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
  let leftSts = 0;
  let rightSts = 0;
  let lastR = cuffHalf;
  let lastL = -cuffHalf;
  let capStartY = 0;
  let maxHalf = cuffHalf;
  for (const r of rows) {
    if (r.index >= topY) break;
    for (const op of r.ops) {
      if (op.kind === 'cast_on') {
        rightSts = Math.ceil(op.count / 2);
        leftSts = Math.floor(op.count / 2);
      } else if (op.kind === 'increase') {
        rightSts += op.count;
        leftSts += op.count;
      } else if (op.kind === 'bind_off') {
        if (op.side === 'R') rightSts -= op.count;
        else if (op.side === 'L') leftSts -= op.count;
      } else if (op.kind === 'decrease') {
        if (op.side === 'R' || op.side === 'both') rightSts -= op.count;
        if (op.side === 'L' || op.side === 'both') leftSts -= op.count;
      }
    }
    if (r.section === 'cap' && capStartY === 0) capStartY = r.index - 1; // underarm
    const rx = r.section === 'rib' ? cuffHalf : rightSts;
    const lx = r.section === 'rib' ? -cuffHalf : -leftSts;
    if (rx > maxHalf) maxHalf = rx;
    if (rx !== lastR) {
      rightPts.push({ x: rx, y: r.index });
      lastR = rx;
    }
    if (lx !== lastL) {
      leftPts.push({ x: lx, y: r.index });
      lastL = lx;
    }
  }
  rightPts.push({ x: plan.capTopSts / 2, y: topY });
  leftPts.push({ x: -plan.capTopSts / 2, y: topY });
  const outline = [...rightPts, ...leftPts.reverse()];

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

  const pad = 82;
  const halfW = s.widthSts / 2;
  const W = s.widthSts * cellW + pad * 2;
  const H = s.heightRows * cellH + pad * 2;

  // stitch/row point → svg px (x centred, y flipped so cast-on is at the bottom).
  const X = (xSt: number): number => pad + (xSt + halfW) * cellW;
  const Y = (yRow: number): number => pad + (s.heightRows - yRow) * cellH;

  const parts: string[] = [];
  parts.push(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W.toFixed(1)}" height="${H.toFixed(1)}" viewBox="0 0 ${W.toFixed(1)} ${H.toFixed(1)}" font-family="system-ui, sans-serif">`,
  );
  parts.push(`<rect width="${W.toFixed(1)}" height="${H.toFixed(1)}" fill="white"/>`);

  // Grid + axis numbers, spaced in the natural unit. Stitch mode: every 5 st/row
  // (overview) or, as a chart, every 1 st/row (medium every 5, heavy+numbered every
  // 10) to knit from. Measured: every 1 cm (heavy every 5) or every ½ in (heavy
  // every 1). Numbers run from 0 at the cast-on / left edge; a tag names the unit.
  if (grid) {
    const inch = measured && units === 'in';
    const chart = !measured && (opts.chart ?? false);
    const minorU = measured ? (inch ? 0.5 : 1) : chart ? 1 : 5;
    const midU = chart ? 5 : 0; // a middle tier only on the per-stitch chart
    const majorU = measured ? (inch ? 1 : 5) : chart ? 10 : 25;
    const spuX = measured ? (inch ? s.gauge.bodySt / 4 : s.gauge.bodySt / 4 / 2.54) : 1;
    const spuY = measured ? (inch ? s.gauge.bodyRow / 4 : s.gauge.bodyRow / 4 / 2.54) : 1;
    const mul = (u: number, m: number): boolean => m > 0 && Math.abs(u / m - Math.round(u / m)) < 1e-6;
    const tier = (u: number): number => (mul(u, majorU) ? 2 : mul(u, midU) ? 1 : 0);
    const strokes = [
      'stroke="#e7ebef" stroke-width="0.5"',
      'stroke="#d4dbe1" stroke-width="0.8"',
      'stroke="#c0cad4" stroke-width="1.1"',
    ];
    const g: string[] = ['<g font-size="10" fill="#8a96a2">'];
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
    g.push(`<text x="${(X(-halfW) - 8).toFixed(1)}" y="${(Y(0) + 17).toFixed(1)}" text-anchor="end" fill="#5b6873">${measured ? (inch ? 'in' : 'cm') : 'st / r'}</text>`);
    g.push('</g>');
    parts.push(g.join(''));
  }

  // Outline.
  const d = s.outline
    .map((p, k) => `${k === 0 ? 'M' : 'L'} ${X(p.x).toFixed(1)} ${Y(p.y).toFixed(1)}`)
    .join(' ');
  parts.push(`<path d="${d} Z" fill="#4f6d8c22" stroke="#33475b" stroke-width="2" stroke-linejoin="round"/>`);

  // Rib band marker.
  parts.push(
    `<line x1="${X(-halfW).toFixed(1)}" y1="${Y(s.ribRows).toFixed(1)}" x2="${X(halfW).toFixed(1)}" y2="${Y(s.ribRows).toFixed(1)}" stroke="#33475b" stroke-width="1" stroke-dasharray="4 3"/>`,
  );

  // Dimension labels — kept clear of the axis numbers: widths sit just ABOVE their
  // line (the bottom / left margins are the ruler's); heights run down the RIGHT
  // margin (the full length outermost). A white halo keeps them legible over the grid.
  const labels: string[] = [
    `<g fill="#1b2733" font-size="13" paint-order="stroke" stroke="#ffffff" stroke-width="3.5" stroke-linejoin="round">`,
  ];
  for (const m of s.measures) {
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
