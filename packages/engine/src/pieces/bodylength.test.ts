import { describe, it, expect } from 'vitest';
import { sizes, findSize } from '../data/sizes';
import { easeStyles } from '../data/options';
import type { EaseStyleId, ShoulderStyle, BodyLength } from '../data/types';
import { DEFAULT_GAUGE } from '../gauge';
import { backPlan, backRows, bodyLengthInches, BODY_LENGTHS } from './back';
import { frontRows } from './front';
import { assembleGarment } from './garment';
import { assemblyReport } from './assembly';
import { bodyLengthAllowed, fitReport, hemReachesHip, HIP_STRETCH } from '../fit';
import { garmentWidths } from '../dimensions';
import { renderPattern, patternText } from '../render/prose';
import { backSchematic, schematicSvg } from '../render/schematic';

// The three sweep gauges (see assembly.test.ts): default 4:3, a coarse non-4:3, and chunky.
const G = DEFAULT_GAUGE;
const G2 = { bodySt: 18, bodyRow: (28 * 4) / 5, ribSt: 0, ribRow: 0 };
const G3 = { bodySt: 12, bodyRow: 16, ribSt: 0, ribRow: 0 };
const GAUGES = [G, G2, G3];
const inSizes = sizes.filter((s) => s.units === 'in');
const styles = easeStyles.map((e) => e.id as EaseStyleId);
const SHOULDERS: ShoulderStyle[] = ['set_in', 'drop', 'saddle', 'raglan'];
const W36 = findSize('Woman', 36, 'in')!;

describe('the body-length ladder', () => {
  it('is strictly monotonic for every size — each stop is longer than the one before', () => {
    for (const s of inSizes) {
      const lengths = BODY_LENGTHS.map((bl) => bodyLengthInches(s, bl));
      for (let i = 1; i < lengths.length; i++) {
        expect(lengths[i], `${s.category} ${s.chest}: ${BODY_LENGTHS[i]}`).toBeGreaterThan(
          lengths[i - 1],
        );
      }
    }
  });

  it('hip is the default and reproduces the original formula', () => {
    for (const s of inSizes) {
      expect(bodyLengthInches(s)).toBe(bodyLengthInches(s, 'hip'));
      // nape-to-hip less the neck rise (the pre-body-length behaviour, back.ts).
      const rise = Math.min(1.6, Math.max(0, (s.neck_depth - 1.7) * 2.3));
      expect(bodyLengthInches(s, 'hip')).toBeCloseTo(s.neck_to_waist + s.waist_to_hip - rise, 10);
    }
  });

  it('the measured anchors land on their columns (waist / hip / knee / ankle)', () => {
    const rise = (s: (typeof inSizes)[number]): number =>
      Math.min(1.6, Math.max(0, (s.neck_depth - 1.7) * 2.3));
    for (const s of inSizes) {
      expect(bodyLengthInches(s, 'waist')).toBeCloseTo(s.neck_to_waist - rise(s), 10);
      expect(bodyLengthInches(s, 'knee')).toBeCloseTo(s.neck_to_waist + s.waist_to_knee - rise(s), 10);
      expect(bodyLengthInches(s, 'ankle')).toBeCloseTo(s.neck_to_waist + s.waist_to_ankle - rise(s), 10);
    }
  });
});

describe('default garment is untouched by the new axis', () => {
  it('backPlan with no options is identical to an explicit hip length', () => {
    for (const g of GAUGES) {
      for (const sh of SHOULDERS) {
        const dflt = backPlan(W36, 'moderate', g, sh);
        const hip = backPlan(W36, 'moderate', g, sh, 'scoop', { bodyLength: 'hip' });
        expect(hip).toEqual(dflt);
      }
    }
  });

  it('assembleGarment defaults to hip and records the choice', () => {
    const dflt = assembleGarment(W36, 'moderate', G);
    expect(dflt.bodyLength).toBe('hip');
    const knee = assembleGarment(W36, 'moderate', G, 'round', 'set_in', 'scoop', {
      bodyLength: 'knee',
    });
    expect(knee.bodyLength).toBe('knee');
    expect(knee.back.length).toBeGreaterThan(dflt.back.length);
    // The armhole is length-independent — only the plain body below it grows.
    const kneePlan = backPlan(W36, 'moderate', G, 'set_in', 'scoop', { bodyLength: 'knee' });
    const hipPlan = backPlan(W36, 'moderate', G, 'set_in');
    expect(kneePlan.armholeRows).toBe(hipPlan.armholeRows);
    expect(kneePlan.ribRows).toBe(hipPlan.ribRows);
    expect(kneePlan.bodySts).toBe(hipPlan.bodySts);
    expect(kneePlan.bodyRows).toBeGreaterThan(hipPlan.bodyRows);
  });
});

describe('bodyLengthAllowed (the UI block, calibrated to our data)', () => {
  it('hip and everything longer is always buildable', () => {
    const longer = BODY_LENGTHS.slice(BODY_LENGTHS.indexOf('hip'));
    for (const s of inSizes)
      for (const sh of SHOULDERS)
        for (const g of GAUGES)
          for (const bl of longer)
            expect(bodyLengthAllowed(s, 'moderate', g, sh, bl), `${s.category} ${s.chest} ${sh} ${bl}`).toBe(true);
  });

  it('only crop and waist ever block, and waist only for the smallest raglans', () => {
    for (const s of inSizes)
      for (const sh of SHOULDERS)
        for (const g of GAUGES)
          for (const bl of BODY_LENGTHS) {
            if (bodyLengthAllowed(s, 'moderate', g, sh, bl)) continue;
            expect(['crop', 'waist']).toContain(bl);
            if (bl === 'waist') {
              // Calibrated: a raglan's deeper armhole + the full hem rib outruns the
              // shortest torsos — babies and the two smallest children.
              expect(sh).toBe('raglan');
              expect(s.category === 'Baby' || (s.category === 'Child' && s.chest <= 22)).toBe(true);
            }
          }
  });

  it('crop: fine for men at set-in, impossible for every raglan (the deep raglan + full rib eats it)', () => {
    for (const s of inSizes) {
      if (s.category === 'Man') expect(bodyLengthAllowed(s, 'moderate', G, 'set_in', 'crop')).toBe(true);
      // Note: hem styles (next phase) may reopen this — the guard reads the real hem depth.
      for (const g of GAUGES) expect(bodyLengthAllowed(s, 'moderate', g, 'raglan', 'crop')).toBe(false);
    }
  });

  it('crop is blocked for every baby and child at set-in (their armhole + hem is the whole length)', () => {
    for (const s of inSizes.filter((x) => x.category === 'Baby' || x.category === 'Child'))
      expect(bodyLengthAllowed(s, 'moderate', G, 'set_in', 'crop')).toBe(false);
  });
});

describe('Tier A — every allowed length sews up', () => {
  it('assembly invariants hold across sizes × shoulders × gauges × lengths', () => {
    const sample: BodyLength[] = ['crop', 'waist', 'regular', 'knee', 'ankle'];
    let checked = 0;
    for (const s of inSizes)
      for (const sh of SHOULDERS)
        for (const g of GAUGES)
          for (const bl of sample) {
            if (!bodyLengthAllowed(s, 'moderate', g, sh, bl)) continue;
            const r = assemblyReport(s, 'moderate', g, 'round', sh, 'scoop', { bodyLength: bl });
            expect(r.allOk, `${r.size} ${sh} ${bl}: ${JSON.stringify(r.invariants.filter((i) => !i.ok))}`).toBe(true);
            checked++;
          }
    expect(checked).toBeGreaterThan(1000); // the sweep really swept
  });

  it('all ease styles at the extremes (waist and ankle)', () => {
    for (const style of styles)
      for (const bl of ['waist', 'ankle'] as BodyLength[]) {
        const r = assemblyReport(W36, style, G, 'round', 'set_in', 'scoop', { bodyLength: bl });
        expect(r.allOk, `${style} ${bl}`).toBe(true);
      }
  });
});

describe('Tier B — fit checks are length-aware', () => {
  it('hip clearance does not bite above the hip', () => {
    expect(hemReachesHip('crop')).toBe(false);
    expect(hemReachesHip('regular')).toBe(false);
    expect(hemReachesHip('hip')).toBe(true);
    expect(hemReachesHip('ankle')).toBe(true);
    // A size whose hip is genuinely tight at a snug style: fails at hip length,
    // not applicable (ok) at waist length.
    const tight = inSizes.find((s) => s.hip > garmentWidths(s, 'skintight', 'set_in').chest * HIP_STRETCH);
    expect(tight).toBeDefined();
    const at = (bl: BodyLength) =>
      fitReport(tight!, 'skintight', 'round', 'set_in', 'scoop', { bodyLength: bl }).checks.find(
        (c) => c.label === 'hip clearance',
      )!;
    expect(at('hip').ok).toBe(false);
    expect(at('waist').ok).toBe(true);
    expect(at('waist').detail).toContain('n/a');
    expect(at('knee').ok).toBe(false); // past the hip on the way down
  });
});

describe('renderers take the new lengths in stride', () => {
  it('prose and schematic build for an ankle-length garment', () => {
    const g = assembleGarment(W36, 'moderate', G, 'round', 'set_in', 'scoop', {
      bodyLength: 'ankle',
    });
    const text = patternText(renderPattern(g));
    expect(text).toContain('The Back');
    const plan = backPlan(W36, 'moderate', G, 'set_in', 'scoop', { bodyLength: 'ankle' });
    const svg = schematicSvg(backSchematic(g.back, plan, G));
    expect(svg).toContain('<svg');
  });

  it('row arrays stay carriage-consistent at a non-default length', () => {
    for (const sh of SHOULDERS) {
      const back = backRows(W36, 'moderate', G, sh, 'scoop', { bodyLength: 'knee' });
      const front = frontRows(W36, 'moderate', G, 'round', sh, { bodyLength: 'knee' });
      for (const rows of [back, front])
        for (const r of rows) expect(r.carriage, `${sh} row ${r.index}`).toMatch(/^[LR]$/);
    }
  });
});
