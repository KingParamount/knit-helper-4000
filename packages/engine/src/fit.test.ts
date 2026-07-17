import { describe, it, expect } from 'vitest';
declare const console: { log: (...args: unknown[]) => void };
import { sizes } from './data/sizes';
import { easeStyles } from './data/options';
import type { EaseStyleId } from './data/types';
import { neckHeadFit, neckFitVerdict, crewSuitable, NECK_OPENING_STRETCH, fitReport } from './fit';

const inSizes = sizes.filter((s) => s.units === 'in');
const styles = easeStyles.map((e) => e.id as EaseStyleId);

// Green Tier-B checks — hold across every size and ease style. The reds (hip
// clearance at deliberately-tight styles, upper-arm ease, sleeve-length ease) are
// tracked separately below and printed by the checkpoint; they're pending decisions.
const GREEN = new Set(['neck clears head', 'neck not too wide', 'chest ease sane']);

describe('Tier-B fit sweep — the checks that hold across all sizes & styles', () => {
  for (const style of styles) {
    for (const size of inSizes) {
      const rep = fitReport(size, style);
      for (const c of rep.checks.filter((c) => GREEN.has(c.label))) {
        it(`${style} ${size.category} ${size.chest}" — ${c.label} (${c.detail})`, () => {
          expect(c.ok).toBe(true);
        });
      }
    }
  }
});

it('CHECKPOINT: Tier-B fit sweep (moderate) — greens and open reds', () => {
  const labels = fitReport(inSizes[0], 'moderate').checks.map((c) => c.label);
  const lines = ['', '  TIER-B FIT — moderate  (✓ pass / ✗ fail across all 175 size×style combos)'];
  for (const label of labels) {
    let pass = 0;
    let fail = 0;
    for (const style of styles) for (const s of inSizes) (fitReport(s, style).checks.find((c) => c.label === label)!.ok ? pass++ : fail++);
    lines.push(`  ${fail === 0 ? '✓' : '✗'} ${label.padEnd(28)} ${pass} pass / ${fail} fail`);
  }
  lines.push('');
  console.log(lines.join('\n'));
  expect(true).toBe(true);
});

// Tier B — will it fit a human of that size? The crew neck must pass over the head.
describe('crew suitability', () => {
  it('offers a crew to everyone but babies (whose heads are too large → placket)', () => {
    for (const s of inSizes) {
      expect(crewSuitable(s), `${s.category} ${s.chest}"`).toBe(s.category !== 'Baby');
    }
  });
});

describe('the neck opening passes over the head', () => {
  it('babies are flagged crew-unsuitable (they need a placket / envelope neck)', () => {
    for (const s of inSizes.filter((x) => x.category === 'Baby')) {
      expect(neckFitVerdict(s).verdict, `${s.category} ${s.chest}"`).toBe('crew_unsuitable');
    }
  });

  it("every child and adult's crew clears the head with the back-neck scoop", () => {
    for (const s of inSizes.filter((x) => crewSuitable(x))) {
      const { verdict, fit } = neckFitVerdict(s);
      expect(verdict, `${s.category} ${s.chest}" (needs ${(fit.headCirc / fit.opening).toFixed(2)}×)`).toBe('ok');
      expect(fit.fits).toBe(true);
    }
  });

  it('leans on a comfortable amount of stretch, not an ears-off tug', () => {
    for (const s of inSizes.filter((x) => crewSuitable(x))) {
      const fit = neckHeadFit(s);
      const stretch = fit.headCirc / fit.opening; // how far it must open to pass the head
      expect(stretch, `${s.category} ${s.chest}"`).toBeLessThanOrEqual(1.5); // a firm pull-over at most
    }
  });
});

it('CHECKPOINT: neck opening vs head across every category', () => {
  const lines = [
    '',
    `  NECK FIT — moderate  (opening admits head at ≤${NECK_OPENING_STRETCH}× target, ≤1.5× wearable)`,
    ...inSizes.map((s) => {
      const fit = neckHeadFit(s);
      const stretch = fit.headCirc / fit.opening;
      const v = neckFitVerdict(s).verdict;
      const label = `${s.category} ${s.chest}"`.padEnd(12);
      return `  ${label} opening ${fit.opening.toFixed(1)}"  head ${fit.headCirc}"  needs ${stretch.toFixed(2)}×  ${v}`;
    }),
    '',
  ];
  console.log(lines.join('\n'));
  expect(true).toBe(true);
});
