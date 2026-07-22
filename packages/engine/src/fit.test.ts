import { describe, it, expect } from 'vitest';
declare const console: { log: (...args: unknown[]) => void };
import { sizes } from './data/sizes';
import { easeStyles } from './data/options';
import type { EaseStyleId } from './data/types';
import { neckHeadFit, neckFitVerdict, crewSuitable, NECK_OPENING_STRETCH, fitReport } from './fit';

const inSizes = sizes.filter((s) => s.units === 'in');
const styles = easeStyles.map((e) => e.id as EaseStyleId);

// Green Tier-B checks — hold across every size and ease style. Hip clearance is the
// one informational red (a straight body is tight at the hem only for deliberately-
// snug styles — agreed as a final contention), printed by the checkpoint, not asserted.
const GREEN = new Set(['neck clears head', 'neck not too wide', 'chest ease sane', 'sleeve clears the arm']);

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
    for (const style of styles)
      for (const s of inSizes) {
        if (fitReport(s, style).checks.find((c) => c.label === label)!.ok) pass++;
        else fail++;
      }
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

// The style-INDEPENDENT body-fit checks must hold for the new styles too — a new style
// just runs through the same harness. The style-SPECIFIC reds ('v depth sensible',
// 'drop armhole deep enough') are open findings pending fixes informed by Tier C; the
// checkpoint prints them, they are not asserted.
const STYLE_CONFIGS = [
  { neck: 'v', shoulder: 'set_in', label: 'v-neck' },
  { neck: 'round', shoulder: 'drop', label: 'drop' },
  { neck: 'v', shoulder: 'drop', label: 'v+drop' },
] as const;

// After the Tier-C-validated fixes, every check holds for the new styles EXCEPT the
// accepted hip-clearance red — including the style-specific 'v depth sensible' and
// 'drop armhole deep enough'. Assert all of them but hip.
describe('Tier-B fit — all checks hold for v-neck and drop shoulder (bar hip)', () => {
  for (const cfg of STYLE_CONFIGS) {
    for (const style of styles) {
      for (const size of inSizes) {
        for (const c of fitReport(size, style, cfg.neck, cfg.shoulder).checks.filter((c) => c.label !== 'hip clearance')) {
          it(`${cfg.label} ${style} ${size.category} ${size.chest}" — ${c.label}`, () => {
            expect(c.ok).toBe(true);
          });
        }
      }
    }
  }
});

it('CHECKPOINT: Tier-B style sweep — v-neck & drop findings (open, pending Tier C)', () => {
  const lines = ['', '  TIER-B STYLE SWEEP — moderate (✓/✗ across 35 sizes)'];
  for (const cfg of STYLE_CONFIGS) {
    lines.push(`  — ${cfg.label} —`);
    const labels = fitReport(inSizes[0], 'moderate', cfg.neck, cfg.shoulder).checks.map((c) => c.label);
    for (const label of labels) {
      let pass = 0;
      let fail = 0;
      for (const s of inSizes) {
        if (fitReport(s, 'moderate', cfg.neck, cfg.shoulder).checks.find((c) => c.label === label)!.ok) pass++;
        else fail++;
      }
      lines.push(`    ${fail === 0 ? '✓' : '✗'} ${label.padEnd(24)} ${pass}/${pass + fail}`);
    }
  }
  console.log(lines.join('\n'));
  expect(true).toBe(true);
});
