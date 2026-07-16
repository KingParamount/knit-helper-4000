import { describe, it, expect } from 'vitest';
import { findSize } from '../data/sizes';
import { DEFAULT_GAUGE } from '../gauge';
import { frontNeckPlan, frontToNeck, frontNeckShaping, frontRows } from './front';
import { backRows } from './back';

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

describe('front neck edge shaping', () => {
  it('casts off a little then decreases the rest', () => {
    expect(frontNeckShaping(11)).toEqual({ castOffs: [3, 2], decs: 6 });
  });
});

describe('complete front piece (crew neck, two-sided)', () => {
  const rows = frontRows(W36, 'moderate', DEFAULT_GAUGE);

  it('casts off the centre neck at the split', () => {
    const split = rows.find((r) => r.section === 'neck_split')!;
    expect(split.index).toBe(211);
    expect(split.ops).toEqual([{ kind: 'bind_off', count: 24, side: 'center' }]); // 46 − 2×11
    expect(split.stitches).toBe(74); // 98 − 24
  });

  it('works left then right, each ending at the shoulder count', () => {
    const left = rows.filter((r) => r.side === 'left');
    const right = rows.filter((r) => r.side === 'right');
    // ~neck depth (3.6" × 40/4 = 36); the halves may differ by a row (hole-free
    // holding can't align both — the accepted small discrepancy).
    expect(Math.abs(left.length - right.length)).toBeLessThanOrEqual(1);
    expect(left.length).toBeGreaterThanOrEqual(35);
    expect(left[left.length - 1].stitches).toBe(26); // matches the back shoulder
    expect(right[right.length - 1].stitches).toBe(26);
  });

  it('removes the full neck edge on each side (starts 37 → 26)', () => {
    const left = rows.filter((r) => r.side === 'left');
    // first left op reduces from 37; last is a held shoulder at 26
    expect(left[0].stitches).toBe(34); // 37 − first cast-off of 3
    expect(Math.max(...left.map((r) => r.stitches))).toBeLessThanOrEqual(37);
  });

  it('holds each shoulder for grafting (26 per side, at the armhole edge)', () => {
    const holdTotal = (s: 'left' | 'right', edge: 'L' | 'R'): number =>
      rows
        .filter((r) => r.side === s)
        .flatMap((r) => r.ops)
        .filter((o) => o.kind === 'hold' && o.side === edge)
        .reduce((n, o) => n + (o.kind === 'hold' ? o.count : 0), 0);
    expect(holdTotal('left', 'L')).toBe(26);
    expect(holdTotal('right', 'R')).toBe(26);
  });

  it('reconciles with the back: front shoulders graft to back shoulders', () => {
    const back = backRows(W36, 'moderate', DEFAULT_GAUGE);
    const backShoulder = (back[back.length - 1].stitches) / 2; // 52 held / 2
    expect(backShoulder).toBe(26);
    const left = rows.filter((r) => r.side === 'left');
    expect(left[left.length - 1].stitches).toBe(backShoulder);
  });

  it('keeps the carriage alternating and non-increasing within each half', () => {
    for (let i = 1; i < rows.length; i++) {
      expect(rows[i].carriage).not.toBe(rows[i - 1].carriage);
    }
    for (const s of ['left', 'right'] as const) {
      const half = rows.filter((r) => r.side === s);
      for (let i = 1; i < half.length; i++) {
        expect(half[i].stitches).toBeLessThanOrEqual(half[i - 1].stitches);
      }
    }
  });
});
