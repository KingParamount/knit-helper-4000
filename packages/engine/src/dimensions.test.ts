import { describe, it, expect } from 'vitest';
// The engine is pure (no DOM/Node lib); declare the console the test runner provides.
declare const console: { log: (...args: unknown[]) => void };
import { findSize } from './data/sizes';
import { easeStyles } from './data/options';
import { garmentWidths, easeAmount } from './dimensions';
import type { EaseStyleId } from './data/types';

const W36 = findSize('Woman', 36, 'in')!;
const STYLES = easeStyles.map((e) => e.id as EaseStyleId);

describe('garment widths (Woman 36")', () => {
  it('builds the chest on the hip (38) not the chest (36) for a straight body', () => {
    const w = garmentWidths(W36, 'moderate');
    expect(w.hipGoverns).toBe(true);
    expect(w.bodyWidthBasis).toBe(38);
  });

  it('gives the solid finished chest = basis + base·ease_factor', () => {
    // moderate: 1.71 × 1.37 = 2.3427; 38 + 2.3427
    expect(easeAmount(W36, 'moderate')).toBeCloseTo(2.3427, 4);
    expect(garmentWidths(W36, 'moderate').chest).toBeCloseTo(40.3427, 4);
  });

  it('applies negative ease for skintight', () => {
    expect(easeAmount(W36, 'skintight')).toBeCloseTo(-1.0275, 4);
    expect(garmentWidths(W36, 'skintight').chest).toBeCloseTo(36.9725, 4);
  });

  it('increases finished chest monotonically across the five styles', () => {
    const chests = STYLES.map((s) => garmentWidths(W36, s).chest);
    expect(chests).toEqual([...chests].sort((a, b) => a - b));
  });

  it('uses the 2×arm_depth armhole baseline', () => {
    // tight: ease 0.75×1.37 = 1.0275; armhole = 2×7.5 + 1.0275 (share 1)
    expect(garmentWidths(W36, 'tight').armhole).toBeCloseTo(16.0275, 4);
  });
});

// --- Checkpoint print: Woman 36" at all five ease styles ------------------
// Not an assertion; emits the table for eyeball review during the test run.
it('CHECKPOINT: prints the Woman 36" dimensions table', () => {
  const f = (n: number) => n.toFixed(2).padStart(7);
  const lines: string[] = [];
  lines.push('');
  lines.push('  Woman 36" — finished widths (inches), all five ease styles');
  lines.push('  body: chest 36, hip 38, back_width 13.25, arm_depth 7.5, upper_arm 10.75, ease_factor 1.37');
  lines.push('  ┌─────────────┬────────┬─────────┬──────────┬─────────┬───────────┐');
  lines.push('  │ ease style  │  ease  │ chest*  │ back wid │ armhole │ sleeve top│');
  lines.push('  │             │        │ (SOLID) │ (assume) │ (assume)│ (assume)  │');
  lines.push('  ├─────────────┼────────┼─────────┼──────────┼─────────┼───────────┤');
  for (const s of STYLES) {
    const w = garmentWidths(W36, s);
    lines.push(
      `  │ ${s.padEnd(11)} │${f(w.ease)} │${f(w.chest)} │ ${f(w.backWidth)} │${f(w.armhole)} │ ${f(w.sleeveTop)}  │`,
    );
  }
  lines.push('  └─────────────┴────────┴─────────┴──────────┴─────────┴───────────┘');
  lines.push('  * chest built on hip (38), the larger of chest/hip — straight body (manual:488)');
  lines.push('  SOLID = trusted; assume = flagged ease assumption to confirm (open item E1)');
  lines.push('');
  console.log(lines.join('\n'));
  expect(true).toBe(true);
});
