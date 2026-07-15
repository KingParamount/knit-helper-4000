import { describe, it, expect } from 'vitest';
declare const console: { log: (...args: unknown[]) => void };
import { findSize } from '../data/sizes';
import { DEFAULT_GAUGE } from '../gauge';
import { backPlan, lowerBackRows } from './back';

const W36 = findSize('Woman', 36, 'in')!;
const G = DEFAULT_GAUGE;

describe('back piece plan (Woman 36", moderate, default gauge)', () => {
  const p = backPlan(W36, 'moderate', G);

  it('casts on half the finished chest and narrows to the back width', () => {
    expect(p.castOnSts).toBe(144); // (38.34/2) × 30/4
    expect(p.upperBackSts).toBe(99); // 13.25 × 30/4
    expect(p.backNeckSts).toBe(46); // 6.13 × 30/4
  });

  it('lays out row counts that sum to the body length', () => {
    expect(p.totalRows).toBe(246); // 24.55" × 40/4
    expect(p.ribRows).toBe(25); // 2.5" (rib gauge defaults to body)
    expect(p.armholeRows).toBe(90); // 9" armhole depth
    expect(p.bodyRows).toBe(131); // 246 − 90 − 25
    expect(p.ribRows + p.bodyRows + p.armholeRows).toBe(p.totalRows);
  });

  it('reports the armhole shaping target', () => {
    expect(p.shaping.armholeDecTotal).toBe(45); // 144 − 99, split both sides
  });
});

describe('lower back rows', () => {
  const rows = lowerBackRows(W36, 'moderate', G);

  it('runs from cast-on to the underarm', () => {
    expect(rows).toHaveLength(156); // rib 25 + body 131
    expect(rows[0].index).toBe(1);
    expect(rows[0].ops).toEqual([{ kind: 'cast_on', count: 144 }]);
    expect(rows.every((r) => r.stitches === 144)).toBe(true);
    expect(rows.every((r) => r.piece === 'back')).toBe(true);
  });

  it('marks the rib then body sections', () => {
    expect(rows[24].section).toBe('rib'); // row 25
    expect(rows[25].section).toBe('body'); // row 26
  });

  it('alternates the carriage deterministically, no two rows the same', () => {
    expect(rows[0].carriage).toBe('L'); // cast-on rests at start side
    expect(rows[1].carriage).toBe('R');
    for (let i = 1; i < rows.length; i++) {
      expect(rows[i].carriage).not.toBe(rows[i - 1].carriage);
    }
  });
});

it('CHECKPOINT: prints the back-piece knitting plan', () => {
  const p = backPlan(W36, 'moderate', G);
  const lines: string[] = [];
  lines.push('');
  lines.push('  BACK — Woman 36", moderate, set-in, 30 sts × 40 rows / 4"');
  lines.push(`  cast on ${p.castOnSts} sts (finished chest ÷ 2)`);
  lines.push('  ┌──────────────────┬───────────┬──────────┬────────────────────────────┐');
  lines.push('  │ section          │ rows      │ stitches │ note                       │');
  lines.push('  ├──────────────────┼───────────┼──────────┼────────────────────────────┤');
  for (const s of p.sections) {
    lines.push(
      `  │ ${s.name.padEnd(16)} │ ${`${s.startRow}–${s.endRow}`.padEnd(9)} │ ${String(
        s.stitches,
      ).padEnd(8)} │ ${(s.note ?? '').padEnd(26)} │`,
    );
  }
  lines.push('  └──────────────────┴───────────┴──────────┴────────────────────────────┘');
  lines.push(`  total ${p.totalRows} rows (${(p.totalRows / 40) * 4}" body length)`);
  lines.push(
    `  shaping TODO: armhole narrows ${p.castOnSts}→${p.upperBackSts} sts (−${p.shaping.armholeDecTotal}, both sides),`,
  );
  lines.push(
    `                top → 2 shoulders ≈ ${p.shaping.shoulderStsEachApprox} sts each + back neck ${p.backNeckSts} sts`,
  );
  lines.push('');
  console.log(lines.join('\n'));
  expect(true).toBe(true);
});
