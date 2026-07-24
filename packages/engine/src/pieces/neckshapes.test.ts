import { describe, it, expect } from 'vitest';
import { sizes, findSize } from '../data/sizes';
import { easeStyles } from '../data/options';
import type { EaseStyleId } from '../data/types';
import { type Gauge, DEFAULT_GAUGE } from '../gauge';
import { frontNeckPlan, frontNeckSplit, frontRows } from './front';
import { backPlan } from './back';
import { neckbandPlan } from './neckband';
import { assemblyReport } from './assembly';
import { neckHeadFit, highRoundFrontAllowed, highRoundBackAllowed } from '../fit';
import { makingUpProse } from '../render/prose';

// The three sweep gauges (see assembly.test.ts): default 4:3, a coarse non-4:3, chunky.
const G = DEFAULT_GAUGE;
const G2 = { bodySt: 18, bodyRow: (28 * 4) / 5, ribSt: 0, ribRow: 0 };
const G3 = { bodySt: 12, bodyRow: 16, ribSt: 0, ribRow: 0 };
const GAUGES = [G, G2, G3];
// The harvest gauge, for oracle comparisons against Knitware's own numbers.
const KW: Gauge = { bodySt: 20, bodyRow: 26, ribSt: 20, ribRow: 26 };

const inSizes = sizes.filter((s) => s.units === 'in');
const styles = easeStyles.map((e) => e.id as EaseStyleId);
const W36 = findSize('Woman', 36, 'in')!;
const W50 = findSize('Woman', 50, 'in')!;
const Ch24 = findSize('Child', 24, 'in')!;

const depthIn = (rows: number, g: Gauge): number => (rows * 4) / g.bodyRow;

describe('square neck: a full-width flat base with vertical sides', () => {
  it('splits the whole front neck off straight across (like a flat), no side curve', () => {
    const fp = frontNeckPlan(W36, 'moderate', G, 'square');
    const split = frontNeckSplit('square', fp.frontNeckSts, G);
    expect(split.perSide).toBe(0);
    expect(split.centreCastOff).toBe(fp.frontNeckSts); // whole neck cast off at the base
  });

  it('has real, deeper-than-crew depth (its shape is the depth, not a curve)', () => {
    const sq = frontNeckPlan(W36, 'moderate', G, 'square').neckDepthRows;
    const crew = frontNeckPlan(W36, 'moderate', G, 'round').neckDepthRows;
    expect(sq).toBeGreaterThan(crew);
  });

  it('matches the modern-square depth target (neck_depth × 1.1) at the harvest gauge', () => {
    // Woman 36 neck_depth 3.6 → ~4.0"; Woman 50 4.2 → ~4.6"; Child 24 2.4 → ~2.6".
    expect(depthIn(frontNeckPlan(W36, 'moderate', KW, 'square').neckDepthRows, KW)).toBeCloseTo(4.0, 1);
    expect(depthIn(frontNeckPlan(W50, 'moderate', KW, 'square').neckDepthRows, KW)).toBeCloseTo(4.6, 1);
    expect(depthIn(frontNeckPlan(Ch24, 'moderate', KW, 'square').neckDepthRows, KW)).toBeCloseTo(2.6, 1);
  });

  it('front rows: one straight base cast-off, no shaped neck edge, straight vertical sides', () => {
    const rows = frontRows(W36, 'moderate', G, 'square');
    const split = rows.find((r) => r.section === 'neck_split')!;
    const co = split.ops.find((o) => o.kind === 'bind_off')!;
    expect(co.count).toBe(frontNeckPlan(W36, 'moderate', G, 'square').frontNeckSts);
    expect(rows.some((r) => r.section === 'neck')).toBe(false); // no side shaping
  });

  it('the back mirrors the front: a flat base at a real depth (perSide 0, deep)', () => {
    const bp = backPlan(W36, 'moderate', G, 'set_in', 'square');
    expect(bp.backNeckPerSide).toBe(0);
    expect(bp.backNeckCentreSts).toBe(bp.backNeckSts); // whole width cast off flat
    expect(bp.backNeckRows).toBeGreaterThan(backPlan(W36, 'moderate', G, 'set_in', 'flat').backNeckRows);
  });

  it('the band picks up along the vertical sides even though perSide is 0', () => {
    // A flat back has no side edge (0); a square back does — its depth is a real edge.
    const sq = neckbandPlan(W36, 'moderate', G, 'square', 'set_in', 'square');
    const flat = neckbandPlan(W36, 'moderate', G, 'flat', 'set_in', 'flat');
    expect(sq.frontSidePickup).toBeGreaterThan(0);
    expect(sq.backSidePickup).toBeGreaterThan(0);
    expect(flat.backSidePickup).toBe(0);
  });

  it('is deep and wide, so it always clears the head (never gated)', () => {
    for (const size of inSizes) {
      expect(neckHeadFit(size, 'square', 'square').fits).toBe(true);
    }
  });
});

describe('high round: a shallow crew, decreases only', () => {
  it('is shallower than a crew', () => {
    const hr = frontNeckPlan(W36, 'moderate', G, 'high_round').neckDepthRows;
    const crew = frontNeckPlan(W36, 'moderate', G, 'round').neckDepthRows;
    expect(hr).toBeLessThan(crew);
  });

  it('matches the harvest depth (neck_depth × 0.6): W36 ≈ 2.2", W50 ≈ 2.5"', () => {
    expect(depthIn(frontNeckPlan(W36, 'moderate', KW, 'high_round').neckDepthRows, KW)).toBeCloseTo(2.2, 1);
    expect(depthIn(frontNeckPlan(W50, 'moderate', KW, 'high_round').neckDepthRows, KW)).toBeCloseTo(2.5, 1);
  });

  it('shapes its sides with decreases only — no cast-off step (unlike a crew)', () => {
    const neckRows = frontRows(W36, 'moderate', G, 'high_round').filter((r) => r.section === 'neck');
    expect(neckRows.length).toBeGreaterThan(0);
    expect(neckRows.every((r) => r.ops.every((o) => o.kind !== 'bind_off'))).toBe(true);
  });

  it('is gated on a small child when the back is also shallow (a scoop back rescues it)', () => {
    // Paired with a shallow flat back, a high-round front won't clear a toddler's head.
    expect(highRoundFrontAllowed(Ch24, 'flat')).toBe(false);
    // Adults clear even then; and the head-solving scoop back opens the child's enough.
    expect(highRoundFrontAllowed(W36, 'flat')).toBe(true);
    expect(highRoundFrontAllowed(Ch24, 'scoop')).toBe(true);
    // A high-round BACK behind a high-round front is the shallowest pairing → blocked small.
    expect(highRoundBackAllowed(Ch24, 'high_round')).toBe(false);
  });
});

describe('square corner mitre appears in the making-up prose', () => {
  it('machine: a seamed mitre, 2 corners for a square front, 4 if the back is square too', () => {
    const front = makingUpProse('square', 'set_in', 'verbose', 'machine', false, 'flat').lines.join(' ');
    expect(front).toMatch(/square/i);
    expect(front).toMatch(/2 right-angle corners/);
    expect(front).toMatch(/mitre/i);
    const both = makingUpProse('square', 'set_in', 'verbose', 'machine', false, 'square').lines.join(' ');
    expect(both).toMatch(/4 right-angle corners/);
  });

  it('hand: the corner is shaped in place (SSK / K2tog) as the picked-up band is worked', () => {
    const hand = makingUpProse('square', 'set_in', 'verbose', 'hand', false, 'flat').lines.join(' ');
    expect(hand).toMatch(/SSK/);
    expect(hand).toMatch(/K2tog/);
    expect(hand).toMatch(/2 corners/);
  });

  it('a non-square neck gets no corner-mitre note', () => {
    const crew = makingUpProse('round', 'set_in', 'verbose', 'machine', false, 'scoop').lines.join(' ');
    expect(crew).not.toMatch(/mitre|right-angle corner/i);
  });
});

// Tier A: every square / high-round combination must still sew together, at every size,
// ease and gauge — head-fit (Tier B, the gate above) is separate from sew-up.
describe('square & high-round assemble across all sizes, ease and gauge', () => {
  const combos: Array<[string, 'square' | 'high_round' | 'round', 'square' | 'high_round' | 'scoop' | 'flat']> = [
    ['square/flat', 'square', 'flat'],
    ['square/square', 'square', 'square'],
    ['highRound/scoop', 'high_round', 'scoop'],
    ['crew/highRound', 'round', 'high_round'],
  ];
  for (const [label, neck, backNeck] of combos) {
    for (const gauge of GAUGES) {
      for (const style of styles) {
        for (const size of inSizes) {
          it(`${label} — ${style} ${size.category} ${size.chest}" @${gauge.bodySt}×${gauge.bodyRow}`, () => {
            const rep = assemblyReport(size, style, gauge, neck, 'set_in', backNeck);
            const bad = rep.invariants.filter((i) => !i.ok).map((i) => `${i.label} (${i.detail})`);
            expect(bad, bad.join('; ')).toEqual([]);
          });
        }
      }
    }
  }
});
