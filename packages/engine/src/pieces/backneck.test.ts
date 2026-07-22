import { describe, it, expect } from 'vitest';
import { sizes, findSize } from '../data/sizes';
import { easeStyles } from '../data/options';
import type { EaseStyleId } from '../data/types';
import { DEFAULT_GAUGE } from '../gauge';
import { backPlan, backRows } from './back';
import { neckbandPlan } from './neckband';
import { assemblyReport } from './assembly';
import { flatBackAllowed, neckHeadFit } from '../fit';

// The three sweep gauges (see assembly.test.ts): default 4:3, a coarse non-4:3, and chunky.
const G = DEFAULT_GAUGE;
const G2 = { bodySt: 18, bodyRow: (28 * 4) / 5, ribSt: 0, ribRow: 0 };
const G3 = { bodySt: 12, bodyRow: 16, ribSt: 0, ribRow: 0 };
const GAUGES = [G, G2, G3];
const inSizes = sizes.filter((s) => s.units === 'in');
const styles = easeStyles.map((e) => e.id as EaseStyleId);
const W36 = findSize('Woman', 36, 'in')!;

describe('back-neck style: scoop (default) vs flat', () => {
  it('scoop is the default and curves each side', () => {
    const scoop = backPlan(W36, 'moderate', G);
    const dflt = backPlan(W36, 'moderate', G, 'set_in');
    expect(scoop.backNeckPerSide).toBeGreaterThan(0);
    expect(scoop.backNeckCentreSts).toBe(dflt.backNeckCentreSts); // 'scoop' is the default
    expect(scoop.backNeckCentreSts).toBe(scoop.backNeckSts - 2 * scoop.backNeckPerSide);
  });

  it('flat casts the whole back neck off straight across — no side curve', () => {
    const flat = backPlan(W36, 'moderate', G, 'set_in', 'flat');
    expect(flat.backNeckPerSide).toBe(0);
    expect(flat.backNeckCentreSts).toBe(flat.backNeckSts); // full width, one cast-off
  });

  it('flat back rows: one straight centre cast-off, no neck shaping, both shoulders held', () => {
    const rows = backRows(W36, 'moderate', G, 'set_in', 'flat');
    const split = rows.find((r) => r.section === 'neck_split')!;
    const co = split.ops.find((o) => o.kind === 'bind_off')!;
    expect(co.count).toBe(backPlan(W36, 'moderate', G, 'set_in', 'flat').backNeckSts);
    // A flat back has no shaped neck edge — no 'neck' section rows at all.
    expect(rows.some((r) => r.section === 'neck')).toBe(false);
    // Both shoulders are still short-rowed and held (one hold run per side).
    const holdSides = new Set(
      rows.filter((r) => r.ops.some((o) => o.kind === 'hold')).map((r) => r.side),
    );
    expect(holdSides.has('left')).toBe(true);
    expect(holdSides.has('right')).toBe(true);
  });

  it('scoop back rows DO shape the neck edge', () => {
    const rows = backRows(W36, 'moderate', G, 'set_in', 'scoop');
    expect(rows.some((r) => r.section === 'neck')).toBe(true);
  });
});

describe('neckband follows the back-neck style', () => {
  it('a flat back has no side edge to pick up along; a scoop does', () => {
    const flat = neckbandPlan(W36, 'moderate', G, 'round', 'set_in', 'flat');
    const scoop = neckbandPlan(W36, 'moderate', G, 'round', 'set_in', 'scoop');
    expect(flat.backSidePickup).toBe(0);
    expect(scoop.backSidePickup).toBeGreaterThan(0);
    // The flat band picks up 1:1 along the full back-neck cast-off instead.
    expect(flat.backCentreSts).toBeGreaterThan(scoop.backCentreSts);
  });
});

describe('flat-back head-clearance block (the agreed UI policy)', () => {
  it('a scoop always clears the head (it is solved to)', () => {
    for (const s of inSizes) {
      if (s.category === 'Baby') continue; // babies are crew_unsuitable → placket
      expect(neckHeadFit(s, 'scoop').fits).toBe(true);
    }
  });

  it('a flat back is blocked only where the head will not clear it', () => {
    // Calibrated to our head_circ data: the two smallest children fail, everyone else clears.
    expect(flatBackAllowed(findSize('Child', 20, 'in')!, 'round')).toBe(false);
    expect(flatBackAllowed(findSize('Child', 22, 'in')!, 'round')).toBe(false);
    expect(flatBackAllowed(findSize('Child', 24, 'in')!, 'round')).toBe(true);
    for (const c of [30, 40, 56]) expect(flatBackAllowed(findSize('Woman', c, 'in')!, 'round')).toBe(true);
    for (const c of [32, 44, 52]) expect(flatBackAllowed(findSize('Man', c, 'in')!, 'round')).toBe(true);
    // A V front is open, so a flat back is always fine with it.
    expect(flatBackAllowed(findSize('Child', 20, 'in')!, 'v')).toBe(true);
  });
});

describe('Tier-A assembly still holds with a flat back (all sizes × 3 gauges)', () => {
  for (const gauge of GAUGES) {
    it(`flat back sews up at ${gauge.bodySt}×${Math.round(gauge.bodyRow)}`, () => {
      for (const s of inSizes) {
        for (const style of styles) {
          const r = assemblyReport(s, style, gauge, 'round', 'set_in', 'flat');
          expect(r.allOk, `${r.size} ${style}: ${r.invariants.filter((i) => !i.ok).map((i) => i.label)}`).toBe(true);
        }
      }
    });
  }
});

// Anchor: the flat back neck matches Knitware's ground truth (crew-setin-20x26 sweep,
// batch-1 harvest, which is a FLAT back). We run narrower than KW by 1–3 sts (our
// back_neck measurement is slightly under KW's top-neck-opening); lock that band.
describe('flat back neck vs Knitware (20×26 anchor)', () => {
  const KW = { bodySt: 20, bodyRow: 26, ribSt: 0, ribRow: 0 };
  const oracle: [string, number, number][] = [
    ['Woman', 36, 32], ['Woman', 56, 42],
    ['Man', 32, 32], ['Man', 52, 43],
    ['Child', 24, 27], ['Child', 30, 29],
    ['Baby', 18, 21], ['Baby', 22, 23],
  ];
  for (const [cat, chest, kwBackNeck] of oracle) {
    it(`${cat} ${chest}: flat back neck within 3 st of Knitware's ${kwBackNeck}`, () => {
      const bp = backPlan(findSize(cat as never, chest, 'in')!, 'moderate', KW, 'set_in', 'flat');
      expect(Math.abs(bp.backNeckCentreSts - kwBackNeck)).toBeLessThanOrEqual(3);
    });
  }
});
