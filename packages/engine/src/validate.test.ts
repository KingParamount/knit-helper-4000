import { describe, it, expect } from 'vitest';
import { validate, type Selection } from './validate';

/** The Phase-1 target garment — should validate clean. */
const target: Selection = {
  construction: 'flat_bottom_up',
  body_style: 'pullover',
  body_shape: 'straight',
  shoulder: 'set_in',
  sleeve_length: 'full',
  sleeve_style: 'moderate_taper',
  neckline_front: 'round',
  neckline_back: 'flat',
  collar: 'single_band',
  method_body: 'hand',
  method_rib: 'hand',
};

describe('constraint validator', () => {
  it('passes a valid garment with no errors or warnings', () => {
    const r = validate(target);
    expect(r.ok).toBe(true);
    expect(r.errors).toEqual([]);
    expect(r.warnings).toEqual([]);
  });

  it('is safe on empty and partial selections', () => {
    expect(validate({}).ok).toBe(true);
    expect(validate({ shoulder: 'raglan' }).ok).toBe(true);
  });

  it('fires a forbid: raglan + cap sleeve', () => {
    const r = validate({ shoulder: 'raglan', sleeve_length: 'cap' });
    expect(r.ok).toBe(false);
    expect(r.errors.map((e) => e.id)).toContain('RAGLAN_NO_CAP');
  });

  it('surfaces the verbatim message for a fired rule', () => {
    const r = validate({ shoulder: 'raglan', sleeve_length: 'cap' });
    const v = r.errors.find((e) => e.id === 'RAGLAN_NO_CAP')!;
    expect(v.message).toMatch(/cannot have cap sleeve with raglan/i);
  });

  it('treats BOAT_OVERLAP_WARNING as a non-blocking warning', () => {
    const r = validate({ boat_variant: 'overlapped', shoulder: 'drop' });
    expect(r.warnings.map((w) => w.id)).toContain('BOAT_OVERLAP_WARNING');
    expect(r.ok).toBe(true); // warning must not block
  });

  it('applies the tightened CIRCULAR_RAGLAN_NO_BACK_NECK (shallow now forbidden)', () => {
    const base = { construction: 'circular_bottom_up', shoulder: 'raglan' };
    expect(validate({ ...base, neckline_back: 'shallow' }).errors.map((e) => e.id)).toContain(
      'CIRCULAR_RAGLAN_NO_BACK_NECK',
    );
    expect(validate({ ...base, neckline_back: 'flat' }).ok).toBe(true);
  });

  it('applies the corrected SHIRT_COLLAR_NECK_LIMITS (front square, back v)', () => {
    expect(
      validate({ collar: 'shirt_split', neckline_front: 'square' }).errors.map((e) => e.id),
    ).toContain('SHIRT_COLLAR_NECK_LIMITS');
    expect(
      validate({ collar: 'shirt_split', neckline_back: 'v' }).errors.map((e) => e.id),
    ).toContain('SHIRT_COLLAR_NECK_LIMITS');
    expect(
      validate({ collar: 'shirt_split', neckline_front: 'round', neckline_back: 'round' }).ok,
    ).toBe(true);
  });

  it('enforces a require, including its symmetric direction (boat must match)', () => {
    expect(validate({ neckline_front: 'boat', neckline_back: 'round' }).ok).toBe(false);
    expect(validate({ neckline_back: 'boat', neckline_front: 'round' }).ok).toBe(false);
    // matching both is fine (collar left unset so BOAT_COLLAR_LIMIT stays quiet)
    expect(validate({ neckline_front: 'boat', neckline_back: 'boat' }).ok).toBe(true);
  });

  it('fires the sourced warning BACKLESS_REQUIRES_RAGLAN_OR_SETIN', () => {
    // sleeve_length omitted on purpose: backless forces sleeveless, and every
    // sleeveless-capable non-raglan/set-in shoulder is separately forbidden, so
    // the warning only stands alone on a partial selection.
    const r = validate({ neckline_back: 'backless', shoulder: 'modified_drop' });
    const w = r.warnings.find((x) => x.id === 'BACKLESS_REQUIRES_RAGLAN_OR_SETIN');
    expect(w).toBeDefined();
    expect(w!.source).toBe('manual');
    expect(w!.sourceRef).toContain('manual.txt');
    expect(r.ok).toBe(true); // it's a warning, not an error
    // set-in is allowed -> no such warning
    expect(
      validate({ neckline_back: 'backless', shoulder: 'set_in' }).warnings.map((x) => x.id),
    ).not.toContain('BACKLESS_REQUIRES_RAGLAN_OR_SETIN');
  });
});
