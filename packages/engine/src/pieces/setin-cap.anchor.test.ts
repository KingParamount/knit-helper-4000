import { describe, it, expect } from 'vitest';
declare const console: { log: (...args: unknown[]) => void };
import { findSize } from '../data/sizes';
import { garmentWidths } from '../dimensions';
import { sleevePlan } from './sleeve';
import { armholeShaping, backPlan } from './back';
import type { Gauge } from '../gauge';

/**
 * TIER-C ANCHOR — a men's set-in-sleeve crew pullover measured against a real,
 * published, graded hand-knitting pattern: Berroco "Anthony" (Berroco Design Team,
 * 2018), finished chest 36–60".
 *
 * Provenance: this is NOT Knitware and nothing here is from it. We use Anthony only
 * for NUMERIC FACTS and geometric RELATIONSHIPS — gauge, finished measurements, and
 * stitch/row counts read off the schematic and the graded instructions. We do not
 * reproduce, paraphrase, or template its prose; the sentences are the designer's.
 * A cap's proportions relative to its armhole are a fact about how a set-in sleeve
 * fills a scye, true regardless of who graded it.
 *
 * Gauge is Anthony's own (20 sts × 27 rows / 4"), so the comparison is like-for-like
 * and not an artefact of our default machine gauge.
 *
 * The anchor tests one thing our internal (Tier-A) harness cannot: does the cap come
 * out the shape a real man's set-in cap is? Two facets:
 *   1. cap underarm cast-off == body armhole cast-off  (assembly — HOLDS today)
 *   2. cap height ≈ 0.8–0.9 × armhole depth            (proportion — FAILS today)
 *
 * Facet 2 was an open Tier-C RED (our caps ran ~0.5–0.66 × the armhole: too flat)
 * and is now FIXED and ASSERTED. The old model eased the cap perimeter +5% over the
 * armhole (a tape-length match a flat staircased cap could fake) and crowned too wide;
 * `sleeve.ts` now fills the armhole in ROWS (CAP_FILL) with a narrow crown, so the cap
 * lands in Anthony's 0.79–0.89 band.
 */

// Anthony's own gauge.
const G: Gauge = { bodySt: 20, bodyRow: 27, ribSt: 0, ribRow: 0 };

// Read off Anthony's schematic + graded instructions, finished chest → facts.
// cap = sleeve-cap height ("); arm = armhole depth ("); both from the schematic.
const ANTHONY = [
  { chest: 36, arm: 9.0, cap: 8.0, capTopSts: 9 },
  { chest: 40, arm: 9.5, cap: 8.5, capTopSts: 9 },
  { chest: 44, arm: 10.0, cap: 8.5, capTopSts: 11 },
  { chest: 48, arm: 10.5, cap: 9.25, capTopSts: 11 },
  { chest: 52, arm: 11.0, cap: 9.25, capTopSts: 13 },
  { chest: 56, arm: 11.5, cap: 9.5, capTopSts: 15 },
  { chest: 60, arm: 12.0, cap: 9.5, capTopSts: 17 },
] as const;

// The real cap/armhole ratios cluster here — the band a men's set-in cap should meet.
const ANTHONY_RATIOS = ANTHONY.map((a) => a.cap / a.arm); // 0.79 … 0.89
const RATIO_MIN = 0.78; // a touch below Anthony's shallowest (size 60)
const RATIO_MAX = 0.95; // a full cap never quite reaches the armhole depth

// The cap model now fills the armhole; facet 2 is asserted.
const ASSERT_RATIO = true;

// Our men's body sizes (body chest 32–52; Anthony is finished, i.e. body + ~6").
const MAN = [32, 36, 40, 44, 48, 52].map((c) => findSize('Man', c, 'in')!);
const rowsPerIn = G.bodyRow / 4;
const capRatio = (chest: number): { cap: number; arm: number; ratio: number } => {
  const size = findSize('Man', chest, 'in')!;
  const w = garmentWidths(size, 'comfortable', 'set_in');
  const p = sleevePlan(size, 'comfortable', G, 'set_in');
  const cap = p.capHeightRows / rowsPerIn;
  return { cap, arm: w.armholeDepth, ratio: cap / w.armholeDepth };
};

describe('Tier-C anchor: men’s set-in cap vs Berroco Anthony', () => {
  // Facet 1 — HOLDS. The cap and the body armhole must bind off the same underarm,
  // or the two edges are different lengths and the sleeve will not sew in. Anthony
  // does this too (its cap underarm BO equals its body armhole BO on every size).
  for (const size of MAN) {
    it(`cap underarm cast-off matches the body armhole (Man ${size.chest}")`, () => {
      const body = backPlan(size, 'comfortable', G, 'set_in');
      const bodyBO = armholeShaping(body.bodySts, body.upperBackSts, G).castOffPerSide;
      const p = sleevePlan(size, 'comfortable', G, 'set_in');
      expect(p.underarmCastOff).toBe(bodyBO);
    });
  }

  // Facet 2 — OPEN RED. Assert only when ASSERT_RATIO flips (after the cap refit).
  (ASSERT_RATIO ? describe : describe.skip)('cap fills the armhole (0.78–0.95 ×)', () => {
    for (const size of MAN) {
      it(`Man ${size.chest}"`, () => {
        const r = capRatio(size.chest);
        expect(r.ratio).toBeGreaterThanOrEqual(RATIO_MIN);
        expect(r.ratio).toBeLessThanOrEqual(RATIO_MAX);
      });
    }
  });
});

it('CHECKPOINT: men’s set-in cap depth vs Anthony (open Tier-C red)', () => {
  const lines = [
    '',
    '  TIER-C ANCHOR — men’s set-in cap fill (cap height ÷ armhole depth)',
    `  Anthony (real): ${Math.min(...ANTHONY_RATIOS).toFixed(2)}–${Math.max(...ANTHONY_RATIOS).toFixed(2)}   target band ${RATIO_MIN}–${RATIO_MAX}`,
    '  our engine (Man, comfortable, Anthony gauge 20×27):',
  ];
  let fail = 0;
  for (const size of MAN) {
    const r = capRatio(size.chest);
    const ok = r.ratio >= RATIO_MIN && r.ratio <= RATIO_MAX;
    if (!ok) fail++;
    lines.push(
      `    ${ok ? '✓' : '✗'} ${String(size.chest).padStart(2)}"  cap ${r.cap.toFixed(1)}" / arm ${r.arm.toFixed(1)}"  = ${r.ratio.toFixed(2)}`,
    );
  }
  lines.push(`  ${fail === 0 ? '✓ all in band' : `✗ ${fail}/${MAN.length} too flat — cap model needs a Tier-C refit`}`, '');
  console.log(lines.join('\n'));
  expect(true).toBe(true);
});
