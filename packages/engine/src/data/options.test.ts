import { describe, it, expect } from 'vitest';
import { optionList, optionIds, easeStyles, easeBase } from './options';

describe('option vocabulary', () => {
  it('reads a plain-array field', () => {
    const shoulders = optionIds('shoulder');
    expect(shoulders).toContain('set_in');
    expect(shoulders).toContain('raglan');
    expect(shoulders).toHaveLength(7);
  });

  it('unwraps a field whose entries live under `values` (hem/method)', () => {
    expect(optionIds('method')).toEqual(['hand', 'machine', 'crochet']);
    expect(optionIds('hem')).toContain('ribbing');
  });

  it('returns an empty list for an unknown field', () => {
    expect(optionList('not_a_field')).toEqual([]);
  });

  it('exposes the five ease styles with bases', () => {
    expect(easeStyles.map((e) => e.id)).toEqual([
      'skintight',
      'tight',
      'moderate',
      'comfortable',
      'oversized',
    ]);
  });

  it('resolves the moderate ease base to the settled 1.71', () => {
    expect(easeBase('moderate')).toBe(1.71);
    expect(easeBase('skintight')).toBe(-0.75);
    // Skintight is exactly negated Tight (see ease_model.md)
    expect(easeBase('skintight')).toBe(-easeBase('tight'));
  });

  it('throws on an unknown ease style', () => {
    // @ts-expect-error deliberately invalid id
    expect(() => easeBase('roomy')).toThrow();
  });
});
