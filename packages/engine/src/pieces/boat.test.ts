import { describe, it, expect } from 'vitest';
import { sizes, findSize } from '../data/sizes';
import { easeStyles } from '../data/options';
import type { EaseStyleId } from '../data/types';
import { type Gauge, DEFAULT_GAUGE } from '../gauge';
import { boatPlan, boatPieceRows } from './boat';
import { assemblyReport } from './assembly';
import { boatAllowed } from '../fit';
import { backPlan } from './back';
import { boatSchematic } from '../render/schematic';

const G = DEFAULT_GAUGE;
const G2 = { bodySt: 18, bodyRow: (28 * 4) / 5, ribSt: 0, ribRow: 0 };
const G3 = { bodySt: 12, bodyRow: 16, ribSt: 0, ribRow: 0 };
const GAUGES = [G, G2, G3];
const KW: Gauge = { bodySt: 20, bodyRow: 26, ribSt: 20, ribRow: 26 };

const inSizes = sizes.filter((s) => s.units === 'in');
const styles = easeStyles.map((e) => e.id as EaseStyleId);
const W36 = findSize('Woman', 36, 'in')!;
const W50 = findSize('Woman', 50, 'in')!;
const Ch24 = findSize('Child', 24, 'in')!;

describe('boat: a whole-garment straight-topped construction', () => {
  it('the neck opening runs ~0.69 of the upper-body width (harvest 0.68–0.69)', () => {
    for (const size of [W36, W50, Ch24]) {
      const p = boatPlan(size, 'moderate', KW);
      const frac = p.openingSts / p.upperSts;
      expect(frac).toBeGreaterThan(0.66);
      expect(frac).toBeLessThan(0.72);
    }
  });

  it('the integral band depth matches the body ribbing (rib_body)', () => {
    // Woman 36 rib_body 2.5" → ~2.5"; the harvest reads 2.5/3.0/1.8" for W36/W50/Ch24.
    const bandIn = (size: typeof W36): number => (boatPlan(size, 'moderate', KW).bandRows * 4) / KW.bodyRow;
    expect(bandIn(W36)).toBeCloseTo(2.5, 1);
    expect(bandIn(W50)).toBeCloseTo(3.1, 1);
  });

  it('opening + two shoulder seams span the whole upper width', () => {
    const p = boatPlan(W36, 'moderate', G);
    expect(p.openingSts + 2 * p.shoulderSeamSts).toBe(p.upperSts);
    expect(p.shoulderSeamSts).toBeGreaterThan(0);
  });

  it('front and back are the same piece (built alike), ending in a full cast-off', () => {
    const front = boatPieceRows('front', W36, 'moderate', G);
    const back = boatPieceRows('back', W36, 'moderate', G);
    expect(front.length).toBe(back.length);
    // Same construction ignoring the piece label.
    expect(front.map((r) => ({ ...r, piece: 'x' }))).toEqual(back.map((r) => ({ ...r, piece: 'x' })));
    const last = front[front.length - 1];
    expect(last.stitches).toBe(0);
    expect(last.ops[0]).toMatchObject({ kind: 'bind_off' });
  });

  it('has an integral rib band and no neck or shoulder shaping', () => {
    const rows = boatPieceRows('back', W36, 'moderate', G);
    expect(rows.some((r) => r.section === 'boat_band')).toBe(true);
    expect(rows.some((r) => r.section === 'neck' || r.section === 'shoulder' || r.section === 'neck_split')).toBe(false);
    expect(rows.some((r) => r.ops.some((o) => o.kind === 'hold'))).toBe(false); // no held shoulders
  });

  it('is a set-in or drop shoulder only (saddle & raglan blocked)', () => {
    expect(boatAllowed('set_in')).toBe(true);
    expect(boatAllowed('drop')).toBe(true);
    expect(boatAllowed('saddle')).toBe(false);
    expect(boatAllowed('raglan')).toBe(false);
  });
});

describe('boat schematic: a straight-topped piece, not a back-neck notch', () => {
  it('draws a flat top and marks the band + opening (no neck cutout)', () => {
    const bp = backPlan(W36, 'moderate', KW, 'set_in', 'flat');
    const bplan = boatPlan(W36, 'moderate', KW);
    const s = boatSchematic(boatPieceRows('back', W36, 'moderate', KW), { ...bp, bandRows: bplan.bandRows, openingSts: bplan.openingSts }, KW);
    // Two outline points share the top y — a flat top edge, symmetric about centre.
    const top = s.outline.filter((p) => p.y === s.heightRows).map((p) => p.x).sort((a, b) => a - b);
    expect(top.length).toBeGreaterThanOrEqual(2);
    expect(top[0]).toBeCloseTo(-top[top.length - 1], 5);
    // The band and the neck opening are both dimensioned; there is no 'back neck' notch.
    expect(s.measures.some((m) => m.label === 'band')).toBe(true);
    expect(s.measures.some((m) => m.label === 'neck open' && m.sts === bplan.openingSts)).toBe(true);
    expect(s.measures.some((m) => m.label === 'neck depth')).toBe(false);
  });
});

// Tier A: the boat must sew together at every size, ease and gauge, for set-in and drop.
describe('boat assembles across all sizes, ease and gauge', () => {
  for (const shoulder of ['set_in', 'drop'] as const) {
    for (const gauge of GAUGES) {
      for (const style of styles) {
        for (const size of inSizes) {
          it(`${shoulder} — ${style} ${size.category} ${size.chest}" @${gauge.bodySt}×${gauge.bodyRow}`, () => {
            const rep = assemblyReport(size, style, gauge, 'boat', shoulder, 'boat');
            const bad = rep.invariants.filter((i) => !i.ok).map((i) => `${i.label} (${i.detail})`);
            expect(bad, bad.join('; ')).toEqual([]);
          });
        }
      }
    }
  }
});
