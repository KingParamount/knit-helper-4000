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
  /**
   * Babies are sized by weight, not chest — Knitware's own axis for the category.
   * Native units per row: pounds on the `in` rows, kilograms on the `cm` rows (as
   * `chest` is). Absent for every other category, which is sized by chest.
   */
  weight?: number;
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

/**
 * Front neck style. Uses the `neckline_front` option vocabulary ('round' = crew),
 * so the constraint validator and option list line up. Distinct from EaseStyleId.
 */
export type NeckStyle = 'round' | 'v';

/**
 * Back neck style, from the `neckline_back` option vocabulary. 'scoop' is a shallow
 * curved drop (our default — it opens the crew enough to pass the head, solved per
 * size in neckopening.ts); 'flat' casts the whole back neck off straight across (no
 * scoop), which is Knitware's default crew back. A flat back is snugger over the head,
 * so it is only offered where the head still clears (see fit.ts). The front is 'round'
 * or 'v' (NeckStyle); the back never takes a V.
 */
export type BackNeckStyle = 'scoop' | 'flat';

/**
 * Shoulder / sleeve-join style. 'set_in' has a shaped armhole and a fitted cap;
 * 'drop' knits the body straight (no armhole shaping) and the sleeve to a straight
 * wide top (no cap) that sews to the armhole edge. Distinct from EaseStyleId.
 */
export type ShoulderStyle = 'set_in' | 'drop';

/**
 * How the garment is made. Matches the `method` option vocabulary in options.json,
 * which has carried hand/machine/crochet since the data was recovered — this is the
 * code finally using that axis.
 *
 * This is NOT a prose register (see ProseStyle, which is verbose vs abbreviated and
 * is orthogonal to it). Technique changes the CONSTRUCTION as well as the wording:
 * a machine takes pieces off on waste yarn and sews a separate neckband on, because
 * picking a curved neck up onto the needles is awkward on a machine; a hand knitter
 * holds stitches on a holder and picks the band up directly. Several machine idioms
 * — the row counter, carriage side, tension MT−2, holding position — have no hand
 * equivalent at all.
 *
 * 'crochet' is deliberately absent: it is a different craft, and whether it fits this
 * row array at all is an open question, not a foregone one.
 */
export type Technique = 'machine' | 'hand';
