import { describe, it, expect } from 'vitest';
declare const console: { log: (...args: unknown[]) => void };
import { findSize } from '../data/sizes';
import { DEFAULT_GAUGE } from '../gauge';
import { sleevePlan, sleeveRows, sleeves, evenRows } from './sleeve';

const W36 = findSize('Woman', 36, 'in')!;
const G = DEFAULT_GAUGE;

describe('evenRows', () => {
  it('spreads increases evenly across the span', () => {
    expect(evenRows(19, 143)).toHaveLength(19);
    expect(evenRows(3, 40)).toEqual([10, 20, 30]);
  });
});

describe('sleeve plan (Woman 36", moderate, default gauge)', () => {
  const p = sleevePlan(W36, 'moderate', G);

  it('casts on the cuff and tapers to the sleeve top', () => {
    expect(p.bodyCuffSts).toBe(50); // (wrist 5.75 + 1") × 30/4, rounded even
    expect(p.ribCastOnSts).toBe(51); // rib cast on odd (cuff + 1, extra on the right)
    expect(p.incPerSide).toBe(22); // (94 − 50)/2
    expect(p.sleeveTopSts).toBe(94); // 50 + 2×22 (upper arm + style-scaled bicep ease), even
  });

  it('lays out rib, taper and cap counts', () => {
    expect(p.ribRows).toBe(25); // 2.5"
    expect(p.taperRows).toBe(158); // (arm length 16.75" + ease_arml 1.5") − rib
    expect(p.underarmCastOff).toBe(8); // matches the body armhole underarm
    expect(p.capHeightRows).toBe(55); // solved so the cap perimeter eases +5% over the armhole
    expect(p.capTopSts).toBe(22); // crown = what remains after symmetric shaping (even)
    expect(p.capDecPerSide).toBe(28); // (94 − 16 − crown target) / 2
  });

  it('makes the cap a sensible fraction of the armhole depth', () => {
    // armhole depth is 85 rows; the solved cap height lands around two-thirds of it
    expect(p.capHeightRows / 85).toBeGreaterThan(0.6);
    expect(p.capHeightRows / 85).toBeLessThan(0.72);
  });
});

describe('sleeve rows', () => {
  const rows = sleeveRows('sleeve_l', W36, 'moderate', G);

  it('reaches the sleeve top then binds off the whole cap', () => {
    expect(Math.max(...rows.map((r) => r.stitches))).toBe(94); // widest at the underarm, even
    expect(rows[rows.length - 1].stitches).toBe(0); // cap fully cast off
  });

  it('casts on the odd cuff, drops to even, and increases by 2 per increase row', () => {
    expect(rows[0].ops).toEqual([{ kind: 'cast_on', count: 51 }]); // odd rib
    expect(rows.find((r) => r.section === 'taper')!.ops).toEqual([
      { kind: 'decrease', count: 1, side: 'R' }, // drop to even at the change to stocking
    ]);
    const incRows = rows.filter((r) => r.ops.some((o) => o.kind === 'increase'));
    expect(incRows).toHaveLength(22);
  });

  it('casts off each underarm on its carriage-end side', () => {
    const capCastOffs = rows.filter(
      (r) => r.section === 'cap' && r.ops.some((o) => o.kind === 'bind_off' && o.side !== 'center'),
    );
    expect(capCastOffs).toHaveLength(2);
    for (const r of capCastOffs) {
      const op = r.ops.find((o) => o.kind === 'bind_off')!;
      if (op.kind === 'bind_off') expect(op.side).toBe(r.carriage);
    }
  });

  it('keeps the carriage alternating', () => {
    for (let i = 1; i < rows.length; i++) {
      expect(rows[i].carriage).not.toBe(rows[i - 1].carriage);
    }
  });

  it('produces two identical sleeves', () => {
    const { left, right } = sleeves(W36, 'moderate', G);
    expect(left).toHaveLength(right.length);
    expect(left.map((r) => r.stitches)).toEqual(right.map((r) => r.stitches));
    expect(left[0].piece).toBe('sleeve_l');
    expect(right[0].piece).toBe('sleeve_r');
  });
});

it('CHECKPOINT: prints the sleeve plan', () => {
  const p = sleevePlan(W36, 'moderate', G);
  const rows = sleeveRows('sleeve_l', W36, 'moderate', G);
  const lines = [
    '',
    '  SLEEVE — Woman 36", moderate, set-in, 30×40 gauge',
    `  cast on ${p.ribCastOnSts} (odd cuff) → rib ${p.ribRows} rows, dec 1 to ${p.bodyCuffSts} → taper +1 each end ×${p.incPerSide}`,
    `  → ${p.sleeveTopSts} sts at the underarm (upper arm)`,
    `  CAP: cast off ${p.underarmCastOff} each underarm, then bell decrease over ${p.capHeightRows} rows`,
    `    (solved to fit the armhole), cast off crown ${p.capTopSts}. Total ${rows.length} rows.`,
    '',
  ];
  console.log(lines.join('\n'));
  expect(true).toBe(true);
});
