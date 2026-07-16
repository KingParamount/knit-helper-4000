import { describe, it, expect } from 'vitest';
declare const console: { log: (...args: unknown[]) => void };
import { sizes } from '../data/sizes';
import { easeStyles } from '../data/options';
import type { EaseStyleId } from '../data/types';
import { DEFAULT_GAUGE } from '../gauge';
import {
  assemblyReport,
  capEase,
  seamEdgeLength,
  armholeOpening,
  capPerimeter,
} from './assembly';
import { sleeveRows } from './sleeve';

const G = DEFAULT_GAUGE;
const inSizes = sizes.filter((s) => s.units === 'in');
const womanSizes = inSizes.filter((s) => s.category === 'Woman');
const styles = easeStyles.map((e) => e.id as EaseStyleId);

// Tier A: will it sew together? All five invariants are checked at EVERY size in
// EVERY category — because grading drift (maths that works at the sample size and
// fails at the extremes) is what a full sweep catches and a spot-check misses.
// Cap-fit earns its place here only since the cap is designed to the armhole: it
// used to fail badly for babies (too short) and men (too long).
describe('assembly invariants across all categories (baby → man)', () => {
  for (const size of inSizes) {
    const rep = assemblyReport(size, 'moderate', G);
    for (const inv of rep.invariants) {
      it(`${size.category} ${size.chest}" — ${inv.label} (${inv.detail})`, () => {
        expect(inv.ok).toBe(true);
      });
    }
  }
});

// The invariants must survive every ease style, not just the default: skintight
// (negative ease) and oversized shift the chest → armhole → cap chain the most.
describe('assembly invariants across all ease styles', () => {
  for (const style of styles) {
    for (const size of inSizes) {
      it(`${style} — ${size.category} ${size.chest}"`, () => {
        const rep = assemblyReport(size, style, G);
        const bad = rep.invariants.filter((i) => !i.ok).map((i) => `${i.label} (${i.detail})`);
        expect(bad, bad.join('; ')).toEqual([]);
      });
    }
  }
});

describe('sleeve cap fits the armhole (set-in "fits exactly"), all shapes', () => {
  it('eases the cap a small non-negative amount over the armhole, every size and ease style', () => {
    for (const style of styles) {
      for (const size of inSizes) {
        const easePct = capEase(size, style, G) * 100;
        // Negative → cap too short to reach round the armhole; ≫10% → puckered head.
        const label = `${style} ${size.category} ${size.chest}"`;
        expect(easePct, `${label} cap ease ${easePct.toFixed(1)}%`).toBeGreaterThanOrEqual(-1);
        expect(easePct, `${label} cap ease ${easePct.toFixed(1)}%`).toBeLessThanOrEqual(10);
      }
    }
  });

  it('measures cap perimeter as two side edges plus the crown', () => {
    const size = womanSizes.find((s) => s.chest === 40)!;
    const capSide = seamEdgeLength(sleeveRows('sleeve_l', size, 'moderate', G), new Set(['cap']), G);
    expect(capSide).toBeGreaterThan(0);
    // The crown is added on top of the two side edges, so the perimeter exceeds 2×side.
    expect(capPerimeter(size, 'moderate', G)).toBeGreaterThan(2 * capSide);
    expect(armholeOpening(size, 'moderate', G)).toBeGreaterThan(0);
  });

  it('excludes the flat underarm cast-off from the seamed edge', () => {
    // A section that is nothing but a leading (underarm) bind-off contributes zero.
    const size = womanSizes.find((s) => s.chest === 40)!;
    const onlyUnderarm = sleeveRows('sleeve_l', size, 'moderate', G)
      .filter((r) => r.section === 'cap' && r.ops.some((o) => o.kind === 'bind_off' && o.side !== 'center'))
      .slice(0, 2); // the two underarm cast-off rows
    expect(seamEdgeLength(onlyUnderarm, new Set(['cap']), G)).toBe(0);
  });
});

it('CHECKPOINT: cap ease across every category (shows the open-loop cap drift)', () => {
  const lines = [
    '',
    '  CAP FIT — moderate, 30×40 gauge  (cap perimeter vs armhole opening; healthy ≈ 0…+8%)',
    ...inSizes.map((s) => {
      const e = capEase(s, 'moderate', G) * 100;
      const flag = e < -1 ? ' too SHORT' : e > 10 ? ' too LONG' : '';
      const label = `${s.category} ${s.age ?? ''} ${s.chest}"`.replace(/\s+/g, ' ').trim();
      return `  ${label.padEnd(16)} ease ${e >= 0 ? '+' : ''}${e.toFixed(1)}%${flag}`;
    }),
    '',
  ];
  console.log(lines.join('\n'));
  expect(true).toBe(true);
});
