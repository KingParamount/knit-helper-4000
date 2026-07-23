import { describe, it, expect } from 'vitest';
import { sizes, findSize } from '../data/sizes';
import type { HemStyle, ShoulderStyle, SleeveLength } from '../data/types';
import { DEFAULT_GAUGE } from '../gauge';
import { sleevePlan, sleeveRows, SLEEVE_LENGTH_FRACTION, CUFF_EASE_IN } from './sleeve';
import { hemPlan } from './hem';
import { garmentWidths } from '../dimensions';
import { assembleGarment } from './garment';
import { assemblyReport } from './assembly';
import { fitReport } from '../fit';
import { renderPattern, patternText } from '../render/prose';
import { sleeveSchematic, schematicSvg } from '../render/schematic';

const G = DEFAULT_GAUGE;
const G3 = { bodySt: 12, bodyRow: 16, ribSt: 0, ribRow: 0 }; // chunky
const GAUGES = [G, G3];
const inSizes = sizes.filter((s) => s.units === 'in');
const SHOULDERS: ShoulderStyle[] = ['set_in', 'drop', 'saddle', 'raglan'];
const LENGTHS: SleeveLength[] = ['full', 'three_quarter', 'half', 'short'];
const W36 = findSize('Woman', 36, 'in')!;

describe('default garment is untouched by the new axis', () => {
  it('sleevePlan and sleeveRows with no options are identical to explicit full', () => {
    for (const g of GAUGES)
      for (const sh of SHOULDERS) {
        expect(sleevePlan(W36, 'moderate', g, sh, { sleeveLength: 'full' })).toEqual(
          sleevePlan(W36, 'moderate', g, sh),
        );
        expect(sleeveRows('sleeve_l', W36, 'moderate', g, sh, { sleeveLength: 'full' })).toEqual(
          sleeveRows('sleeve_l', W36, 'moderate', g, sh),
        );
      }
  });
});

describe('the truncated taper', () => {
  it('shorter sleeves cast on wider, work fewer rows, increase less — same top', () => {
    for (const s of inSizes)
      for (const g of GAUGES) {
        let prev = sleevePlan(s, 'moderate', g, 'set_in', { sleeveLength: 'full' });
        for (const sl of ['three_quarter', 'half', 'short'] as SleeveLength[]) {
          const p = sleevePlan(s, 'moderate', g, 'set_in', { sleeveLength: sl });
          expect(p.bodyCuffSts, `${s.category} ${s.chest} ${sl} cuff`).toBeGreaterThanOrEqual(prev.bodyCuffSts);
          expect(p.taperRows, `${s.category} ${s.chest} ${sl} taper`).toBeLessThan(prev.taperRows);
          expect(p.incPerSide).toBeLessThanOrEqual(prev.incPerSide);
          expect(p.incPerSide).toBeGreaterThanOrEqual(0);
          // The top is pinned to the armhole it sews into — length never moves it
          // beyond the cast-on's even-rounding (two baby sizes at chunky land a
          // stitch above the exact target and knit straight instead).
          expect(Math.abs(p.sleeveTopSts - prev.sleeveTopSts), `${s.category} ${s.chest} ${sl} top`).toBeLessThanOrEqual(2);
          expect(p.capHeightRows).toBe(prev.capHeightRows);
          prev = p;
        }
      }
  });

  it('the hem width sits on the full sleeve’s taper line', () => {
    for (const sl of LENGTHS) {
      const f = SLEEVE_LENGTH_FRACTION[sl];
      const w = garmentWidths(W36, 'moderate', 'set_in');
      const expected = w.sleeveTop + f * (W36.wrist + CUFF_EASE_IN - w.sleeveTop);
      const p = sleevePlan(W36, 'moderate', G, 'set_in', { sleeveLength: sl });
      const actualIn = (p.bodyCuffSts - 2) / (G.bodySt / 4); // less the seam allowance
      expect(Math.abs(actualIn - expected)).toBeLessThan(2 * (4 / G.bodySt)); // within rounding
    }
  });

  it('the hem shallows with the sleeve, and only when it must', () => {
    const full = sleevePlan(W36, 'moderate', G, 'set_in', { sleeveLength: 'full' });
    const short = sleevePlan(W36, 'moderate', G, 'set_in', { sleeveLength: 'short' });
    expect(full.hemDepthIn).toBe(W36.rib_body); // unchanged
    expect(short.hemDepthIn).toBeLessThan(W36.rib_body);
    expect(short.hemDepthIn).toBeGreaterThan(0);
  });

  it('every length leaves a workable taper (more rows than increases)', () => {
    for (const s of inSizes)
      for (const g of GAUGES)
        for (const sl of LENGTHS) {
          const p = sleevePlan(s, 'moderate', g, 'set_in', { sleeveLength: sl });
          expect(p.taperRows, `${s.category} ${s.chest} ${sl}`).toBeGreaterThanOrEqual(2);
          expect(p.taperRows).toBeGreaterThanOrEqual(p.incPerSide);
        }
  });
});

describe('Tier A — every length sews up on every shoulder', () => {
  it('assembly invariants hold across sizes × shoulders × gauges × lengths', () => {
    let checked = 0;
    for (const s of inSizes)
      for (const sh of SHOULDERS)
        for (const g of GAUGES)
          for (const sl of LENGTHS) {
            const r = assemblyReport(s, 'moderate', g, 'round', sh, 'scoop', { sleeveLength: sl });
            expect(r.allOk, `${r.size} ${sh} ${sl}: ${JSON.stringify(r.invariants.filter((i) => !i.ok))}`).toBe(true);
            checked++;
          }
    expect(checked).toBe(inSizes.length * SHOULDERS.length * GAUGES.length * LENGTHS.length);
  });

  it('length composes with the hems (the shared cuff hem machinery)', () => {
    for (const h of ['moss_band', 'folded_band', 'frill', 'none'] as HemStyle[])
      for (const sl of ['short', 'half'] as SleeveLength[]) {
        const r = assemblyReport(W36, 'moderate', G, 'round', 'set_in', 'scoop', { hem: h, sleeveLength: sl });
        expect(r.allOk, `${h} × ${sl}`).toBe(true);
        const p = sleevePlan(W36, 'moderate', G, 'set_in', { hem: h, sleeveLength: sl });
        const hp = hemPlan(W36, G, h, p.bodyCuffSts, p.hemDepthIn);
        expect(p.ribCastOnSts).toBe(hp.castOnSts); // frill doubles the SHORT cuff, etc.
        expect(p.ribRows).toBe(hp.pieceRows);
      }
  });
});

describe('Tier B — the shortened hem clears the arm', () => {
  it('across all sizes, eases and lengths', () => {
    for (const s of inSizes)
      for (const ease of ['skintight', 'tight', 'moderate', 'comfortable', 'oversized'] as const)
        for (const sl of ['three_quarter', 'half', 'short'] as SleeveLength[]) {
          const r = fitReport(s, ease, 'round', 'set_in', 'scoop', { sleeveLength: sl });
          const c = r.checks.find((x) => x.label === 'sleeve hem clears the arm')!;
          expect(c.ok, `${s.category} ${s.chest} ${ease} ${sl}: ${c.detail}`).toBe(true);
        }
  });

  it('a full sleeve carries no hem-point check (the cuff is the wrist, already covered)', () => {
    const r = fitReport(W36, 'moderate', 'round', 'set_in', 'scoop', { sleeveLength: 'full' });
    expect(r.checks.some((x) => x.label === 'sleeve hem clears the arm')).toBe(false);
  });
});

describe('renderers and rows', () => {
  it('prose and schematic build for a short sleeve, and the garment records the choice', () => {
    const g = assembleGarment(W36, 'moderate', G, 'round', 'set_in', 'scoop', { sleeveLength: 'short' });
    expect(g.sleeveLength).toBe('short');
    const text = patternText(renderPattern(g));
    expect(text).toContain('The Sleeves (make 2)');
    const sp = sleevePlan(W36, 'moderate', G, 'set_in', { sleeveLength: 'short' });
    expect(text).toContain(`Cast on ${sp.ribCastOnSts} stitches`);
    const svg = schematicSvg(sleeveSchematic(g.sleeveLeft, sp, G));
    expect(svg).toContain('<svg');
  });

  it('rows stay carriage-consistent at every length', () => {
    for (const sl of LENGTHS)
      for (const sh of SHOULDERS)
        for (const r of sleeveRows('sleeve_l', W36, 'moderate', G, sh, { sleeveLength: sl }))
          expect(r.carriage, `${sl} ${sh} row ${r.index}`).toMatch(/^[LR]$/);
  });
});
