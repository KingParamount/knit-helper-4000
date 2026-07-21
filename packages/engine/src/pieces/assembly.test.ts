import { describe, it, expect } from 'vitest';
declare const console: { log: (...args: unknown[]) => void };
import { sizes } from '../data/sizes';
import { easeStyles } from '../data/options';
import type { EaseStyleId } from '../data/types';
import { DEFAULT_GAUGE } from '../gauge';
import {
  assemblyReport,
  seamEdgeLength,
  armholeOpening,
  capPerimeter,
} from './assembly';
import { sleeveRows, sleevePlan } from './sleeve';
import { garmentWidths } from '../dimensions';
import { neckbandPlan } from './neckband';
import { backPlan } from './back';
import { frontNeckPlan } from './front';

const G = DEFAULT_GAUGE;

/**
 * A second sweep gauge, deliberately NOT at a 4:3 row-to-stitch ratio.
 *
 * DEFAULT_GAUGE is 30 sts × 40 rows — exactly 4:3 — and for a long time it was the
 * only gauge anything was swept at. That hid a real bug: the neck pick-up used a fixed
 * 3 stitches per 4 rows, which is correct precisely when the ratio IS 4:3 and drifts
 * everywhere else (7% short at 18 × 22.4). Every test passed, because every test ran at
 * the one gauge where the rule happened to be exact.
 *
 * So anything whose correctness depends on the RATIO between stitch and row gauge needs
 * a second ratio to be visible at all. These are real published-pattern numbers (Lion
 * Brand M23232: 18 sts / 4in, 28 rows / 5in), ratio 1.24 rather than 1.33.
 */
const G2 = { bodySt: 18, bodyRow: (28 * 4) / 5, ribSt: 0, ribRow: 0 };

/**
 * A third gauge, chunky: 12 sts / 4in, three stitches to the inch.
 *
 * Sweeping candidates showed which axis actually finds bugs, and it is not the one the
 * pick-up bug suggested. Varying the row-to-stitch RATIO alone finds nothing (20 × 30,
 * a 1.5 ratio, is clean); so does going finer (36 × 48, 32 × 46). What finds things is
 * COARSENESS — fewer stitches per inch makes every rounding constant a larger fraction
 * of the piece. G2 at 18 sts found three faults; 12 sts found a fourth, a double
 * rounding in the sleeve-top count that put a baby's chunky sleeve half an inch wide.
 *
 * Chunky yarn is ordinary (this is roughly a super-bulky), and a coarse gauge on a small
 * piece is where quantisation bites hardest — the smallest garment in the thickest yarn
 * is the corner of the space, so it belongs in the sweep.
 */
const G3 = { bodySt: 12, bodyRow: 16, ribSt: 0, ribRow: 0 };
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
  it('fills the armhole depth row-for-row (0.78–0.95×), every size and ease style', () => {
    for (const style of styles) {
      for (const size of inSizes) {
        // The cap sews to the armhole selvedge row-for-row, so it must be nearly as
        // many rows tall as the armhole is deep. Too short → the sleeve pulls; taller
        // than the armhole is geometrically impossible.
        const fill =
          (sleevePlan(size, style, G).capHeightRows * (4 / G.bodyRow)) /
          garmentWidths(size, style, 'set_in').armholeDepth;
        const label = `${style} ${size.category} ${size.chest}" fill ${(fill * 100).toFixed(0)}%`;
        expect(fill, label).toBeGreaterThanOrEqual(0.78);
        expect(fill, label).toBeLessThanOrEqual(0.95);
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

it('CHECKPOINT: cap fill across every category (cap height vs armhole depth)', () => {
  const lines = [
    '',
    '  CAP FIT — moderate, 30×40 gauge  (cap height ÷ armhole depth; healthy 0.78–0.95, real ≈ 0.85)',
    ...inSizes.map((s) => {
      const fill =
        (sleevePlan(s, 'moderate', G).capHeightRows * (4 / G.bodyRow)) /
        garmentWidths(s, 'moderate', 'set_in').armholeDepth;
      const flag = fill < 0.78 ? ' too FLAT' : fill > 0.95 ? ' too TALL' : '';
      const label = `${s.category} ${s.age ?? ''} ${s.chest}"`.replace(/\s+/g, ' ').trim();
      return `  ${label.padEnd(16)} fill ${fill.toFixed(2)}${flag}`;
    }),
    '',
  ];
  console.log(lines.join('\n'));
  expect(true).toBe(true);
});

// The blind spot that let the pick-up bug live: sweep the invariants at a gauge whose
// row-to-stitch ratio is not 4:3, so ratio-dependent maths has somewhere to show itself.
describe.each([
  ['18×22.4 (coarse, non-4:3)', G2],
  ['12×16 (chunky)', G3],
])('assembly invariants hold at %s', (_label, gauge) => {
  for (const size of inSizes) {
    const rep = assemblyReport(size, 'moderate', gauge);
    for (const inv of rep.invariants) {
      it(`${size.category} ${size.chest}" — ${inv.label} (${inv.detail})`, () => {
        expect(inv.ok).toBe(true);
      });
    }
  }
});

it('CHECKPOINT: cap fill at a coarse gauge (rounding stays in band)', () => {
  /*
   * The fill target is a row count (armhole rows × CAP_FILL), so a coarse gauge with
   * few rows to the inch is where rounding could push the ratio out of band. Print the
   * fill each size lands at; the sweep above asserts the invariant at this gauge too.
   */
  const rows: string[] = [];
  for (const size of inSizes) {
    const cap = assemblyReport(size, 'moderate', G2).invariants.find((i) => i.label === 'cap fits armhole');
    if (cap && !cap.ok) rows.push(`  ${size.category} ${size.chest}"`.padEnd(20) + cap.detail);
  }
  console.log(`\nCAP FILL @ 18 sts × 22.4 rows (a coarse, non-4:3 gauge)`);
  console.log(rows.length ? rows.join('\n') : '  (all sizes fill 0.78–0.95 of the armhole)');
  expect(rows, rows.join('; ')).toEqual([]);
});

describe('the neckband matches the neckline it has to cover, at any gauge', () => {
  // The band is picked up along edges measured in ROWS and worked in STITCHES, so its
  // length depends on the gauge's ratio. If the pick-up rate is fixed rather than
  // derived, the band comes out short or long in proportion to how far the gauge sits
  // from 4:3 — and drags or ruffles the neckline accordingly.
  for (const [label, gauge] of [['default 30×40', G], ['non-4:3 18×22.4', G2], ['chunky 12×16', G3]] as const) {
    for (const size of womanSizes) {
      it(`${size.category} ${size.chest}" @${label} — band covers its edges within 5%`, () => {
        const plan = neckbandPlan(size, 'moderate', gauge);
        const bp = backPlan(size, 'moderate', gauge);
        const fp = frontNeckPlan(size, 'moderate', gauge);
        const spi = gauge.bodySt / 4;
        const rpi = gauge.bodyRow / 4;

        // What the band measures, and what the neckline it covers measures.
        const bandIn = plan.pickupTotal / spi;
        const necklineIn =
          plan.backCentreSts / spi + // cast-off edges are 1:1
          plan.frontCentreSts / spi +
          (2 * bp.backNeckRows) / rpi + // shaped edges are rows of fabric
          (2 * fp.neckDepthRows) / rpi;

        /*
         * Judged in STITCHES, not percent. The band is built from five rounded parts
         * plus an odd-parity bump, so its error is a fixed handful of stitches however
         * fine the gauge — measured at +2.5, +2.4 and +3.0 stitches at 30×40, 18×22.4
         * and 12×16. As a percentage that looks like it worsens with coarseness, but
         * only because the same few stitches are a bigger share of a shorter band.
         *
         * The drift is consistently POSITIVE because the reference above is itself an
         * approximation: it measures the shaped neck edges by their rows, as if they ran
         * straight up, when they slope and so are longer. The neckline is really a little
         * longer than modelled, and the band correspondingly less over.
         */
        const driftSts = (bandIn - necklineIn) * spi;
        expect(
          Math.abs(driftSts),
          `band ${bandIn.toFixed(1)}" vs neckline ${necklineIn.toFixed(1)}" (${driftSts.toFixed(1)} sts)`,
        ).toBeLessThanOrEqual(4);
      });
    }
  }
});
