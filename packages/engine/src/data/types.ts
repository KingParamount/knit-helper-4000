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
 * Front neck style, from the `neckline_front` option vocabulary ('round' = crew), so the
 * constraint validator and option list line up. 'round' is a shallow crew scoop; 'scoop'
 * is deeper and wider (its centre cast-off is smaller, the side curve longer); 'v' splits
 * low to a point; 'flat' works straight to the shoulder and casts the neck off straight
 * across (Front Neck Depth 0 — Knitware's flat front, the same shape as a flat back).
 *
 * 'square', 'high_round' and 'boat' are SCAFFOLDED (2026-07-24) but not yet calibrated:
 * the type is widened and the UI wired, but their geometry currently falls through to the
 * crew branch as a placeholder. Real shaping (depths, side curves, boat width) lands once
 * the neckline harvest is read — search TODO(neckline-harvest). 'square' = a full-width
 * cast-off base with vertical sides at a real depth; 'high_round' = a shallower crew;
 * 'boat' = a wide, shallow neck (needs a neck-width/shoulder-graft decision).
 */
export type NeckStyle = 'round' | 'v' | 'scoop' | 'flat' | 'square' | 'high_round' | 'boat';

/**
 * Back neck style, from the `neckline_back` option vocabulary. 'scoop' is a shallow
 * curved drop (our default — it opens the crew enough to pass the head, solved per
 * size in neckopening.ts); 'flat' casts the whole back neck off straight across (no
 * scoop), which is Knitware's default crew back. A flat back is snugger over the head,
 * so it is only offered where the head still clears (see fit.ts). The front is 'round'
 * or 'v' (NeckStyle); the back never takes a V.
 *
 * 'square', 'high_round' and 'boat' are SCAFFOLDED (2026-07-24), matching the front: the
 * type is widened and the UI wired, but the back shaping falls through to the scoop
 * solve as a placeholder until the neckline harvest is read — TODO(neckline-harvest).
 */
export type BackNeckStyle = 'scoop' | 'flat' | 'square' | 'high_round' | 'boat';

/**
 * Shoulder / sleeve-join style. 'set_in' has a shaped armhole and a fitted cap;
 * 'drop' knits the body straight (no armhole shaping) and the sleeve to a straight
 * wide top (no cap) that sews to the armhole edge. Distinct from EaseStyleId.
 *
 * 'saddle' shares the set-in armhole, but the shoulders are CAST OFF (not short-rowed and
 * held) and the sleeve cap continues into a straight strap that spans each shoulder to the
 * neck; the strap seams to the front and back shoulders and its end joins the neckline. A
 * cast-off (or waste-yarn) edge can seam to the strap's row edge; a live-held shoulder
 * cannot, which is why saddle drops the hold/3-needle join (King, 2026-07-22).
 *
 * 'raglan' has no separate shoulder or cap: the body armhole and the sleeve top both
 * decrease steadily from the underarm to the neck over the SAME number of rows, so the
 * four raglan seams match row-for-row. Shoulders are cast off (there are none to hold),
 * and the sleeve tops join the neckline. Also cast-off-and-sew.
 */
export type ShoulderStyle = 'set_in' | 'drop' | 'saddle' | 'raglan';

/**
 * Where the body ends, from the `body_length` option vocabulary. Each value is a body
 * landmark, not a fixed inch: the engine resolves it against the size's own length
 * ladder (neck_to_waist / waist_to_hip / waist_to_knee / waist_to_ankle), so "knee"
 * is that size's knee. 'hip' is the default and reproduces the original garment.
 */
export type BodyLength =
  | 'crop'
  | 'waist'
  | 'regular'
  | 'hip'
  | 'thigh'
  | 'above_knee'
  | 'knee'
  | 'calf'
  | 'ankle';

/**
 * Hem style for the body and cuffs, from the `hem` option vocabulary (one choice
 * covers both, as the source vocabulary applies it to both). 'ribbing' is the
 * default and reproduces the original garment: an odd cast-on at rib tension that
 * pulls in. Every other hem is worked at the full panel width (the source's own
 * rule: a non-rib hem must equal the garment bottom width):
 *  - 'moss_band' / 'garter_band' — a flat textured band, half the ribbing depth;
 *  - 'folded_band'  — a stocking hem knit to twice its finished depth at tighter
 *    tension, turned at a fold row, and closed by knitting the cast-on edge
 *    together with the working row;
 *  - 'frill'        — cast on double, work a short ruffle, then halve across into
 *    the body. Hand knitting only for now: a machine bed is too narrow for the
 *    doubled cast-on at most sizes (blocked in the UI; a future machine feature);
 *  - 'none'         — cast on and go; the stocking edge rolls, and the prose says so.
 * 'crochet_edge' is deliberately absent (no crochet — see Technique).
 */
export type HemStyle = 'ribbing' | 'moss_band' | 'garter_band' | 'folded_band' | 'frill' | 'none';

/**
 * Sleeve length, from the `sleeve_length` option vocabulary. full / three_quarter /
 * half / short are fractions of the full underarm-to-wrist length (arm_length +
 * ease_arml): the sleeve is the full sleeve's taper TRUNCATED — the hem width sits on
 * the same straight line from the sleeve top to the wrist, so a shorter sleeve casts
 * on wider and increases less, and 'full' reproduces the original garment exactly.
 *
 * 'cap' is a very short set-in sleeve: almost no sleeve below the armhole, just the
 * cap that caps the shoulder. It casts on near the upper-arm width and the usual cap
 * bell fills the armhole — a modern cap, not Knitware's picked-up armhole edging.
 *
 * 'sleeveless' is no sleeve at all: the armhole is finished with a picked-up band and
 * the body armhole is cut deeper and narrower so it sits against the body. It needs a
 * set-in or drop shoulder — a raglan or saddle IS its sleeve (see the constraints).
 */
export type SleeveLength = 'full' | 'three_quarter' | 'half' | 'short' | 'cap' | 'sleeveless';

/**
 * Sleeve SHAPE, from the `sleeve_style` vocabulary — the silhouette below the cap. The
 * sleeve TOP is pinned to the armhole (it carries the fit ease and the cap sews to it), so
 * every shape but 'narrow_taper' keeps the same top and cap; the shape only changes the
 * cuff and the run up to the top. Calibrated to the 2026-07-24 Knitware harvest:
 *  - 'moderate_taper' — the default: a wrist cuff tapering up to the sleeve top.
 *  - 'narrow_taper'   — a slimmer sleeve: the top is narrowed (~0.91×), so less bicep ease;
 *    the cap re-fits the same armhole.
 *  - 'lantern'        — straight: a wrist rib, then increase across in one row to the sleeve
 *    top and knit straight (a column gathered into the cuff).
 *  - 'modified_lantern' — a near-straight sleeve: a wrist rib, a smaller across-increase, then
 *    a gentle taper up to the top.
 *  - 'bishop'         — full and bloused: a wrist rib, a big across-increase to a blouse wider
 *    than the top (~+3"), then a decrease up to the top. The cuff gathers the fullness in.
 *  - 'bell'           — flared: a WIDE ribbed cuff (~1.4× the top), decreasing up to the top.
 *    No gather — the wide part is the open cuff itself. Full/¾ length only (as bishop).
 * 'dolman' is deliberately absent — a batwing is a different construction (cut in with the
 * body, no set-in armhole), a separate future feature, not a variation on the sleeve piece.
 */
export type SleeveStyle =
  | 'moderate_taper'
  | 'narrow_taper'
  | 'lantern'
  | 'modified_lantern'
  | 'bishop'
  | 'bell';

/**
 * The optional style axes added after the original five positional parameters
 * (ease, neck, back neck, shoulder, technique). Passed as one trailing bag so each
 * new axis does not grow every signature; every field has a default that reproduces
 * the original garment (hip length, ribbed hem). Later batches add sleeve length here.
 */
export interface GarmentOptions {
  bodyLength?: BodyLength;
  hem?: HemStyle;
  sleeveLength?: SleeveLength;
  sleeveStyle?: SleeveStyle;
}

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
