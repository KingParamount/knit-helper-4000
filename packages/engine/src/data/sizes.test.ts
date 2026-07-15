import { describe, it, expect } from 'vitest';
import { sizes, findSize, availableChests } from './sizes';

describe('size table', () => {
  it('loads all 70 rows (35 sizes × 2 unit systems)', () => {
    expect(sizes).toHaveLength(70);
    expect(sizes.filter((s) => s.units === 'in')).toHaveLength(35);
    expect(sizes.filter((s) => s.units === 'cm')).toHaveLength(35);
  });

  it('finds Woman 36" and reports its ease + arm figures', () => {
    const w36 = findSize('Woman', 36, 'in');
    expect(w36).toBeDefined();
    expect(w36!.ease_factor).toBe(1.37);
    expect(w36!.arm_depth).toBe(7.5);
    // ease_arml is sleeve-length ease, not armhole ease (see ease_model.md)
    expect(w36!.ease_arml).toBe(1.5);
  });

  it('treats the cm rows as an independently rounded dataset, not conversions', () => {
    const baby18in = findSize('Baby', 18, 'in');
    const baby46cm = findSize('Baby', 46, 'cm');
    expect(baby18in).toBeDefined();
    expect(baby46cm).toBeDefined();
    // 18in would convert to 45.72cm, but the row is stored as a friendly 46cm
    expect(baby46cm!.chest).toBe(46);
    expect(18 * 2.54).toBeCloseTo(45.72, 2);
  });

  it('returns undefined for a size that is not in the table', () => {
    expect(findSize('Woman', 37, 'in')).toBeUndefined();
  });

  it('lists available chests ascending', () => {
    const chests = availableChests('Woman', 'in');
    expect(chests[0]).toBe(30);
    expect(chests).toEqual([...chests].sort((a, b) => a - b));
    expect(chests).toContain(36);
  });
});
