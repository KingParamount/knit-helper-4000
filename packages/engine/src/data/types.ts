/** Shared data types for the reference tables in `data/`. */

export type Units = 'in' | 'cm';
export type Category = 'Baby' | 'Child' | 'Woman' | 'Man';

/**
 * One row of `data/sizes_canonical.json`. Every size appears twice — once in
 * inches, once in centimetres — and the two are independently rounded, so they
 * are distinct rows, not conversions (see `data/ease_model.md`).
 *
 * Absent measurements are stored as 0 (e.g. `abdomen` for many rows, or the
 * baby rows that lack `neck`/`armhole`/`crotch`/`leg_length`/`thigh`).
 */
export interface SizeRecord {
  size_id: number;
  category: Category;
  age: string;
  units: Units;
  chest: number;
  waist: number;
  abdomen: number;
  hip: number;
  height: number;
  neck_to_waist: number;
  waist_to_hip: number;
  waist_to_knee: number;
  waist_to_ankle: number;
  wingspan: number;
  back_width: number;
  back_neck: number;
  neck: number;
  neck_depth: number;
  arm_length: number;
  arm_depth: number;
  upper_arm: number;
  wrist: number;
  armhole: number;
  head_circ: number;
  crotch: number;
  leg_length: number;
  thigh: number;
  skirt_hem: number;
  rib_body: number;
  rib_neck: number;
  ease_factor: number;
  ease_arml: number;
}

/** An entry in one of the option lists in `data/options.json`. */
export interface Option {
  id: string;
  label: string;
  note?: string;
  default?: boolean;
}

/** The `ease` list carries a per-style multiplicative `base` (see `ease_model.md`). */
export interface EaseOption extends Option {
  base: number;
}

export type EaseStyleId =
  | 'skintight'
  | 'tight'
  | 'moderate'
  | 'comfortable'
  | 'oversized';
