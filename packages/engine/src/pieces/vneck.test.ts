import { describe, it, expect } from 'vitest';
import { sizes } from '../data/sizes';
import { easeStyles } from '../data/options';
import type { EaseStyleId } from '../data/types';
import { DEFAULT_GAUGE } from '../gauge';
import { assemblyReport } from './assembly';
import { frontRows, frontNeckPlan } from './front';
import { backPlan, armholeShaping } from './back';
import { neckbandPlan } from './neckband';

const G = DEFAULT_GAUGE;
const inSizes = sizes.filter((s) => s.units === 'in');
const styles = easeStyles.map((e) => e.id as EaseStyleId);

// The v-neck runs through the SAME Tier-A assembly harness as the crew — a new style
// just has to pass it. Only the front neck differs; the shoulders must still graft.
describe('v-neck: Tier-A assembly invariants hold (all sizes × styles)', () => {
  for (const style of styles) {
    for (const size of inSizes) {
      const rep = assemblyReport(size, style, G, 'v');
      for (const inv of rep.invariants) {
        it(`${style} ${size.category} ${size.chest}" — ${inv.label}`, () => {
          expect(inv.ok).toBe(true);
        });
      }
    }
  }
});

describe('v-neck: it is a deep V that grafts and bands', () => {
  it('grafts to the back shoulder at every size', () => {
    for (const size of inSizes) {
      const bp = backPlan(size, 'moderate', G);
      const backShoulder = Math.round(
        (armholeShaping(bp.bodySts, bp.upperBackSts).achievedSts - bp.backNeckSts) / 2,
      );
      const fp = frontNeckPlan(size, 'moderate', G, 'v');
      expect(fp.shoulderSts, `${size.category} ${size.chest}"`).toBe(backShoulder);
    }
  });

  it('is deeper than the crew and has no centre cast-off', () => {
    for (const size of inSizes) {
      const v = frontNeckPlan(size, 'moderate', G, 'v');
      const crew = frontNeckPlan(size, 'moderate', G, 'round');
      expect(v.neckDepthRows, `${size.category} ${size.chest}"`).toBeGreaterThanOrEqual(crew.neckDepthRows);
      // the split row carries no centre bind-off for a V
      const rows = frontRows(size, 'moderate', G, 'v');
      const split = rows.find((r) => r.section === 'neck_split')!;
      expect(split.ops).toEqual([]);
    }
  });

  it('picks up the band along the two V edges (front centre = 0, side runs the V)', () => {
    for (const size of inSizes) {
      const nb = neckbandPlan(size, 'moderate', G, 'v');
      expect(nb.frontCentreSts, `${size.category} ${size.chest}"`).toBe(0);
      expect(nb.frontSidePickup).toBeGreaterThan(0);
      expect(nb.pickupTotal).toBeGreaterThan(0);
    }
  });

  it('front ends with the two shoulders held for grafting (fully worked)', () => {
    const rows = frontRows(sizes.find((s) => s.category === 'Woman' && s.chest === 40)!, 'moderate', G, 'v');
    const held = rows
      .flatMap((r) => r.ops)
      .filter((o) => o.kind === 'hold')
      .reduce((n, o) => n + (o.kind === 'hold' ? o.count : 0), 0);
    const fp = frontNeckPlan(sizes.find((s) => s.category === 'Woman' && s.chest === 40)!, 'moderate', G, 'v');
    expect(held).toBe(2 * fp.shoulderSts);
  });
});
