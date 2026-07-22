import { describe, it, expect } from 'vitest';
import { sizes, findSize } from '../data/sizes';
import { easeStyles } from '../data/options';
import type { EaseStyleId } from '../data/types';
import { DEFAULT_GAUGE } from '../gauge';
import { raglanPlan, raglanBackRows, raglanFrontRows } from './raglan';
import { sleeveRows, sleevePlan } from './sleeve';
import { neckbandPlan } from './neckband';
import { assemblyReport } from './assembly';

const G = DEFAULT_GAUGE;
const G2 = { bodySt: 18, bodyRow: (28 * 4) / 5, ribSt: 0, ribRow: 0 };
const G3 = { bodySt: 12, bodyRow: 16, ribSt: 0, ribRow: 0 };
const GAUGES = [G, G2, G3];
const inSizes = sizes.filter((s) => s.units === 'in');
const styles = easeStyles.map((e) => e.id as EaseStyleId);
const W36 = findSize('Woman', 36, 'in')!;

describe('raglan construction', () => {
  it('the back is one piece: raglan-decreases both edges to the held back neck (no shoulder holds)', () => {
    const rows = raglanBackRows(W36, 'moderate', G);
    expect(rows.some((r) => r.section === 'neck_split')).toBe(false); // not split
    expect(rows.some((r) => r.ops.some((o) => o.kind === 'hold'))).toBe(false); // no short-row shoulder
    const decRows = rows.filter((r) => r.section === 'armhole' && r.ops.some((o) => o.kind === 'decrease'));
    expect(decRows.length).toBeGreaterThan(0);
    const takeOff = rows[rows.length - 1].ops.find((o) => o.kind === 'take_off')!;
    expect(takeOff.count).toBe(raglanPlan(W36, 'moderate', G).backNeckSts); // back neck held for the band
  });

  it('the front splits, shapes the neck AND raglan together, and closes each half to almost nothing', () => {
    const rows = raglanFrontRows(W36, 'moderate', G, 'round');
    expect(rows.some((r) => r.section === 'neck_split')).toBe(true);
    // each half ends casting off only a tiny remainder (the raglan tip), not a shoulder.
    const ends = rows.filter((r) => r.section === 'neck' && r.ops.some((o) => o.kind === 'bind_off' && o.side !== 'center'));
    for (const r of ends) {
      const co = r.ops.find((o) => o.kind === 'bind_off') as { count: number };
      expect(co.count).toBeLessThanOrEqual(3);
    }
  });

  it('the sleeve raglan spans the same rows as the body edge and has no cap crown take-off', () => {
    const sp = sleevePlan(W36, 'moderate', G, 'raglan');
    const rp = raglanPlan(W36, 'moderate', G);
    expect(Math.abs(sp.capHeightRows - rp.ragRows)).toBeLessThanOrEqual(1); // row-for-row seam
    const rows = sleeveRows('sleeve_l', W36, 'moderate', G, 'raglan');
    expect(rows.some((r) => r.section === 'saddle')).toBe(false); // no strap
    // the sleeve ends by casting off its small crown.
    const last = rows[rows.length - 1].ops.find((o) => o.kind === 'bind_off')!;
    expect(last.count).toBe(sp.capTopSts);
  });

  it('the neckband takes in the sleeve tops, not just back + front', () => {
    const raglan = neckbandPlan(W36, 'moderate', G, 'round', 'raglan');
    // sleeve crowns add to the neck circumference; the held back has no shaped side.
    expect(raglan.backSidePickup).toBe(0);
    expect(raglan.pickupTotal).toBeGreaterThan(raglan.backCentreSts + raglan.frontCentreSts + 2 * raglan.frontSidePickup);
  });
});

describe('Tier-A assembly holds for a raglan (all sizes × 3 gauges × neck styles)', () => {
  for (const gauge of GAUGES) {
    it(`raglan sews up at ${gauge.bodySt}×${Math.round(gauge.bodyRow)}`, () => {
      for (const s of inSizes) {
        for (const style of styles) {
          for (const neck of ['round', 'v', 'scoop'] as const) {
            const r = assemblyReport(s, style, gauge, neck, 'raglan', 'scoop');
            expect(r.allOk, `${r.size} ${style}/${neck}: ${r.invariants.filter((i) => !i.ok).map((i) => `${i.label}(${i.detail})`)}`).toBe(true);
            expect(r.invariants.some((i) => i.label === 'raglan seams match')).toBe(true);
          }
        }
      }
    });
  }
});

// Cross-check vs Knitware (Phase-4 harvest): the raglan decreases at ~every-other-row
// (a two-rate cadence), and body and sleeve edges span the same rows. Absolute counts run
// a little high (our back neck is narrower than KW's — the known across-back gap), so we
// check the RATE and the row-for-row match rather than exact decrease counts.
describe('raglan cadence vs Knitware', () => {
  const KW = { bodySt: 20, bodyRow: 26, ribSt: 0, ribRow: 0 };
  for (const [cat, chest] of [['Child', 30], ['Woman', 36], ['Man', 44]] as const) {
    it(`${cat} ${chest}: raglan rate is every-other-row-ish and the seams match`, () => {
      const rp = raglanPlan(findSize(cat, chest, 'in')!, 'moderate', KW);
      const rate = rp.ragRows / rp.bodyDecPerSide; // rows per decrease
      expect(rate).toBeGreaterThanOrEqual(1.9);
      expect(rate).toBeLessThanOrEqual(3.0);
      const sp = sleevePlan(findSize(cat, chest, 'in')!, 'moderate', KW, 'raglan');
      expect(Math.abs(sp.capHeightRows - rp.ragRows)).toBeLessThanOrEqual(1);
    });
  }
});
