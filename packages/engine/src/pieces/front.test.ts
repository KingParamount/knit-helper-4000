import { describe, it, expect } from 'vitest';
import { findSize } from '../data/sizes';
import { DEFAULT_GAUGE } from '../gauge';
import { frontNeckPlan, frontToNeck } from './front';

const W36 = findSize('Woman', 36, 'in')!;

describe('front neck plan (Woman 36", moderate)', () => {
  const p = frontNeckPlan(W36, 'moderate', DEFAULT_GAUGE);

  it('splits the body into two shoulders + the front neck', () => {
    expect(p.bodySts).toBe(98);
    expect(p.shoulderSts).toBe(26); // must match the back shoulders (grafting)
    expect(p.frontNeckSts).toBe(46); // 98 − 2×26
    expect(p.shoulderSts * 2 + p.frontNeckSts).toBe(p.bodySts);
  });

  it('starts the neck a crew depth below the shoulder line', () => {
    expect(p.neckLineRow).toBe(210); // 246 − 36 (neck_depth 3.6" × 40/4)
  });
});

describe('front to the neck line', () => {
  const rows = frontToNeck(W36, 'moderate', DEFAULT_GAUGE);

  it('matches the back below the neck and stops at the neck line', () => {
    expect(rows).toHaveLength(210);
    expect(rows.every((r) => r.piece === 'front')).toBe(true);
    expect(rows[rows.length - 1].stitches).toBe(98); // full body width, pre-split
    expect(rows[rows.length - 1].section).toBe('upper_front');
  });
});
