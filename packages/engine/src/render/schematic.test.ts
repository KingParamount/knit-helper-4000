import { describe, it, expect } from 'vitest';
import { findSize } from '../data/sizes';
import { DEFAULT_GAUGE } from '../gauge';
import { backPlan, backRows } from '../pieces/back';
import { backSchematic, schematicSvg } from './schematic';

const W36 = findSize('Woman', 36, 'in')!;
const plan = backPlan(W36, 'moderate', DEFAULT_GAUGE);
const rows = backRows(W36, 'moderate', DEFAULT_GAUGE);
const s = backSchematic(rows, plan, DEFAULT_GAUGE);

describe('back schematic outline', () => {
  it('spans the body width and full length in stitch/row units', () => {
    expect(s.widthSts).toBe(146);
    expect(s.heightRows).toBe(230);
    expect(Math.max(...s.outline.map((p) => Math.abs(p.x)))).toBe(73); // half the body
    expect(Math.max(...s.outline.map((p) => p.y))).toBe(230);
    expect(s.outline.length).toBeGreaterThan(6);
  });

  it('reports the key measures from the plan', () => {
    const w = (label: string) => s.measures.find((m) => m.label === label);
    expect(w('width')?.sts).toBe(146);
    expect(w('back neck')?.sts).toBe(46);
    expect(w('armhole')?.rows).toBe(85); // 8.5in armhole depth
    expect(w('length')?.rows).toBe(230);
  });
});

describe('schematicSvg', () => {
  it('emits a self-contained svg in both scales', () => {
    const stitch = schematicSvg(s, { scale: 'stitch', grid: true });
    const measured = schematicSvg(s, { scale: 'measured', grid: false });
    for (const svg of [stitch, measured]) {
      expect(svg.startsWith('<svg')).toBe(true);
      expect(svg.trimEnd().endsWith('</svg>')).toBe(true);
      expect(svg).toContain('<path');
    }
    expect(stitch).toContain('sts'); // stitch labels
    expect(measured).toMatch(/\d+\.\dcm/); // measured labels in cm
    expect(measured).toContain('10 cm'); // print calibration ruler
  });
});

import { frontRows, frontNeckPlan } from '../pieces/front';
import { sleevePlan, sleeveRows } from '../pieces/sleeve';
import { neckbandPlan, neckbandRows } from '../pieces/neckband';
import { frontSchematic, sleeveSchematic, neckbandSchematic } from './schematic';

describe('front / sleeve / neckband schematics', () => {
  it('front: same body width, garment-height top, scooped neck', () => {
    const f = frontSchematic(
      frontRows(W36, 'moderate', DEFAULT_GAUGE),
      plan,
      frontNeckPlan(W36, 'moderate', DEFAULT_GAUGE),
      DEFAULT_GAUGE,
    );
    expect(f.widthSts).toBe(146);
    expect(f.heightRows).toBe(230); // from the plan, not the two halves' running index
    expect(f.measures.find((m) => m.label === 'neck depth')?.rows).toBeGreaterThan(20);
    expect(Math.max(...f.outline.map((p) => Math.abs(p.x)))).toBe(73);
  });

  it('sleeve: widens from cuff to the upper arm, then a cap', () => {
    const sp = sleevePlan(W36, 'moderate', DEFAULT_GAUGE);
    const s = sleeveSchematic(sleeveRows('sleeve_l', W36, 'moderate', DEFAULT_GAUGE), sp, DEFAULT_GAUGE);
    expect(s.widthSts).toBe(94); // widest at the underarm (top pinned to the armhole)
    expect(s.measures.find((m) => m.label === 'cuff')?.sts).toBe(52);
    expect(s.measures.find((m) => m.label === 'upper arm')?.sts).toBe(94);
  });

  it('neckband: a plain rib strip', () => {
    const np = neckbandPlan(W36, 'moderate', DEFAULT_GAUGE);
    const n = neckbandSchematic(neckbandRows(W36, 'moderate', DEFAULT_GAUGE), np, DEFAULT_GAUGE);
    expect(n.widthSts).toBe(143); // the whole scooped neck pick-up
    expect(n.outline).toHaveLength(4);
    expect(n.marks).toHaveLength(0); // no shaping on a crew band
  });

  it('neckband: a V band draws its two mitred ends, not a flat rectangle', () => {
    const np = neckbandPlan(W36, 'moderate', DEFAULT_GAUGE, 'v');
    const n = neckbandSchematic(
      neckbandRows(W36, 'moderate', DEFAULT_GAUGE, 'v'),
      np,
      DEFAULT_GAUGE,
    );
    expect(np.mitreRows).toBeGreaterThan(0); // the fixture must actually mitre
    expect(n.widthSts).toBe(np.pickupTotal);
    // The cast-on edge is the full width; the live edge is narrower by the mitres.
    const atCastOn = Math.max(...n.outline.filter((p) => p.y === 0).map((p) => p.x));
    const atTop = Math.max(...n.outline.filter((p) => p.y === n.heightRows).map((p) => p.x));
    expect(atCastOn).toBe(np.pickupTotal / 2);
    expect(atTop).toBe(np.finalSts / 2);
    expect(atTop).toBeLessThan(atCastOn);
    // The taper is done by the top of the mitre and runs straight above it.
    const atMitreTop = Math.max(...n.outline.filter((p) => p.y === np.mitreRows).map((p) => p.x));
    expect(atMitreTop).toBe(np.finalSts / 2);
    // One decrease glyph at each end on every mitre row.
    expect(n.marks.filter((m) => m.kind === 'dec')).toHaveLength(2 * np.mitreRows);
    expect(n.measures.find((m) => m.label === 'take off')?.sts).toBe(np.finalSts);
    expect(n.measures.find((m) => m.label === 'mitre')?.rows).toBe(np.mitreRows);
  });
});

describe('drop-shoulder schematics label for what the piece actually is', () => {
  const G = DEFAULT_GAUGE;

  it('sleeve: a straight "sleeve top", no set-in crown or cap', () => {
    const sp = sleevePlan(W36, 'moderate', G, 'drop');
    const s = sleeveSchematic(sleeveRows('sleeve_l', W36, 'moderate', G, 'drop'), sp, G);
    expect(s.measures.find((m) => m.label === 'sleeve top')?.sts).toBe(sp.sleeveTopSts);
    expect(s.measures.find((m) => m.label === 'crown')).toBeUndefined();
    expect(s.measures.find((m) => m.label === 'cap')).toBeUndefined();
    expect(s.measures.find((m) => m.label === 'to underarm')).toBeUndefined();
  });

  it('back: armhole depth comes from the plan, not the whole straight side', () => {
    const bp = backPlan(W36, 'moderate', G, 'drop');
    const s = backSchematic(backRows(W36, 'moderate', G, 'drop'), bp, G);
    const armhole = s.measures.find((m) => m.label === 'armhole');
    expect(armhole?.rows).toBe(bp.armholeRows); // the sleeve-join depth, not the length
    expect(armhole!.from).toBeGreaterThan(0); // sits at the top, not from the hem
    expect(armhole!.rows).toBeLessThan(bp.totalRows);
  });

  it('set-in pieces keep the crown/cap vocabulary', () => {
    const sp = sleevePlan(W36, 'moderate', G, 'set_in');
    const s = sleeveSchematic(sleeveRows('sleeve_l', W36, 'moderate', G, 'set_in'), sp, G);
    expect(s.measures.find((m) => m.label === 'crown')).toBeDefined();
    expect(s.measures.find((m) => m.label === 'cap')).toBeDefined();
  });
});
