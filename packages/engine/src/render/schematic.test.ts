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
    expect(s.widthSts).toBe(144);
    expect(s.heightRows).toBe(246);
    expect(Math.max(...s.outline.map((p) => Math.abs(p.x)))).toBe(72); // half the body
    expect(Math.max(...s.outline.map((p) => p.y))).toBe(246);
    expect(s.outline.length).toBeGreaterThan(6);
  });

  it('reports the key measures from the plan', () => {
    const w = (label: string) => s.measures.find((m) => m.label === label);
    expect(w('width')?.sts).toBe(144);
    expect(w('back neck')?.sts).toBe(46);
    expect(w('armhole')?.rows).toBe(85); // 8.5in armhole depth
    expect(w('length')?.rows).toBe(246);
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
