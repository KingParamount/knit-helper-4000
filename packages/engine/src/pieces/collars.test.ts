import { describe, it, expect } from 'vitest';
import { sizes, findSize } from '../data/sizes';
import { easeStyles } from '../data/options';
import type { EaseStyleId, CollarStyle } from '../data/types';
import { type Gauge, DEFAULT_GAUGE } from '../gauge';
import { collarDepthIn, collarStitch, neckbandRows } from './neckband';
import { assembleGarment } from './garment';
import { assemblyReport } from './assembly';
import { collarAllowed, collarForcesFlatNeck } from '../fit';

const G = DEFAULT_GAUGE;
const G2 = { bodySt: 18, bodyRow: (28 * 4) / 5, ribSt: 0, ribRow: 0 };
const G3 = { bodySt: 12, bodyRow: 16, ribSt: 0, ribRow: 0 };
const GAUGES = [G, G2, G3];
const KW: Gauge = { bodySt: 20, bodyRow: 26, ribSt: 20, ribRow: 26 };
const inSizes = sizes.filter((s) => s.units === 'in');
const styles = easeStyles.map((e) => e.id as EaseStyleId);
const W36 = findSize('Woman', 36, 'in')!;
const W50 = findSize('Woman', 50, 'in')!;
const BUILT: CollarStyle[] = ['single_band', 'double_band', 'turtleneck', 'funnel', 'cowl', 'rolled_edge', 'none'];

describe('collar depths match the harvest', () => {
  it('W36 Collar Length: single 1.0 / double 2.0 / rolled 2.5 / funnel 2.0 / turtle 5.0 / cowl 11.3', () => {
    expect(collarDepthIn(W36, 'single_band')).toBeCloseTo(1.0, 1);
    expect(collarDepthIn(W36, 'double_band')).toBeCloseTo(2.0, 1);
    expect(collarDepthIn(W36, 'rolled_edge')).toBeCloseTo(2.5, 1);
    expect(collarDepthIn(W36, 'funnel')).toBeCloseTo(2.0, 1);
    expect(collarDepthIn(W36, 'turtleneck')).toBeCloseTo(5.0, 1);
    expect(collarDepthIn(W36, 'cowl')).toBeCloseTo(11.2, 1); // 2.25 × 0.37 × 13.5 (KW 11.3)
    expect(collarDepthIn(W36, 'none')).toBe(0);
  });

  it('turtle scales with size and the cowl is ~2.25× the turtleneck', () => {
    expect(collarDepthIn(W50, 'turtleneck')).toBeGreaterThan(collarDepthIn(W36, 'turtleneck'));
    for (const s of [W36, W50]) {
      expect(collarDepthIn(s, 'cowl') / collarDepthIn(s, 'turtleneck')).toBeCloseTo(2.25, 1);
    }
  });

  it('rib holds its shape; a rolled edge and a cowl are stocking', () => {
    expect(collarStitch('turtleneck')).toBe('rib');
    expect(collarStitch('funnel')).toBe('rib');
    expect(collarStitch('rolled_edge')).toBe('stocking');
    expect(collarStitch('cowl')).toBe('stocking');
  });
});

describe('collar couplings', () => {
  it('funnel and cowl force a flat front + flat back (the collar clears the head)', () => {
    expect(collarForcesFlatNeck('funnel')).toBe(true);
    expect(collarForcesFlatNeck('cowl')).toBe(true);
    for (const c of ['funnel', 'cowl'] as CollarStyle[]) {
      const g = assembleGarment(W36, 'moderate', KW, 'round', 'set_in', 'scoop', { collarStyle: c });
      expect(g.neck, c).toBe('flat');
      expect(g.backNeck, c).toBe('flat');
      expect(g.collar).toBe(c);
    }
  });

  it('a boat takes a single band only (any other collar falls back)', () => {
    expect(collarAllowed('turtleneck', 'boat', 'flat')).toBe(false);
    expect(collarAllowed('single_band', 'boat', 'flat')).toBe(true);
    const g = assembleGarment(W36, 'moderate', KW, 'boat', 'set_in', 'boat', { collarStyle: 'turtleneck' });
    expect(g.collar).toBe('single_band');
  });

  it('turtleneck needs a round/flat front and a flat back (never backless — no literal turtles)', () => {
    expect(collarAllowed('turtleneck', 'round', 'flat')).toBe(true);
    expect(collarAllowed('turtleneck', 'flat', 'flat')).toBe(true);
    expect(collarAllowed('turtleneck', 'v', 'flat')).toBe(false); // front must be round/flat
    expect(collarAllowed('turtleneck', 'scoop', 'flat')).toBe(false);
    expect(collarAllowed('turtleneck', 'round', 'scoop')).toBe(false); // back must be flat
    // the mild bands go with anything
    expect(collarAllowed('double_band', 'v', 'scoop')).toBe(true);
    expect(collarAllowed('rolled_edge', 'scoop', 'square')).toBe(true);
  });

  it('no collar is an empty neckband; every other collar has a band with depth', () => {
    expect(assembleGarment(W36, 'moderate', KW, 'round', 'set_in', 'flat', { collarStyle: 'none' }).neckband).toHaveLength(0);
    for (const c of ['single_band', 'turtleneck', 'cowl', 'rolled_edge', 'double_band'] as CollarStyle[]) {
      const neck = c === 'cowl' ? 'flat' : 'round';
      expect(neckbandRows(W36, 'moderate', KW, neck, 'set_in', 'hand', 'flat', c).length, c).toBeGreaterThan(2);
    }
  });
});

// Tier A: every collar must still sew together, at every size, ease and gauge (the band is a
// separate piece, so the body invariants are collar-independent — this guards against a
// collar that breaks a build).
describe('collars assemble across sizes, ease and gauge', () => {
  for (const collar of BUILT) {
    // funnel/cowl force a flat neck; pass it so the report matches what is built.
    const neck = collar === 'funnel' || collar === 'cowl' ? 'flat' : 'round';
    for (const gauge of GAUGES) {
      for (const style of styles) {
        for (const size of inSizes) {
          it(`${collar} — ${style} ${size.category} ${size.chest}" @${gauge.bodySt}×${gauge.bodyRow}`, () => {
            const rep = assemblyReport(size, style, gauge, neck, 'set_in', 'flat', { collarStyle: collar });
            const bad = rep.invariants.filter((i) => !i.ok).map((i) => `${i.label} (${i.detail})`);
            expect(bad, bad.join('; ')).toEqual([]);
          });
        }
      }
    }
  }
});
