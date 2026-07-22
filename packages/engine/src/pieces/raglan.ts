/**
 * Raglan shoulder construction. There is no cap and no shoulder: the body armhole and the
 * sleeve top both decrease steadily from the underarm to the neck over the SAME number of
 * rows (`ragRows`), so the four raglan seams match row-for-row. The back decreases both
 * edges straight to the back-neck width and holds it; the front does the same until the
 * neck line, then shapes the neck on the inner edge while the raglan continues on the outer
 * edge, casting the little that remains off at the top. Sleeves (see sleeve.ts) mirror the
 * body edge and taper to a small crown. All joins are sewn (cast-off edges, not held).
 *
 * Numbers follow Knitware's raglan (Phase-4 harvest): a two-part armhole — a small underarm
 * cast-off, then dec 1 st each end steadily — with the body and sleeve sharing the row span.
 */

import type { SizeRecord, EaseStyleId, NeckStyle } from '../data/types';
import { type Gauge, stitchesFor, rowsFor } from '../gauge';
import { type Row, carriageForRow } from '../row';
import { backPlan, armholeShaping, lowerPanelRows } from './back';
import { NECK_CURVE_IN } from '../neckopening';

/**
 * `count` events spread as evenly as possible across `span` positions (1-based). Uses the
 * centred rule round((i − ½)·span/n), which gives distinct, evenly-spaced positions for
 * n ≤ span — so decreases fall in proportion in every stretch of the span (a naive
 * i·span/(n+1) collides at the ends and, when back-filled, skews them early, which starved
 * the front's post-neck raglan and left the halves not closing).
 */
function spread(count: number, span: number): Set<number> {
  const out = new Set<number>();
  const n = Math.max(0, Math.min(count, span));
  for (let i = 1; i <= n; i++) {
    out.add(Math.max(1, Math.min(span, Math.round(((i - 0.5) * span) / n))));
  }
  for (let r = 1; out.size < n && r <= span; r++) if (!out.has(r)) out.add(r);
  return out;
}

export interface RaglanPlan {
  bodySts: number;
  ribCastOnSts: number;
  ribRows: number;
  bodyRows: number; // plain rows to the underarm
  ragRows: number; // underarm → neck, the raglan span (shared by body and sleeve)
  underarmCastOff: number; // small block each side, matches the sleeve
  bodyDecPerSide: number; // raglan decreases each side on the body (down to the back neck)
  backNeckSts: number; // held for the band (a flat back neck)
  frontNeckDepthRows: number; // rows the front neck occupies below the top
  frontNeckCentreSts: number; // held at the centre front
  frontNeckDecPerSide: number; // neck-edge decreases each side of the front
}

export function raglanPlan(size: SizeRecord, style: EaseStyleId, gauge: Gauge): RaglanPlan {
  // backPlan at 'raglan' gives the deeper armhole (garmentWidths), so armholeRows is the
  // raglan span and bodyRows the (shorter) plain body below it.
  const bp = backPlan(size, style, gauge, 'raglan');
  const ragRows = bp.armholeRows;
  const underarmCastOff = armholeShaping(bp.bodySts, bp.upperBackSts).castOffPerSide;
  const bodyUA = bp.bodySts - 2 * underarmCastOff;
  const bodyDecPerSide = Math.round((bodyUA - bp.backNeckSts) / 2);
  const frontNeckDepthRows = rowsFor(size.neck_depth, gauge);
  const frontNeckDecPerSide = stitchesFor(NECK_CURVE_IN, gauge);
  // The front neck opening is about as wide as the back neck (a crew); its centre is held,
  // the rest shaped away each side.
  const frontNeckCentreSts = Math.max(1, bp.backNeckSts - 2 * frontNeckDecPerSide);
  return {
    bodySts: bp.bodySts,
    ribCastOnSts: bp.ribCastOnSts,
    ribRows: bp.ribRows,
    bodyRows: bp.bodyRows,
    ragRows,
    underarmCastOff,
    bodyDecPerSide,
    backNeckSts: bp.backNeckSts,
    frontNeckDepthRows,
    frontNeckCentreSts,
    frontNeckDecPerSide,
  };
}

/**
 * The raglan back: plain body to the underarm, a small underarm cast-off, then dec 1 st at
 * each end steadily up to the back-neck width, which comes off on waste yarn for the band.
 */
export function raglanBackRows(size: SizeRecord, style: EaseStyleId, gauge: Gauge): Row[] {
  const p = raglanPlan(size, style, gauge);
  const rows = lowerPanelRows('back', size, style, gauge, 'raglan');
  let index = rows.length;
  let stitches = p.bodySts;
  const push = (ops: Row['ops'], section: string): void => {
    index += 1;
    for (const op of ops) {
      if (op.kind === 'bind_off') stitches -= op.count;
      if (op.kind === 'decrease') stitches -= op.count * (op.side === 'both' ? 2 : 1);
      if (op.kind === 'take_off') { /* live, no change */ }
    }
    rows.push({ index, piece: 'back', stitches, carriage: carriageForRow(index), ops, section });
  };

  push([{ kind: 'bind_off', count: p.underarmCastOff, side: carriageForRow(index + 1) }], 'armhole');
  push([{ kind: 'bind_off', count: p.underarmCastOff, side: carriageForRow(index + 1) }], 'armhole');
  const decRows = p.ragRows - 2;
  const decAt = spread(p.bodyDecPerSide, decRows);
  for (let r = 1; r <= decRows; r++) push(decAt.has(r) ? [{ kind: 'decrease', count: 1, side: 'both' }] : [], 'armhole');
  push([{ kind: 'take_off', count: stitches }], 'take_off'); // the back neck, held for the band
  return rows;
}

/**
 * The raglan front: as the back to the neck line, then split — the centre is held and each
 * side shapes the neck on its inner edge while the raglan continues on the outer (armhole)
 * edge, casting off the small remainder at the top (that remainder is part of the raglan
 * seam, not the neck). Both halves' outer edges keep the body's raglan row-count, so they
 * still match the sleeve.
 */
export function raglanFrontRows(
  size: SizeRecord,
  style: EaseStyleId,
  gauge: Gauge,
  _neck: NeckStyle = 'round',
): Row[] {
  const p = raglanPlan(size, style, gauge);
  const rows = lowerPanelRows('front', size, style, gauge, 'raglan');
  let index = rows.length;
  let stitches = p.bodySts;
  const push = (ops: Row['ops'], section: string, side?: 'left' | 'right'): void => {
    index += 1;
    for (const op of ops) {
      if (op.kind === 'bind_off') stitches -= op.count;
      if (op.kind === 'decrease') stitches -= op.count * (op.side === 'both' ? 2 : 1);
    }
    rows.push({ index, piece: 'front', stitches, carriage: carriageForRow(index), ops, section, side });
  };

  push([{ kind: 'bind_off', count: p.underarmCastOff, side: carriageForRow(index + 1) }], 'armhole');
  push([{ kind: 'bind_off', count: p.underarmCastOff, side: carriageForRow(index + 1) }], 'armhole');

  const decRows = p.ragRows - 2;
  const decAt = spread(p.bodyDecPerSide, decRows); // raglan dec rows over the whole span
  const beforeNeck = Math.max(0, decRows - p.frontNeckDepthRows);

  // Phase A: raglan both edges up to the neck line.
  for (let r = 1; r <= beforeNeck; r++) {
    push(decAt.has(r) ? [{ kind: 'decrease', count: 1, side: 'both' }] : [], 'armhole');
  }
  const widthAtNeck = stitches;

  // Split: hold the centre front. Each side keeps (width − centre) / 2.
  const centre = Math.min(p.frontNeckCentreSts, widthAtNeck - 2);
  push([{ kind: 'bind_off', count: centre, side: 'center' }], 'neck_split');
  const sideStart = Math.floor((widthAtNeck - centre) / 2);

  // Phase B: work each half. The outer (armhole) edge keeps the raglan cadence; the inner
  // (neck) edge decreases for the neck; cast off what little is left at the top.
  const workHalf = (side: 'left' | 'right'): void => {
    const neckEdge: 'L' | 'R' = side === 'left' ? 'R' : 'L';
    const armEdge: 'L' | 'R' = side === 'left' ? 'L' : 'R';
    let sts = sideStart;
    const localPush = (ops: Row['ops'], section: string): void => {
      index += 1;
      for (const op of ops) {
        if (op.kind === 'bind_off') sts -= op.count;
        if (op.kind === 'decrease') sts -= op.count;
      }
      rows.push({ index, piece: 'front', stitches: sts, carriage: carriageForRow(index), ops, section, side });
    };
    for (let r = 1; r <= p.frontNeckDepthRows && sts > 1; r++) {
      const ops: Row['ops'] = [];
      if (decAt.has(beforeNeck + r)) ops.push({ kind: 'decrease', count: 1, side: armEdge }); // raglan continues
      if (r <= p.frontNeckDecPerSide) ops.push({ kind: 'decrease', count: 1, side: neckEdge }); // shape the neck
      localPush(ops, 'neck');
    }
    if (sts > 0) localPush([{ kind: 'bind_off', count: sts, side: armEdge }], 'neck'); // the raglan remainder
  };
  workHalf('left');
  workHalf('right');
  return rows;
}
