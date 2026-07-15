import { describe, it, expect } from 'vitest';
// The engine is pure (no DOM/Node lib); declare the console the test runner provides.
declare const console: { log: (...args: unknown[]) => void };
import { findSize } from './data/sizes';
import { easeStyles } from './data/options';
import { garmentWidths, chestEase } from './dimensions';
import type { EaseStyleId } from './data/types';

const W36 = findSize('Woman', 36, 'in')!;
const STYLES = easeStyles.map((e) => e.id as EaseStyleId);

describe('garment widths (Woman 36", set-in, straight body)', () => {
  it('builds finished chest on the bust (36), not the hip (bust-only)', () => {
    // moderate: 1.71 × 1.37 = 2.3427; 36 + 2.3427
    expect(chestEase(W36, 'moderate')).toBeCloseTo(2.3427, 4);
    expect(garmentWidths(W36, 'moderate').chest).toBeCloseTo(38.3427, 4);
  });

  it('applies negative ease for skintight', () => {
    expect(garmentWidths(W36, 'skintight').chest).toBeCloseTo(34.9725, 4);
  });

  it('increases finished chest monotonically across the five styles', () => {
    const chests = STYLES.map((s) => garmentWidths(W36, s).chest);
    expect(chests).toEqual([...chests].sort((a, b) => a - b));
  });

  it('uses fixed set-in allowances that do NOT scale with ease style', () => {
    // back width +0, armhole depth +1.5 (=>armhole 18.0), sleeve top +1 — same for every style
    for (const s of STYLES) {
      const w = garmentWidths(W36, s);
      expect(w.backWidth).toBeCloseTo(13.25, 4); // 13.25 + 0
      expect(w.armholeDepth).toBeCloseTo(9.0, 4); // 7.5 + 1.5
      expect(w.armhole).toBeCloseTo(18.0, 4); // 2 × 9.0
      expect(w.sleeveTop).toBeCloseTo(11.75, 4); // 10.75 + 1.0
    }
  });
});

// --- Checkpoint print: Woman 36" at all five ease styles ------------------
// Not an assertion; emits the table for eyeball review during the test run.
it('CHECKPOINT: prints the Woman 36" dimensions table', () => {
  const f = (n: number) => n.toFixed(2).padStart(7);
  const lines: string[] = [];
  lines.push('');
  lines.push('  Woman 36" — finished widths (inches), set-in sleeve, straight body');
  lines.push('  body: bust 36, back_width 13.25, arm_depth 7.5, upper_arm 10.75, ease_factor 1.37');
  lines.push('  ┌─────────────┬────────┬─────────┬──────────┬─────────┬───────────┐');
  lines.push('  │ ease style  │  ease  │  chest  │ back wid │ armhole │ sleeve top│');
  lines.push('  ├─────────────┼────────┼─────────┼──────────┼─────────┼───────────┤');
  for (const s of STYLES) {
    const w = garmentWidths(W36, s);
    lines.push(
      `  │ ${s.padEnd(11)} │${f(w.chestEase)} │${f(w.chest)} │ ${f(w.backWidth)} │${f(w.armhole)} │ ${f(w.sleeveTop)}  │`,
    );
  }
  lines.push('  └─────────────┴────────┴─────────┴──────────┴─────────┴───────────┘');
  lines.push('  chest = bust + ease (CYC ladder). back/armhole/sleeve = fixed set-in allowances');
  lines.push('  (back +0, armhole depth +1.5" => 2×9.0, sleeve top +1"); armhole shown as around-measure');
  lines.push('');
  console.log(lines.join('\n'));
  expect(true).toBe(true);
});
