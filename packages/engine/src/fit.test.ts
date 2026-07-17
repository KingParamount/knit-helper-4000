import { describe, it, expect } from 'vitest';
declare const console: { log: (...args: unknown[]) => void };
import { sizes } from './data/sizes';
import { neckHeadFit, neckFitVerdict, crewSuitable, NECK_OPENING_STRETCH } from './fit';

const inSizes = sizes.filter((s) => s.units === 'in');

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
