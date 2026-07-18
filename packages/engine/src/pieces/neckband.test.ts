import { describe, it, expect } from 'vitest';
import { findSize, sizes } from '../data/sizes';
import { DEFAULT_GAUGE } from '../gauge';
import { neckbandPlan, neckbandRows } from './neckband';

const W36 = findSize('Woman', 36, 'in')!;
const G = DEFAULT_GAUGE;
const sizesForV = () => sizes.filter((s) => s.units === 'in');

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

describe('neckband rows (crew) — a separate strip cast on and taken off on waste yarn', () => {
  const rows = neckbandRows(W36, 'moderate', G);

  it('casts on, works straight rib, marks waypoints, then comes off on waste yarn', () => {
    expect(rows[0].ops).toEqual([{ kind: 'cast_on', count: 143 }]);
    expect(rows[0].piece).toBe('collar');
    const last = rows[rows.length - 1];
    expect(last.ops).toEqual([{ kind: 'take_off', count: 143 }]); // live, not cast off
    expect(last.section).toBe('take_off');
    expect(rows[rows.length - 2].section).toBe('mark'); // penultimate = the waypoints
  });

  it('has no shaping between cast-on and the marker row (straight rib)', () => {
    for (const r of rows.slice(1, -2)) {
      expect(r.section).toBe('rib');
      expect(r.ops).toEqual([]);
    }
  });

  it('marks one interior waypoint — the far shoulder (its ends sit at the open shoulder)', () => {
    const mark = rows[rows.length - 2];
    expect(mark.ops[0]).toEqual({ kind: 'mark', positions: neckbandPlan(W36, 'moderate', G).waypoints });
    expect(neckbandPlan(W36, 'moderate', G).waypoints).toHaveLength(1);
  });
});

describe('neckband rows (v-neck) — mitre both ends with edge decreases, seam at front', () => {
  const p = neckbandPlan(W36, 'moderate', G, 'v');
  const rows = neckbandRows(W36, 'moderate', G, 'v');

  it('mitres both ends: an EDGE decrease at each end every mitre row (knittable)', () => {
    const mitre = rows.filter((r) => r.section === 'mitre');
    expect(mitre).toHaveLength(p.mitreRows);
    for (const r of mitre) {
      expect(r.ops).toEqual([{ kind: 'decrease', count: 1, side: 'both' }]); // not 'center'
    }
  });

  it('takes off the stitches the mitre leaves (cast-on − 2 per mitre row), live', () => {
    const last = rows[rows.length - 1];
    expect(p.finalSts).toBe(p.pickupTotal - 2 * p.mitreRows);
    expect(last.ops).toEqual([{ kind: 'take_off', count: p.finalSts }]);
    expect(last.stitches).toBe(p.finalSts); // still live on waste yarn
  });

  it('marks both shoulder waypoints (its ends sit at the centre front)', () => {
    expect(p.waypoints).toHaveLength(2);
    expect(rows[rows.length - 2].ops[0]).toEqual({ kind: 'mark', positions: p.waypoints });
  });

  it('keeps the stitch count positive through the mitre for every size', () => {
    for (const s of sizesForV()) {
      const pv = neckbandPlan(s, 'moderate', G, 'v');
      expect(pv.finalSts, `${s.category} ${s.chest}"`).toBeGreaterThan(0);
    }
  });
});
