import { describe, it, expect } from 'vitest';
import { findSize } from '../data/sizes';
import { DEFAULT_GAUGE } from '../gauge';
import { neckbandPlan, neckbandRows } from './neckband';

const W36 = findSize('Woman', 36, 'in')!;
const G = DEFAULT_GAUGE;

describe('neckband plan (Woman 36", moderate)', () => {
  const p = neckbandPlan(W36, 'moderate', G);

  it('picks up around the whole neck opening', () => {
    expect(p.backCentreSts).toBe(42); // 1:1 along the back scoop centre cast-off
    expect(p.backSidePickup).toBe(11); // 15 back-neck rows × 3/4 each shaped side
    expect(p.frontCentreSts).toBe(24); // 1:1 along the front centre cast-off
    expect(p.frontSidePickup).toBe(27); // 36 rows × 3/4 each shaped side
    expect(p.pickupTotal).toBe(143); // 42 + 2×11 + 24 + 2×27 = 142, +1 for odd (extra right)
  });

  it('is a shallow band from the neck rib depth', () => {
    expect(p.bandRows).toBe(10); // rib_neck 1.0"
  });
});

describe('neckband rows', () => {
  const rows = neckbandRows(W36, 'moderate', G);

  it('picks up, ribs, then casts off', () => {
    expect(rows[0].ops).toEqual([{ kind: 'pick_up', count: 143 }]);
    expect(rows[0].piece).toBe('collar');
    expect(rows[rows.length - 1].ops).toEqual([{ kind: 'bind_off', count: 143, side: 'center' }]);
    expect(rows[rows.length - 1].stitches).toBe(0);
    expect(rows).toHaveLength(12); // pick-up + 10 rib + cast-off
  });
});
