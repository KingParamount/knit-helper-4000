import { describe, it, expect } from 'vitest';
import { sizes, findSize } from '../data/sizes';
import type { ShoulderStyle } from '../data/types';
import { DEFAULT_GAUGE } from '../gauge';
import { garmentWidths, SLEEVELESS_ARMHOLE_DEEPEN_IN, SLEEVELESS_BACK_NARROW_IN } from '../dimensions';
import { armholeBandPlan, armholeBandRows } from './armhole-band';
import { assembleGarment } from './garment';
import { assemblyReport } from './assembly';
import { fitReport, sleeveStyleAllowed, MIN_SHOULDER_IN } from '../fit';
import { pickupPerRow } from './neckband';
import { backPlan, armholeShaping } from './back';
import { renderPattern, patternText } from '../render/prose';
import { armholeBandSchematic, schematicSvg } from '../render/schematic';

const G = DEFAULT_GAUGE;
const G2 = { bodySt: 18, bodyRow: (28 * 4) / 5, ribSt: 0, ribRow: 0 };
const G3 = { bodySt: 12, bodyRow: 16, ribSt: 0, ribRow: 0 };
const GAUGES = [G, G2, G3];
const inSizes = sizes.filter((s) => s.units === 'in');
const OK: ShoulderStyle[] = ['set_in', 'drop'];
const W36 = findSize('Woman', 36, 'in')!;

describe('sleeveless is a set-in or drop feature', () => {
  it('is blocked for raglan and saddle (which are their own sleeve)', () => {
    expect(sleeveStyleAllowed('set_in', 'sleeveless')).toBe(true);
    expect(sleeveStyleAllowed('drop', 'sleeveless')).toBe(true);
    expect(sleeveStyleAllowed('raglan', 'sleeveless')).toBe(false);
    expect(sleeveStyleAllowed('saddle', 'sleeveless')).toBe(false);
  });
});

describe('the sleeveless body armhole', () => {
  it('is deeper and narrower across the back than the sleeved one', () => {
    for (const s of inSizes) {
      const sleeved = garmentWidths(s, 'moderate', 'set_in', false);
      const sleeveless = garmentWidths(s, 'moderate', 'set_in', true);
      expect(sleeveless.armholeDepth).toBeCloseTo(sleeved.armholeDepth + SLEEVELESS_ARMHOLE_DEEPEN_IN, 10);
      expect(sleeveless.backWidth).toBeCloseTo(sleeved.backWidth - SLEEVELESS_BACK_NARROW_IN, 10);
    }
  });

  it('leaves a wearable shoulder at every size (the narrowing is safe)', () => {
    for (const s of inSizes)
      for (const sh of OK) {
        const c = fitReport(s, 'moderate', 'round', sh, 'scoop', { sleeveLength: 'sleeveless' }).checks;
        const shoulder = c.find((x) => x.label === 'neck not too wide')!;
        expect(shoulder.ok, `${s.category} ${s.chest} ${sh}: ${shoulder.detail}`).toBe(true);
      }
  });

  it('drops the sleeve-clears-arm check (there is no sleeve)', () => {
    const c = fitReport(W36, 'moderate', 'round', 'set_in', 'scoop', { sleeveLength: 'sleeveless' }).checks;
    expect(c.find((x) => x.label === 'sleeve clears the arm')!.detail).toContain('n/a');
  });
});

describe('the armhole band', () => {
  it('picks up along the armhole edge at the gauge rate', () => {
    for (const s of inSizes)
      for (const sh of OK)
        for (const g of GAUGES) {
          const bp = backPlan(s, 'moderate', g, sh, 'scoop', { sleeveLength: 'sleeveless' });
          const underarm = sh === 'drop' ? 0 : armholeShaping(bp.bodySts, bp.upperBackSts).castOffPerSide;
          const expected = Math.round((2 * bp.armholeRows + 2 * underarm) * pickupPerRow(g));
          const band = armholeBandPlan(s, 'moderate', g, sh);
          expect(Math.abs(band.pickupTotal - expected)).toBeLessThanOrEqual(1); // odd-parity slack
          expect(band.pickupTotal % 2).toBe(1); // cast on odd for a symmetric rib band
        }
  });

  it('is a shallow rib rectangle that comes off on waste yarn', () => {
    const rows = armholeBandRows(W36, 'moderate', G, 'set_in');
    expect(rows[0].ops[0]).toMatchObject({ kind: 'cast_on' });
    expect(rows[rows.length - 1].ops[0]).toMatchObject({ kind: 'take_off' });
    expect(rows.every((r) => r.piece === 'armband')).toBe(true);
    for (const r of rows) expect(r.carriage).toMatch(/^[LR]$/);
  });
});

describe('the garment has bands, not sleeves', () => {
  it('assembleGarment drops the sleeves and adds one armhole band', () => {
    const g = assembleGarment(W36, 'moderate', G, 'round', 'set_in', 'scoop', { sleeveLength: 'sleeveless' });
    expect(g.sleeveLeft).toHaveLength(0);
    expect(g.sleeveRight).toHaveLength(0);
    expect(g.armholeBand).toBeDefined();
    expect(g.armholeBand!.length).toBeGreaterThan(0);
    expect(g.sleeveLength).toBe('sleeveless');
    // A sleeved garment keeps its sleeves and has no band.
    const sleeved = assembleGarment(W36, 'moderate', G, 'round', 'set_in', 'scoop', { sleeveLength: 'short' });
    expect(sleeved.sleeveLeft.length).toBeGreaterThan(0);
    expect(sleeved.armholeBand).toBeUndefined();
  });
});

describe('Tier A — sleeveless sews up', () => {
  it('invariants hold across sizes × {set-in, drop} × gauges', () => {
    let checked = 0;
    for (const s of inSizes)
      for (const sh of OK)
        for (const g of GAUGES) {
          const r = assemblyReport(s, 'moderate', g, 'round', sh, 'scoop', { sleeveLength: 'sleeveless' });
          expect(r.allOk, `${r.size} ${sh}: ${JSON.stringify(r.invariants.filter((i) => !i.ok))}`).toBe(true);
          // No sleeve join or underarm-meet invariant remains; a band invariant replaces them.
          expect(r.invariants.some((i) => i.label === 'armhole band fits the armhole')).toBe(true);
          expect(r.invariants.some((i) => /cap|sleeve/.test(i.label))).toBe(false);
          checked++;
        }
    expect(checked).toBe(inSizes.length * OK.length * GAUGES.length);
  });
});

describe('sleeveless prose and schematic', () => {
  it('renders armhole bands and a sleeveless making-up, both voices', () => {
    const g = assembleGarment(W36, 'moderate', G, 'round', 'set_in', 'scoop', { sleeveLength: 'sleeveless' });
    for (const technique of ['machine', 'hand'] as const) {
      const p = renderPattern(g, { style: 'verbose', technique, gauge: G, units: 'in' });
      const titles = p.pieces.map((x) => x.title);
      expect(titles.some((t) => /Armhole Bands/.test(t))).toBe(true);
      expect(titles.some((t) => /Sleeve/.test(t))).toBe(false);
      const text = patternText(p);
      expect(text).toMatch(/armhole/i);
      expect(text).not.toMatch(/Set in the sleeves|Sew in the sleeves/);
    }
    // The machine band is a separate sewn-on strip; the hand band is picked up in place.
    const m = patternText(renderPattern(g));
    expect(m).toContain('Sew the armhole bands on');
    const ph = renderPattern(g, { style: 'verbose', technique: 'hand', gauge: G, units: 'in' });
    const bandPiece = ph.pieces.find((x) => /Armhole Bands/.test(x.title))!;
    const bandText = bandPiece.lines.join('\n');
    expect(bandText).toMatch(/pick up and knit .* around the armhole edge/i);
    // The armhole band's own cast-off is the plain one, NOT the neckband's "over the head".
    expect(bandText).not.toContain('over the head');
    expect(bandText).toContain('Cast off');
  });

  it('the armhole-band schematic is a rib rectangle', () => {
    const svg = schematicSvg(armholeBandSchematic(armholeBandPlan(W36, 'moderate', G, 'set_in'), G));
    expect(svg).toContain('<svg');
  });
});
