import { describe, it, expect } from 'vitest';
declare const console: { log: (...args: unknown[]) => void };
import { findSize } from '../data/sizes';
import { DEFAULT_GAUGE } from '../gauge';
import {
  backPlan,
  lowerBackRows,
  armholeShaping,
  backThroughArmhole,
  splitIntoSteps,
  backRows,
} from './back';

const W36 = findSize('Woman', 36, 'in')!;
const G = DEFAULT_GAUGE;

describe('back piece plan (Woman 36", moderate, default gauge)', () => {
  const p = backPlan(W36, 'moderate', G);

  it('casts on half the finished chest and narrows to the back width', () => {
    expect(p.bodySts).toBe(144); // (38.34/2) × 30/4, rounded even
    expect(p.ribCastOnSts).toBe(145); // rib cast on odd (body + 1, extra on the right)
    expect(p.upperBackSts).toBe(99); // 13.25 × 30/4
    expect(p.backNeckSts).toBe(46); // 6.13 × 30/4
  });

  it('lays out row counts that sum to the body length', () => {
    expect(p.totalRows).toBe(246); // 24.55" × 40/4
    expect(p.ribRows).toBe(25); // 2.5" (rib gauge defaults to body)
    expect(p.armholeRows).toBe(85); // 8.5" armhole depth
    expect(p.bodyRows).toBe(136); // 246 − 85 − 25
    expect(p.ribRows + p.bodyRows + p.armholeRows).toBe(p.totalRows);
  });

  it('reports the armhole shaping target', () => {
    expect(p.shaping.armholeDecTotal).toBe(45); // 144 − 99, split both sides
  });
});

describe('lower back rows', () => {
  const rows = lowerBackRows(W36, 'moderate', G);

  it('runs from cast-on to the underarm', () => {
    expect(rows).toHaveLength(161); // rib 25 + body 136
    expect(rows[0].index).toBe(1);
    expect(rows[0].ops).toEqual([{ kind: 'cast_on', count: 145 }]); // odd rib
    expect(rows.slice(0, 25).every((r) => r.stitches === 145)).toBe(true); // rib odd
    expect(rows[rows.length - 1].stitches).toBe(144); // body even (after the drop)
    expect(rows.every((r) => r.piece === 'back')).toBe(true);
  });

  it('drops the odd rib stitch on the right at the change to stocking', () => {
    expect(rows[24].section).toBe('rib'); // row 25
    expect(rows[25].section).toBe('body'); // row 26
    expect(rows[25].ops).toEqual([{ kind: 'decrease', count: 1, side: 'R' }]);
    expect(rows[25].stitches).toBe(144);
  });

  it('alternates the carriage deterministically, no two rows the same', () => {
    expect(rows[0].carriage).toBe('L'); // cast-on rests at start side
    expect(rows[1].carriage).toBe('R');
    for (let i = 1; i < rows.length; i++) {
      expect(rows[i].carriage).not.toBe(rows[i - 1].carriage);
    }
  });
});

describe('armhole shaping (graduated / curved scye)', () => {
  const s = armholeShaping(144, 99, DEFAULT_GAUGE);

  it('casts off ~1" then decreases at an easing rate', () => {
    expect(s.castOffPerSide).toBe(8); // 1" × 30/4
    // d = 23 − 8 = 15 → fast 5 (every row), medium 7 (every other), gentle 3 (every 4th)
    expect(s.phases).toEqual([
      { everyRows: 1, times: 5 },
      { everyRows: 2, times: 7 },
      { everyRows: 4, times: 3 },
    ]);
    expect(s.achievedSts).toBe(98); // 144 − 2×23
  });

  const rows = backThroughArmhole(W36, 'moderate', DEFAULT_GAUGE);

  it('reconciles to the achieved back width', () => {
    expect(rows[rows.length - 1].stitches).toBe(98);
    // 161 lower + 2 cast-off + 5 (every row) + 14 (7 dec + 7 plain) + 12 (3 dec + 9 plain)
    expect(rows).toHaveLength(194);
  });

  it('decreases fastest at the bottom of the scye', () => {
    const decRows = rows
      .filter((r) => r.section === 'armhole' && r.ops.some((o) => o.kind === 'decrease'))
      .map((r) => r.index);
    expect(decRows).toHaveLength(15);
    // first five are consecutive (every row); gaps widen higher up
    expect(decRows.slice(0, 5)).toEqual([164, 165, 166, 167, 168]);
    expect(decRows[decRows.length - 1] - decRows[decRows.length - 2]).toBe(4); // every 4th near top
  });

  it('casts off each underarm on the row whose carriage is on that side', () => {
    const castOffs = rows.filter((r) => r.ops.some((o) => o.kind === 'bind_off'));
    expect(castOffs).toHaveLength(2);
    for (const r of castOffs) {
      const op = r.ops.find((o) => o.kind === 'bind_off')!;
      if (op.kind === 'bind_off') expect(op.side).toBe(r.carriage);
    }
  });

  it('never increases stitch count and keeps the carriage alternating', () => {
    for (let i = 1; i < rows.length; i++) {
      expect(rows[i].stitches).toBeLessThanOrEqual(rows[i - 1].stitches);
      expect(rows[i].carriage).not.toBe(rows[i - 1].carriage);
    }
  });
});

describe('splitIntoSteps', () => {
  it('splits into near-equal groups of ~target, larger groups first', () => {
    expect(splitIntoSteps(26, 7)).toEqual([7, 7, 6, 6]);
    expect(splitIntoSteps(20, 7)).toEqual([7, 7, 6]);
    expect(splitIntoSteps(5, 7)).toEqual([5]);
    expect(splitIntoSteps(0, 7)).toEqual([0]);
  });
});

describe('complete back piece (scooped neck, short-row shoulders)', () => {
  const rows = backRows(W36, 'moderate', DEFAULT_GAUGE);

  it('splits the back neck and ends with the shoulders held for grafting', () => {
    const last = rows[rows.length - 1];
    expect(last.section).toBe('shoulder');
    expect(last.ops.some((o) => o.kind === 'hold')).toBe(true);
    const held = rows
      .flatMap((r) => r.ops)
      .filter((o) => o.kind === 'hold')
      .reduce((n, o) => n + (o.kind === 'hold' ? o.count : 0), 0);
    expect(held).toBe(52); // two 26-st shoulders, held for grafting
  });

  it('holds all shoulder stitches, balanced across the two sides', () => {
    const holds = rows.flatMap((r) => r.ops).filter((o) => o.kind === 'hold');
    const total = holds.reduce((n, o) => n + (o.kind === 'hold' ? o.count : 0), 0);
    expect(total).toBe(52); // 26 each shoulder
    const perSide = (s: 'L' | 'R'): number =>
      holds.filter((o) => o.kind === 'hold' && o.side === s).reduce((n, o) => n + (o.kind === 'hold' ? o.count : 0), 0);
    expect(perSide('L')).toBe(26);
    expect(perSide('R')).toBe(26);
  });

  it('casts off the centre back neck at the split, at full width', () => {
    const split = rows.find((r) => r.section === 'neck_split')!;
    expect(split.ops).toEqual([{ kind: 'bind_off', count: 42, side: 'center' }]); // 46 − 2×2 curve
    const splitIdx = rows.indexOf(split);
    expect(rows[splitIdx - 1].stitches).toBe(98); // full width right up to the split
  });

  it('keeps the carriage alternating and never gains stitches', () => {
    for (let i = 1; i < rows.length; i++) {
      expect(rows[i].carriage).not.toBe(rows[i - 1].carriage);
      expect(rows[i].stitches).toBeLessThanOrEqual(rows[i - 1].stitches);
    }
  });
});

it('CHECKPOINT: prints the back-piece knitting plan', () => {
  const p = backPlan(W36, 'moderate', G);
  const lines: string[] = [];
  lines.push('');
  lines.push('  BACK — Woman 36", moderate, set-in, 30 sts × 40 rows / 4"');
  lines.push(`  cast on ${p.ribCastOnSts} sts, dec 1 to ${p.bodySts} (finished chest ÷ 2)`);
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
    `  shaping TODO: armhole narrows ${p.bodySts}→${p.upperBackSts} sts (−${p.shaping.armholeDecTotal}, both sides),`,
  );
  lines.push(
    `                top → 2 shoulders ≈ ${p.shaping.shoulderStsEachApprox} sts each + back neck ${p.backNeckSts} sts`,
  );
  const s = armholeShaping(p.bodySts, p.upperBackSts, DEFAULT_GAUGE);
  const rows = backThroughArmhole(W36, 'moderate', DEFAULT_GAUGE);
  const phaseTxt = s.phases
    .map((ph) => `${ph.times}× every ${ph.everyRows === 1 ? 'row' : `${ph.everyRows}${ph.everyRows === 2 ? 'nd' : 'th'} row`}`)
    .join(', ');
  lines.push('');
  lines.push(`  ARMHOLE (curved scye): cast off ${s.castOffPerSide} each underarm, then dec 1 st each end:`);
  lines.push(
    `    ${phaseTxt} → ${rows[rows.length - 1].stitches} sts at row ${rows.length}. NEXT: short-row shoulders + back neck.`,
  );
  lines.push('');
  console.log(lines.join('\n'));
  expect(true).toBe(true);
});
