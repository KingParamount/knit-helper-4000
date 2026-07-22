import { describe, it, expect } from 'vitest';
import { sizes, findSize } from '../data/sizes';
import { easeStyles } from '../data/options';
import type { EaseStyleId } from '../data/types';
import { DEFAULT_GAUGE } from '../gauge';
import { backRows } from './back';
import { frontRows } from './front';
import { sleevePlan, sleeveRows } from './sleeve';
import { neckbandPlan } from './neckband';
import { assemblyReport } from './assembly';

const G = DEFAULT_GAUGE;
const G2 = { bodySt: 18, bodyRow: (28 * 4) / 5, ribSt: 0, ribRow: 0 };
const G3 = { bodySt: 12, bodyRow: 16, ribSt: 0, ribRow: 0 };
const GAUGES = [G, G2, G3];
const inSizes = sizes.filter((s) => s.units === 'in');
const styles = easeStyles.map((e) => e.id as EaseStyleId);
const W36 = findSize('Woman', 36, 'in')!;

describe('saddle shoulder: cast off and sew, not held', () => {
  it('the body shoulders are cast off (no held short-row shoulders)', () => {
    for (const piece of [backRows(W36, 'moderate', G, 'saddle'), frontRows(W36, 'moderate', G, 'round', 'saddle')]) {
      const shoulderRows = piece.filter((r) => r.section === 'shoulder');
      expect(shoulderRows.some((r) => r.ops.some((o) => o.kind === 'bind_off'))).toBe(true);
      expect(piece.some((r) => r.ops.some((o) => o.kind === 'hold'))).toBe(false);
    }
    // A set-in back, by contrast, holds its shoulders.
    expect(backRows(W36, 'moderate', G, 'set_in').some((r) => r.ops.some((o) => o.kind === 'hold'))).toBe(true);
  });

  it('the sleeve cap narrows to the strap and works it straight, then casts off', () => {
    const sp = sleevePlan(W36, 'moderate', G, 'saddle');
    expect(sp.strapRows).toBeGreaterThan(0);
    expect(sp.capTopSts % 2).toBe(0); // even strap base (symmetric cap decreases)
    const rows = sleeveRows('sleeve_l', W36, 'moderate', G, 'saddle');
    const strap = rows.filter((r) => r.section === 'saddle');
    // strapRows plain rows + one cast-off row.
    expect(strap.length).toBe(sp.strapRows + 1);
    const co = strap[strap.length - 1].ops.find((o) => o.kind === 'bind_off')!;
    expect(co.count).toBe(sp.capTopSts);
    // A set-in sleeve has no strap.
    expect(sleeveRows('sleeve_l', W36, 'moderate', G, 'set_in').some((r) => r.section === 'saddle')).toBe(false);
  });

  it('the neckband picks up both strap ends', () => {
    const np = neckbandPlan(W36, 'moderate', G, 'round', 'saddle', 'scoop');
    expect(np.strapEndSts).toBeGreaterThan(0);
    const setIn = neckbandPlan(W36, 'moderate', G, 'round', 'set_in', 'scoop');
    expect(setIn.strapEndSts).toBe(0);
    expect(np.pickupTotal).toBeGreaterThan(setIn.pickupTotal); // the straps add to the neck
  });
});

describe('Tier-A assembly holds for a saddle (all sizes × 3 gauges)', () => {
  for (const gauge of GAUGES) {
    it(`saddle sews up at ${gauge.bodySt}×${Math.round(gauge.bodyRow)}`, () => {
      for (const s of inSizes) {
        for (const style of styles) {
          const r = assemblyReport(s, style, gauge, 'round', 'saddle', 'scoop');
          expect(r.allOk, `${r.size} ${style}: ${r.invariants.filter((i) => !i.ok).map((i) => i.label)}`).toBe(true);
          // The saddle-specific invariant is present and holds.
          expect(r.invariants.some((i) => i.label === 'saddle strap spans the shoulder')).toBe(true);
        }
      }
    });
  }
});

// Anchor: strap width/length vs Knitware (Phase-3 harvest, 20×26). Width matches closely;
// length runs a touch short because our shoulders run 2–3 st narrower than KW (the known
// across-back gap — it affects set-in too), and the strap tracks OUR shoulder.
describe('saddle strap vs Knitware (20×26 anchor)', () => {
  const KW = { bodySt: 20, bodyRow: 26, ribSt: 0, ribRow: 0 };
  const oracle: [string, number, number, number][] = [
    ['Baby', 18, 8, 14], ['Child', 32, 12, 24], ['Woman', 52, 14, 32], ['Man', 48, 15, 36],
  ];
  for (const [cat, chest, kwWidth, kwRows] of oracle) {
    it(`${cat} ${chest}: strap ${kwWidth}±2 st, ${kwRows} rows (−4..+1)`, () => {
      const sp = sleevePlan(findSize(cat as never, chest, 'in')!, 'moderate', KW, 'saddle');
      expect(Math.abs(sp.capTopSts - kwWidth)).toBeLessThanOrEqual(2);
      expect(sp.strapRows - kwRows).toBeGreaterThanOrEqual(-4);
      expect(sp.strapRows - kwRows).toBeLessThanOrEqual(1);
    });
  }
});
