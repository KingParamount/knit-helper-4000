import { describe, it, expect } from 'vitest';
import { sizes, findSize } from '../data/sizes';
import { easeStyles } from '../data/options';
import type { EaseStyleId } from '../data/types';
import { DEFAULT_GAUGE } from '../gauge';
import { frontNeckPlan, frontRows } from './front';
import { neckbandPlan } from './neckband';
import { assemblyReport } from './assembly';
import { flatFrontAllowed, neckClearsHead } from '../fit';

const G = DEFAULT_GAUGE;
const G2 = { bodySt: 18, bodyRow: (28 * 4) / 5, ribSt: 0, ribRow: 0 };
const G3 = { bodySt: 12, bodyRow: 16, ribSt: 0, ribRow: 0 };
const GAUGES = [G, G2, G3];
const inSizes = sizes.filter((s) => s.units === 'in');
const styles = easeStyles.map((e) => e.id as EaseStyleId);
const W36 = findSize('Woman', 36, 'in')!;

describe('front neck styles: round / scoop / flat', () => {
  it('scoop is deeper than a crew and takes a smaller centre + longer side curve', () => {
    const round = frontNeckPlan(W36, 'moderate', G, 'round');
    const scoop = frontNeckPlan(W36, 'moderate', G, 'scoop');
    expect(scoop.neckDepthRows).toBeGreaterThan(round.neckDepthRows);
    expect(scoop.perSide).toBeGreaterThan(round.perSide);
    expect(scoop.centreCastOff).toBeLessThan(round.centreCastOff);
    // centre + 2·perSide always accounts for the whole front neck.
    expect(scoop.centreCastOff + 2 * scoop.perSide).toBe(scoop.frontNeckSts);
  });

  it('flat casts the whole front neck off straight across — no side curve', () => {
    const flat = frontNeckPlan(W36, 'moderate', G, 'flat');
    expect(flat.perSide).toBe(0);
    expect(flat.centreCastOff).toBe(flat.frontNeckSts);
  });

  it('flat front rows: one straight centre cast-off, no neck shaping, both shoulders held', () => {
    const rows = frontRows(W36, 'moderate', G, 'flat');
    const split = rows.find((r) => r.section === 'neck_split')!;
    const co = split.ops.find((o) => o.kind === 'bind_off')!;
    expect(co.count).toBe(frontNeckPlan(W36, 'moderate', G, 'flat').frontNeckSts);
    expect(rows.some((r) => r.section === 'neck')).toBe(false);
    const holdSides = new Set(
      rows.filter((r) => r.ops.some((o) => o.kind === 'hold')).map((r) => r.side),
    );
    expect(holdSides.has('left') && holdSides.has('right')).toBe(true);
  });

  it('scoop front rows DO shape the neck edge (spread decreases)', () => {
    const rows = frontRows(W36, 'moderate', G, 'scoop');
    const decs = rows.filter((r) => r.section === 'neck' && r.ops.some((o) => o.kind === 'decrease'));
    expect(decs.length).toBeGreaterThan(0);
  });
});

describe('neckband follows the front-neck style', () => {
  it('flat front: no side edge to pick up, full centre; scoop: reads the piece split', () => {
    const flat = neckbandPlan(W36, 'moderate', G, 'flat');
    const scoop = neckbandPlan(W36, 'moderate', G, 'scoop');
    expect(flat.frontSidePickup).toBe(0);
    expect(flat.frontCentreSts).toBe(frontNeckPlan(W36, 'moderate', G, 'flat').frontNeckSts);
    expect(scoop.frontCentreSts).toBe(frontNeckPlan(W36, 'moderate', G, 'scoop').centreCastOff);
    expect(scoop.frontSidePickup).toBeGreaterThan(0);
  });
});

describe('flat-front head-clearance block', () => {
  it('a scoop front never blocks (it only opens the neck further)', () => {
    for (const s of inSizes) {
      if (s.category === 'Baby') continue;
      expect(neckClearsHead(s, 'scoop', 'scoop')).toBe(true);
    }
  });

  it('a flat front clears the head only at the very widest necks (it is a narrow slash neck)', () => {
    // A flat front adds no opening depth, so at our standard neck width it will not pass
    // the head for most sizes — it would need widening into a boat (not built). Only the
    // widest-necked sizes clear; the block correctly greys it elsewhere.
    expect(flatFrontAllowed(findSize('Woman', 56, 'in')!, 'scoop')).toBe(true);
    expect(flatFrontAllowed(findSize('Man', 52, 'in')!, 'scoop')).toBe(true);
    expect(flatFrontAllowed(W36, 'scoop')).toBe(false);
    expect(flatFrontAllowed(findSize('Child', 20, 'in')!, 'scoop')).toBe(false);
    // Flat front + flat back is never looser than flat front + scoop back.
    for (const s of inSizes) {
      if (neckClearsHead(s, 'flat', 'flat')) expect(neckClearsHead(s, 'flat', 'scoop')).toBe(true);
    }
  });
});

describe('Tier-A assembly holds for scoop and flat fronts (all sizes × 3 gauges)', () => {
  for (const neck of ['scoop', 'flat'] as const) {
    for (const gauge of GAUGES) {
      it(`${neck} front sews up at ${gauge.bodySt}×${Math.round(gauge.bodyRow)}`, () => {
        for (const s of inSizes) {
          for (const style of styles) {
            const r = assemblyReport(s, style, gauge, neck, 'set_in', 'scoop');
            expect(r.allOk, `${r.size} ${style}: ${r.invariants.filter((i) => !i.ok).map((i) => i.label)}`).toBe(true);
          }
        }
      });
    }
  }
});

// Anchor: scoop-front DEPTH matches Knitware (Phase-2 harvest, 20×26). Width runs narrower
// (our neck is tied to the shoulder/back-neck graft; KW co-designs a wider scoop) — depth is
// the defining scoop feature, so we lock that.
describe('scoop front depth vs Knitware (20×26 anchor)', () => {
  const KW = { bodySt: 20, bodyRow: 26, ribSt: 0, ribRow: 0 };
  const oracle: [string, number, number][] = [
    ['Baby', 18, 16], ['Child', 24, 22], ['Woman', 30, 28], ['Woman', 38, 32], ['Man', 36, 32],
  ];
  for (const [cat, chest, kwDepth] of oracle) {
    it(`${cat} ${chest}: scoop depth within 2 rows of Knitware's ${kwDepth}`, () => {
      const fp = frontNeckPlan(findSize(cat as never, chest, 'in')!, 'moderate', KW, 'scoop');
      expect(Math.abs(fp.neckDepthRows - kwDepth)).toBeLessThanOrEqual(2);
    });
  }
});
