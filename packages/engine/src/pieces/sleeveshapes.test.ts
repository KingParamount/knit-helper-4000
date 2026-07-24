import { describe, it, expect } from 'vitest';
import { sizes, findSize } from '../data/sizes';
import { easeStyles } from '../data/options';
import type { EaseStyleId, SleeveStyle } from '../data/types';
import { type Gauge, DEFAULT_GAUGE, evenStitchesFor } from '../gauge';
import { sleevePlan, sleeveRows } from './sleeve';
import { assemblyReport } from './assembly';
import { sleeveShapeAllowed } from '../fit';

const G = DEFAULT_GAUGE;
const G2 = { bodySt: 18, bodyRow: (28 * 4) / 5, ribSt: 0, ribRow: 0 };
const G3 = { bodySt: 12, bodyRow: 16, ribSt: 0, ribRow: 0 };
const GAUGES = [G, G2, G3];
const KW: Gauge = { bodySt: 20, bodyRow: 26, ribSt: 20, ribRow: 26 };

const inSizes = sizes.filter((s) => s.units === 'in');
const styles = easeStyles.map((e) => e.id as EaseStyleId);
const W36 = findSize('Woman', 36, 'in')!;
const W50 = findSize('Woman', 50, 'in')!;

const plan = (size: typeof W36, sleeveStyle: SleeveStyle, ease: EaseStyleId = 'moderate', gauge: Gauge = KW) =>
  sleevePlan(size, ease, gauge, 'set_in', { sleeveStyle });

describe('sleeve shapes: the top is pinned to the armhole; the shape lives below the cap', () => {
  it('every shape but narrow_taper keeps the moderate sleeve top (and its cap)', () => {
    for (const size of [W36, W50]) {
      const mod = plan(size, 'moderate_taper');
      for (const s of ['lantern', 'modified_lantern', 'bishop', 'bell'] as SleeveStyle[]) {
        const p = plan(size, s);
        expect(p.sleeveTopSts, s).toBe(mod.sleeveTopSts); // top unchanged
        expect(p.capHeightRows, s).toBe(mod.capHeightRows); // cap unchanged
        expect(p.capDecPerSide, s).toBe(mod.capDecPerSide);
      }
      expect(plan(size, 'narrow_taper').sleeveTopSts).toBeLessThan(mod.sleeveTopSts); // slimmer
    }
  });

  it('bell casts on a wide cuff (~1.4× the top) and decreases up — no gather', () => {
    const p = plan(W36, 'bell');
    expect(p.bodyCuffSts / p.sleeveTopSts).toBeGreaterThan(1.33);
    expect(p.bodyCuffSts / p.sleeveTopSts).toBeLessThan(1.5);
    expect(p.gatherSts).toBe(0); // the wide part is the cuff itself
    expect(p.shapePerSide).toBeLessThan(0); // decreases up to the top
  });

  it('bishop gathers a wrist cuff out to a blouse ~3" wider than the top, then decreases up', () => {
    const p = plan(W36, 'bishop');
    expect(p.gatherSts).toBeGreaterThan(0); // gathered cuff
    expect(p.bloomSts - p.sleeveTopSts).toBeCloseTo(evenStitchesFor(3.0, KW), 0); // ~+3"
    expect(p.shapePerSide).toBeLessThan(0); // decreases up
  });

  it('lantern gathers straight up (bloom = top, no taper); modified is a gentle taper', () => {
    const lant = plan(W36, 'lantern');
    expect(lant.gatherSts).toBeGreaterThan(0);
    expect(lant.bloomSts).toBe(lant.sleeveTopSts);
    expect(lant.shapePerSide).toBe(0); // straight
    const mod = plan(W36, 'modified_lantern');
    expect(mod.gatherSts).toBeGreaterThan(0);
    expect(mod.shapePerSide).toBeGreaterThan(0); // a gentle increase to the top
    expect(mod.bloomSts).toBeLessThan(mod.sleeveTopSts);
  });

  it('the gather is an even increase-across on the first body row (bishop/lantern), none for bell', () => {
    const bishopGather = sleeveRows('sleeve_l', W36, 'moderate', KW, 'set_in', { sleeveStyle: 'bishop' })
      .some((r) => r.ops.some((o) => o.kind === 'increase' && o.side === 'across'));
    expect(bishopGather).toBe(true);
    const bellGather = sleeveRows('sleeve_l', W36, 'moderate', KW, 'set_in', { sleeveStyle: 'bell' })
      .some((r) => r.ops.some((o) => o.kind === 'increase' && o.side === 'across'));
    expect(bellGather).toBe(false);
  });

  it('KW ease finding: the bishop blouse rides with the eased top, its puff ~constant', () => {
    const puff = (e: EaseStyleId): number => {
      const p = plan(W36, 'bishop', e);
      return p.bloomSts - p.sleeveTopSts;
    };
    // The top scales with ease; the extra fullness over it stays about the same absolute width.
    expect(plan(W36, 'bishop', 'oversized').sleeveTopSts).toBeGreaterThan(plan(W36, 'bishop', 'skintight').sleeveTopSts);
    expect(Math.abs(puff('oversized') - puff('skintight'))).toBeLessThanOrEqual(2);
  });
});

describe('sleeve-shape fit gate', () => {
  it('bell/bishop are full or ¾ length only; the mild shapes go anywhere sleeved', () => {
    expect(sleeveShapeAllowed('bell', 'full')).toBe(true);
    expect(sleeveShapeAllowed('bell', 'three_quarter')).toBe(true);
    expect(sleeveShapeAllowed('bell', 'short')).toBe(false);
    expect(sleeveShapeAllowed('bishop', 'half')).toBe(false);
    expect(sleeveShapeAllowed('lantern', 'short')).toBe(true);
    // cap / sleeveless have no taper to shape — taper only.
    expect(sleeveShapeAllowed('bishop', 'cap')).toBe(false);
    expect(sleeveShapeAllowed('lantern', 'sleeveless')).toBe(false);
    expect(sleeveShapeAllowed('moderate_taper', 'cap')).toBe(true);
  });
});

// Tier A: every shape must still sew together — the cap fits the armhole (the shape is below
// the cap, so it never touches the join) — at every size, ease and gauge, set-in and drop.
describe('sleeve shapes assemble across sizes, ease and gauge', () => {
  const SHAPES: SleeveStyle[] = ['narrow_taper', 'lantern', 'modified_lantern', 'bishop', 'bell'];
  for (const shape of SHAPES) {
    for (const shoulder of ['set_in', 'drop'] as const) {
      for (const gauge of GAUGES) {
        for (const style of styles) {
          for (const size of inSizes) {
            it(`${shape}/${shoulder} — ${style} ${size.category} ${size.chest}" @${gauge.bodySt}×${gauge.bodyRow}`, () => {
              const rep = assemblyReport(size, style, gauge, 'round', shoulder, 'scoop', { sleeveStyle: shape });
              const bad = rep.invariants.filter((i) => !i.ok).map((i) => `${i.label} (${i.detail})`);
              expect(bad, bad.join('; ')).toEqual([]);
            });
          }
        }
      }
    }
  }
});
