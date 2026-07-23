import { describe, it, expect } from 'vitest';
import { sizes, findSize } from '../data/sizes';
import type { HemStyle, ShoulderStyle } from '../data/types';
import { DEFAULT_GAUGE, ribRowsFor } from '../gauge';
import { hemPlan, HEM_SECTIONS, HEM_END_SECTIONS } from './hem';
import { backPlan, backRows, lowerPanelRows } from './back';
import { frontRows } from './front';
import { sleevePlan, sleeveRows } from './sleeve';
import { assembleGarment } from './garment';
import { assemblyReport } from './assembly';
import { bodyLengthAllowed, hemAllowed } from '../fit';
import { renderPattern, patternText } from '../render/prose';
import { backSchematic, sleeveSchematic, schematicSvg } from '../render/schematic';

// The three sweep gauges (see assembly.test.ts): default 4:3, a coarse non-4:3, and chunky.
const G = DEFAULT_GAUGE;
const G2 = { bodySt: 18, bodyRow: (28 * 4) / 5, ribSt: 0, ribRow: 0 };
const G3 = { bodySt: 12, bodyRow: 16, ribSt: 0, ribRow: 0 };
const GAUGES = [G, G2, G3];
const inSizes = sizes.filter((s) => s.units === 'in');
const SHOULDERS: ShoulderStyle[] = ['set_in', 'drop', 'saddle', 'raglan'];
const HEMS: HemStyle[] = ['ribbing', 'moss_band', 'garter_band', 'folded_band', 'frill', 'none'];
const W36 = findSize('Woman', 36, 'in')!;

describe('hemPlan — cast-on widths and depths per style', () => {
  it('rib casts on odd, frill double, everything else the panel width', () => {
    for (const s of inSizes) {
      const panel = 100;
      expect(hemPlan(s, G, 'ribbing', panel).castOnSts).toBe(panel + 1);
      expect(hemPlan(s, G, 'frill', panel).castOnSts).toBe(2 * panel);
      for (const h of ['moss_band', 'garter_band', 'folded_band', 'none'] as HemStyle[])
        expect(hemPlan(s, G, h, panel).castOnSts).toBe(panel);
    }
  });

  it('depths: moss/garter run half the rib depth; folded knits double; none is zero', () => {
    for (const s of inSizes)
      for (const g of GAUGES) {
        const rib = hemPlan(s, g, 'ribbing', 100);
        const moss = hemPlan(s, g, 'moss_band', 100);
        const folded = hemPlan(s, g, 'folded_band', 100);
        expect(rib.pieceRows).toBe(ribRowsFor(s.rib_body, g));
        expect(moss.pieceRows).toBe(Math.max(2, ribRowsFor(s.rib_body / 2, g)));
        expect(folded.pieceRows).toBe(2 * folded.lengthRows); // facing + outer
        expect(hemPlan(s, g, 'none', 100).pieceRows).toBe(0);
        // Only the folded band's piece outruns its hanging length.
        for (const h of ['ribbing', 'moss_band', 'garter_band', 'frill', 'none'] as HemStyle[]) {
          const p = hemPlan(s, g, h, 100);
          expect(p.lengthRows).toBe(p.pieceRows);
        }
      }
  });

  it('every section a hem emits is in HEM_SECTIONS, and its last row in HEM_END_SECTIONS', () => {
    for (const h of HEMS) {
      const p = hemPlan(W36, G, h, 100);
      for (let i = 1; i <= p.pieceRows; i++) expect(HEM_SECTIONS.has(p.sectionAt(i))).toBe(true);
      if (p.pieceRows > 0) expect(HEM_END_SECTIONS.has(p.sectionAt(p.pieceRows))).toBe(true);
    }
  });
});

describe('default garment is untouched by the new axis', () => {
  it('backPlan and sleevePlan with no options are identical to explicit ribbing', () => {
    for (const g of GAUGES)
      for (const sh of SHOULDERS) {
        expect(backPlan(W36, 'moderate', g, sh, 'scoop', { hem: 'ribbing' })).toEqual(
          backPlan(W36, 'moderate', g, sh),
        );
        expect(sleevePlan(W36, 'moderate', g, sh, { hem: 'ribbing' })).toEqual(
          sleevePlan(W36, 'moderate', g, sh),
        );
      }
  });
});

describe('length accounting holds for every hem', () => {
  it('hem + body + armhole = garment length; the piece only outgrows it by the facing', () => {
    for (const s of inSizes)
      for (const g of GAUGES)
        for (const h of HEMS) {
          const p = backPlan(s, 'moderate', g, 'set_in', 'scoop', { hem: h });
          expect(p.hemLengthRows + p.bodyRows + p.armholeRows).toBe(p.totalRows);
          expect(p.pieceTotalRows).toBe(p.totalRows + (p.ribRows - p.hemLengthRows));
          const rows = lowerPanelRows('back', s, 'moderate', g, 'set_in', { hem: h });
          expect(rows.length).toBe(p.ribRows + p.bodyRows);
        }
  });

  it('the sleeve subtracts only the hanging hem from its taper span', () => {
    const rib = sleevePlan(W36, 'moderate', G);
    const folded = sleevePlan(W36, 'moderate', G, 'set_in', { hem: 'folded_band' });
    const none = sleevePlan(W36, 'moderate', G, 'set_in', { hem: 'none' });
    // Folded: cuff depth equals the rib depth, so the taper span matches ribbing's,
    // while the knitted cuff itself is twice as long.
    expect(folded.taperRows).toBe(rib.taperRows);
    expect(folded.ribRows).toBe(2 * rib.ribRows);
    // None: the whole arm length is taper.
    expect(none.taperRows).toBe(rib.taperRows + rib.ribRows);
    expect(none.ribRows).toBe(0);
  });
});

describe('the folded band and the frill build their special rows', () => {
  it('folded: fold row at the midpoint, closing pick-up on the last hem row', () => {
    const p = backPlan(W36, 'moderate', G, 'set_in', 'scoop', { hem: 'folded_band' });
    const rows = lowerPanelRows('back', W36, 'moderate', G, 'set_in', { hem: 'folded_band' });
    const depth = p.hemLengthRows;
    expect(rows[depth].section).toBe('folded_turn'); // row depth+1 (0-indexed depth)
    const join = rows[p.ribRows - 1];
    expect(join.section).toBe('folded_join');
    const pu = join.ops.find((o) => o.kind === 'pick_up');
    expect(pu?.count).toBe(p.bodySts);
  });

  it('frill: double stitches through the hem, one gather-across into the body', () => {
    const p = backPlan(W36, 'moderate', G, 'set_in', 'scoop', { hem: 'frill' });
    const rows = lowerPanelRows('back', W36, 'moderate', G, 'set_in', { hem: 'frill' });
    expect(rows[0].stitches).toBe(2 * p.bodySts);
    const gatherRow = rows[p.ribRows]; // first body row
    const gather = gatherRow.ops.find((o) => o.kind === 'decrease');
    expect(gather).toMatchObject({ side: 'across', count: p.bodySts });
    expect(gatherRow.stitches).toBe(p.bodySts);
  });

  it("none: the cast-on is the first body row and the garment length is unchanged", () => {
    const rib = backPlan(W36, 'moderate', G);
    const none = backPlan(W36, 'moderate', G, 'set_in', 'scoop', { hem: 'none' });
    expect(none.totalRows).toBe(rib.totalRows);
    const rows = lowerPanelRows('back', W36, 'moderate', G, 'set_in', { hem: 'none' });
    expect(rows[0].section).toBe('body');
    expect(rows[0].ops[0]).toMatchObject({ kind: 'cast_on', count: none.bodySts });
  });
});

describe('Tier A — every hem sews up on every shoulder', () => {
  it('assembly invariants hold across sizes × shoulders × gauges × hems', () => {
    let checked = 0;
    for (const s of inSizes)
      for (const sh of SHOULDERS)
        for (const g of [G, G3])
          for (const h of HEMS) {
            const r = assemblyReport(s, 'moderate', g, 'round', sh, 'scoop', { hem: h });
            expect(r.allOk, `${r.size} ${sh} ${h}: ${JSON.stringify(r.invariants.filter((i) => !i.ok))}`).toBe(true);
            checked++;
          }
    expect(checked).toBe(inSizes.length * SHOULDERS.length * 2 * HEMS.length);
  });
});

describe('hem availability and the crop reopening', () => {
  it('frill is hand-only; everything else is allowed on both techniques', () => {
    expect(hemAllowed('frill', 'machine')).toBe(false);
    expect(hemAllowed('frill', 'hand')).toBe(true);
    for (const h of HEMS.filter((x) => x !== 'frill')) {
      expect(hemAllowed(h, 'machine')).toBe(true);
      expect(hemAllowed(h, 'hand')).toBe(true);
    }
  });

  it('a shallow hem reopens the last blocked crop raglans (the guard reads the real hem depth)', () => {
    // After the length-cover allowance the only crop that still blocks is a small child's
    // raglan at a coarse gauge; a shallower band (half-depth moss/garter, or no hem) frees
    // the rows and reopens it.
    for (const chest of [22, 26]) {
      const s = findSize('Child', chest, 'in')!;
      expect(bodyLengthAllowed(s, 'moderate', G3, 'raglan', 'crop', 'ribbing')).toBe(false);
      expect(bodyLengthAllowed(s, 'moderate', G3, 'raglan', 'crop', 'moss_band')).toBe(true);
      expect(bodyLengthAllowed(s, 'moderate', G3, 'raglan', 'crop', 'none')).toBe(true);
    }
  });
});

describe('prose renders every hem in both voices', () => {
  const textFor = (h: HemStyle, technique: 'machine' | 'hand'): string => {
    const g = assembleGarment(W36, 'moderate', G, 'round', 'set_in', 'scoop', { hem: h });
    return patternText(
      renderPattern(g, { style: 'verbose', technique, gauge: G, units: 'in' }),
    );
  };

  it('machine: each style speaks its own band, change row included', () => {
    expect(textFor('moss_band', 'machine')).toContain('Work in moss stitch until the row counter reads');
    expect(textFor('moss_band', 'machine')).toContain('Reset the row counter to 000, change to stocking stitch');
    expect(textFor('garter_band', 'machine')).toContain('Work in garter stitch until the row counter reads');
    const folded = textFor('folded_band', 'machine');
    expect(folded).toContain('Knit the facing until the row counter reads');
    expect(folded).toContain('fold line');
    expect(folded).toContain('Pick the cast-on edge up onto the needles');
    expect(textFor('none', 'machine')).toContain('There is no hem band');
  });

  it('hand: the frill gathers and the folded band closes', () => {
    const frill = textFor('frill', 'hand');
    expect(frill).toContain('Knit 2 together all the way across the row');
    const folded = textFor('folded_band', 'hand');
    expect(folded).toContain('fold line');
    expect(folded).toContain('cast-on loop');
  });

  it('the default ribbed garment reads exactly as before', () => {
    const dflt = patternText(renderPattern(assembleGarment(W36, 'moderate', G)));
    const explicit = patternText(
      renderPattern(assembleGarment(W36, 'moderate', G, 'round', 'set_in', 'scoop', { hem: 'ribbing' })),
    );
    expect(explicit).toBe(dflt);
  });
});

describe('schematic takes the hems in stride', () => {
  it('labels the band by style and keeps the frill inside the body width', () => {
    for (const h of HEMS) {
      const plan = backPlan(W36, 'moderate', G, 'set_in', 'scoop', { hem: h });
      const rows = backRows(W36, 'moderate', G, 'set_in', 'scoop', { hem: h });
      const s = backSchematic(rows, plan, G);
      const svg = schematicSvg(s);
      expect(svg).toContain('<svg');
      // The outline never exceeds the body width — a frill's doubled cast-on is a
      // gather, not a silhouette (drawn clamped, as the source's schematics did).
      for (const p of s.outline) expect(Math.abs(p.x)).toBeLessThanOrEqual(plan.bodySts / 2 + 0.001);
      if (h === 'folded_band') expect(s.heightRows).toBe(plan.pieceTotalRows);
    }
    const sp = sleevePlan(W36, 'moderate', G, 'set_in', { hem: 'moss_band' });
    const slv = sleeveSchematic(
      sleeveRows('sleeve_l', W36, 'moderate', G, 'set_in', { hem: 'moss_band' }),
      sp,
      G,
    );
    expect(slv.hemLabel).toBe('moss');
  });

  it('rows stay carriage-consistent for every hem', () => {
    for (const h of HEMS)
      for (const rows of [
        backRows(W36, 'moderate', G, 'set_in', 'scoop', { hem: h }),
        frontRows(W36, 'moderate', G, 'round', 'set_in', { hem: h }),
        sleeveRows('sleeve_l', W36, 'moderate', G, 'set_in', { hem: h }),
      ])
        for (const r of rows) expect(r.carriage, `${h} row ${r.index}`).toMatch(/^[LR]$/);
  });
});
