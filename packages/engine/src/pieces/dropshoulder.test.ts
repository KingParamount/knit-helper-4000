import { describe, it, expect } from 'vitest';
import { sizes } from '../data/sizes';
import { easeStyles } from '../data/options';
import type { EaseStyleId } from '../data/types';
import { DEFAULT_GAUGE, stitchesFor } from '../gauge';
import { garmentWidths } from '../dimensions';
import { assemblyReport } from './assembly';
import { backPlan, backRows } from './back';
import { sleevePlan, sleeveRows } from './sleeve';

const G = DEFAULT_GAUGE;
const inSizes = sizes.filter((s) => s.units === 'in');
const styles = easeStyles.map((e) => e.id as EaseStyleId);

// The drop shoulder runs through the SAME Tier-A assembly harness as the set-in —
// only the sleeve↔body join differs (a straight sleeve top sewn to a straight armhole
// instead of a cap eased into a scye).
describe('drop shoulder: Tier-A assembly invariants hold (all sizes × styles)', () => {
  for (const style of styles) {
    for (const size of inSizes) {
      const rep = assemblyReport(size, style, G, 'round', 'drop');
      for (const inv of rep.invariants) {
        it(`${style} ${size.category} ${size.chest}" — ${inv.label}`, () => {
          expect(inv.ok).toBe(true);
        });
      }
    }
  }
});

describe('drop shoulder: straight body, straight sleeve top, matched join', () => {
  it('knits the body straight — no armhole narrowing', () => {
    for (const size of inSizes) {
      const bp = backPlan(size, 'moderate', G, 'drop');
      expect(bp.upperBackSts, `${size.category} ${size.chest}"`).toBe(bp.bodySts);
    }
  });

  it('binds the sleeve top off straight — no cap', () => {
    for (const size of inSizes) {
      const p = sleevePlan(size, 'moderate', G, 'drop');
      expect(p.capHeightRows, `${size.category} ${size.chest}"`).toBe(0);
      expect(p.underarmCastOff).toBe(0);
      expect(p.capTopSts).toBe(p.sleeveTopSts); // whole top bound off in one step
      const rows = sleeveRows('sleeve_l', size, 'moderate', G, 'drop');
      expect(rows[rows.length - 1].stitches).toBe(0); // fully cast off
    }
  });

  it('the sleeve top width matches the armhole opening (2 × depth)', () => {
    const sw = 4 / G.bodySt;
    for (const size of inSizes) {
      const p = sleevePlan(size, 'moderate', G, 'drop');
      const armholeOpen = 2 * garmentWidths(size, 'moderate', 'drop').armholeDepth;
      const sleeveTop = p.sleeveTopSts * sw;
      expect(Math.abs(sleeveTop - armholeOpen), `${size.category} ${size.chest}"`).toBeLessThanOrEqual(0.6);
    }
  });

  it('back generates and ends with shoulders held (drop, wide shoulders)', () => {
    const size = inSizes.find((s) => s.category === 'Woman' && s.chest === 40)!;
    const rows = backRows(size, 'moderate', G, 'drop');
    expect(rows[rows.length - 1].section).toBe('shoulder');
    // drop shoulders are the full body width minus the neck, so wider than a set-in
    const bpDrop = backPlan(size, 'moderate', G, 'drop');
    const bpSetin = backPlan(size, 'moderate', G, 'set_in');
    expect(bpDrop.upperBackSts).toBeGreaterThan(bpSetin.upperBackSts);
  });
});
