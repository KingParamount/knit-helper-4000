/**
 * The sleeve (set-in, bottom-up: cuff → rib → taper → cap). Both sleeves are
 * identical for a plain garment, so `sleeveRows` takes the piece id.
 *
 * The taper increases evenly from the cuff to the sleeve top. The cap casts off the
 * underarm to match the body, then a bell-shaped decrease (fast every-row zones at
 * the bottom and top, magic-formula even middle) up to a narrow crown (≈ CROWN_FRACTION
 * of the sleeve top). The cap *height* fills the armhole it sews into: a set-in cap is
 * sewn to the armhole selvedge ROW-FOR-ROW, so it must be nearly as many rows tall as
 * the armhole is deep (CAP_FILL) — see sleevePlan.
 */

import type {
  SizeRecord,
  EaseStyleId,
  ShoulderStyle,
  HemStyle,
  SleeveLength,
  SleeveStyle,
  GarmentOptions,
} from '../data/types';
import { garmentWidths } from '../dimensions';
import { type Gauge, evenStitchesFor, rowsFor } from '../gauge';
import { type Row, type Piece, carriageForRow } from '../row';
import { backPlan, armholeShaping } from './back';
import { raglanPlan } from './raglan';
import { SEAM_ALLOWANCE_STS } from './seams';
import { hemPlan } from './hem';

/** Cuff = wrist + this ease. ASSUMPTION (flag) — a ribbed cuff also stretches. */
export const CUFF_EASE_IN = 1.0;

/**
 * Each sleeve length as a fraction of the full underarm length. Anchored to where
 * the hems land on the arm (arm_length is underarm-to-wrist): three-quarter ends
 * mid-forearm, half at the elbow (roughly halfway down), short a hand's width or so
 * below the underarm — the standard tee proportion.
 */
export const SLEEVE_LENGTH_FRACTION: Record<SleeveLength, number> = {
  full: 1,
  three_quarter: 0.75,
  half: 0.5,
  // 0.3, not a strict quarter: the harvested Knitware short ran ~0.3 of the arm (5.0" on a
  // Woman 36's 16.8" arm; 0.25× undershoots at 4.2"). As a fraction it scales down cleanly
  // for children/babies rather than a fixed floor swallowing a small arm. Half & ¾ matched
  // Knitware exactly — left as they are.
  short: 0.3,
  // A cap is almost all cap: a sliver of straight sleeve below the armhole, then the
  // bell. Its taper is floored (MIN_CAP_TAPER_ROWS) so the cuff is a real band, not a
  // rounding artefact.
  cap: 0.1,
  // Sleeveless has no sleeve piece; the value is never read (the generators skip the
  // sleeve for it), but the Record type demands an entry.
  sleeveless: 0,
};

/** A cap keeps at least this many straight rows below the bell, so the cuff is knittable. */
export const MIN_CAP_TAPER_ROWS = 4;

/**
 * A sleeve hem never takes more than this fraction of the sleeve's length — a full
 * sleeve keeps the size's rib depth (unchanged), but a short sleeve at that depth
 * would be over half hem, so the band shallows with the sleeve (short-sleeve bands
 * run ~1–1.5" in ordinary practice).
 */
const MAX_HEM_FRACTION = 0.3;

/**
 * A saddle strap's width (inches), scaling gently with size — Knitware's "Shldr Band
 * Width" runs ~1.5" (baby) to ~3.0" (large adult). The strap is the flat band the sleeve
 * cap narrows to and then works straight across the shoulder to the neck.
 */
export function saddleStrapWidthIn(size: SizeRecord): number {
  return Math.min(3.0, Math.max(1.5, size.chest * 0.05 + 0.6));
}

/**
 * A saddle strap's length in rows. The strap runs along the shoulder seam it sews to, so
 * its length is the shoulder WIDTH expressed in rows (stitches × row/stitch gauge). Verified
 * against Knitware at 20×26 (Baby shoulder 11 → 14 rows, Child 19 → 24, Man ~29 → 36).
 */
export function saddleStrapRows(shoulderSts: number, gauge: Gauge): number {
  return Math.round((shoulderSts * gauge.bodyRow) / gauge.bodySt);
}

/** `count` increase rows spread as evenly as possible across `span` rows (interior). */
export function evenRows(count: number, span: number): number[] {
  const out: number[] = [];
  for (let i = 1; i <= count; i++) out.push(Math.round((i * span) / (count + 1)));
  return out;
}

/**
 * Cap fill: the cap height as a fraction of the armhole depth. A set-in cap is sewn
 * to the armhole selvedge ROW-FOR-ROW — each cap row-end to one armhole row-end — so
 * the two edges match by row COUNT, not by tape-length. (Tape-length is a trap: the
 * cap edge is a diagonal staircase whose tape runs far longer than its height, so a
 * short, flat cap can fake a tape-match to a tall vertical armhole. That is exactly
 * how the old "ease the perimeter +5%" rule produced caps only ~0.55× the armhole.)
 * Real men's set-in caps fill ~0.79–0.89 of the armhole depth (Berroco Anthony); we
 * fill this fraction, floored so the decreases fit and capped at the armhole depth.
 */
const CAP_FILL = 0.86;
/**
 * Crown width as a fraction of the sleeve top: the flat top the cap binds off. A set-in
 * cap keeps a broad flat crown that sits along the top of the armhole; too narrow a crown
 * and the sleeve pulls to a peak at the shoulder instead of lying flat. Calibrated to
 * Knitware's ground truth, whose crown is a steady ~0.28 of the sleeve top across the whole
 * size range (baby ~9 → large adult ~25 sts; 26–33% measured). This supersedes an earlier
 * 0.14 taken from one modern pattern (Berroco Anthony) that made adult caps spike to a
 * ~2" point. Floored at MIN_CROWN_IN so a small sleeve's cap does not taper to a spike.
 */
const CROWN_FRACTION = 0.28;
const MIN_CROWN_IN = 1.5;
/** Decreases worked every row at each end of the cap (the fast bell ends). */
const CAP_FAST_EACH_END = 3;

// --- Sleeve-shape constants (below the cap; calibrated to the 2026-07-24 harvest) --------
/** narrow_taper slims the sleeve top to this fraction of the standard (less bicep ease). */
const NARROW_TOP_FACTOR = 0.91;
/** bell casts on a wide ribbed cuff this many times the sleeve top, decreasing up (matched
 *  Knitware at 1.40 for both Woman 36 and Woman 50). */
const BELL_CUFF_FACTOR = 1.4;
/** modified_lantern blooms to this fraction of the top just above the cuff, then gently tapers up. */
const MODIFIED_BLOOM_FACTOR = 0.89;
/** bishop blouses this many inches WIDER than the sleeve top, then decreases up to the top.
 *  The harvest showed ~+3" over the (eased) top, near-constant across ease. */
const BISHOP_BLOOM_IN = 3.0;

export interface SleevePlan {
  hem: HemStyle; // cuff hem style (shared with the body)
  sleeveLength: SleeveLength;
  ribCastOnSts: number; // cuff hem cast-on (odd for rib, 2× for a frill, cuff otherwise)
  bodyCuffSts: number; // even count after the rib drops one on the right
  ribRows: number; // rows in the cuff hem section (whatever the hem style)
  hemDepthIn: number; // resolved cuff hem depth (shallows with the sleeve length)
  taperRows: number;
  incPerSide: number; // legacy: the moderate-taper increase (== max(0, shapePerSide))
  // --- sleeve shape (below the cap) ---
  sleeveStyle: SleeveStyle;
  bloomSts: number; // sleeve body width just above the cuff (after the gather) = "Sleeve Bottom"
  gatherSts: number; // even increase-across from the cuff to the bloom (0 unless gathered)
  shapePerSide: number; // taper from bloom to top, per side: + increase, − decrease, 0 straight
  sleeveTopSts: number; // achieved at the underarm
  underarmCastOff: number; // matches the body armhole
  capHeightRows: number; // fills ≈ CAP_FILL of the armhole depth
  capDecPerSide: number;
  capTopSts: number; // bound off at the top (the crown; the strap base for a saddle)
  strapRows: number; // saddle only: rows worked straight across the shoulder (0 otherwise)
}

export function sleevePlan(
  size: SizeRecord,
  style: EaseStyleId,
  gauge: Gauge,
  shoulder: ShoulderStyle = 'set_in',
  opts: GarmentOptions = {},
): SleevePlan {
  const w = garmentWidths(size, style, shoulder);
  const body = backPlan(size, style, gauge, shoulder);

  // A shorter sleeve is the full sleeve's taper TRUNCATED: the hem sits on the same
  // straight line from the sleeve top down to the wrist cuff, cut off at the chosen
  // fraction. So a short sleeve casts on wider (nearer the sleeve-top width, which
  // already carries the fit ease) and increases less, and 'full' lands exactly on
  // wrist + CUFF_EASE_IN — the original garment, unchanged.
  const sleeveLength = opts.sleeveLength ?? 'full';
  const sleeveStyle = opts.sleeveStyle ?? 'moderate_taper';
  const frac = SLEEVE_LENGTH_FRACTION[sleeveLength];
  const lengthIn = (size.arm_length + size.ease_arml) * frac;
  const fullCuffIn = size.wrist + CUFF_EASE_IN;
  const wristCuffIn = w.sleeveTop + frac * (fullCuffIn - w.sleeveTop);
  // A bell casts on a WIDE ribbed cuff (~1.4× the sleeve top) and decreases up; every other
  // shape casts on that wrist cuff and shapes above it. The TOP and cap are always derived
  // from the wrist cuff (below), so a bell's wide cuff never drags the sleeve top — and the
  // armhole join it must fit — out with it.
  const hemWidthIn = sleeveStyle === 'bell' ? w.sleeveTop * BELL_CUFF_FACTOR : wristCuffIn;

  // One underarm seam, eating a stitch from each of the sleeve's two edges — cut it
  // wider at both cuff and top so the sewn tube measures what it should.
  const bodyCuffSts = evenStitchesFor(hemWidthIn, gauge) + 2 * SEAM_ALLOWANCE_STS; // even
  const wristCuffSts = evenStitchesFor(wristCuffIn, gauge) + 2 * SEAM_ALLOWANCE_STS; // == bodyCuffSts unless bell
  const hemDepthIn = Math.min(size.rib_body, MAX_HEM_FRACTION * lengthIn);
  const hp = hemPlan(size, gauge, opts.hem ?? 'ribbing', bodyCuffSts, hemDepthIn);
  const ribCastOnSts = hp.castOnSts;
  const ribRows = hp.pieceRows;
  // Sleeve length less the hem's contribution to hanging length (a folded cuff's
  // facing turns up inside). A cap floors the straight run so its tiny sleeve is still
  // knittable below the bell.
  const taperRows = Math.max(
    sleeveLength === 'cap' ? MIN_CAP_TAPER_ROWS : 0,
    rowsFor(lengthIn, gauge) - hp.lengthRows,
  );
  // NB the allowance is deliberately NOT added at the top. The sleeve top is not a
  // free edge — it is sewn into the armhole, and the Tier-A join invariant requires
  // the two to match. Widening it breaks that join (it did: drop-shoulder Child sizes
  // failed, where two stitches is a large fraction of a small armhole). The underarm
  // seam eats fabric along the tube, so the cuff carries the allowance and the top
  // stays pinned to the armhole it has to fit.
  // Measure against the UNROUNDED target. stitchesFor() would round the sleeve top to a
  // whole stitch first, and halving that rounds again — two roundings compounding in the
  // same direction. A Baby 18" at 12 sts/4in wants 22.50 stitches: pre-rounding gives 23,
  // then (23 − 16)/2 = 3.5 rounds up to 4 increases and lands on 24 (8.00"), where the
  // exact target picks 3 and lands on 22 (7.33") — the nearer of the two counts an even
  // total can reach. Invisible at a fine gauge, where half a stitch is a rounding error;
  // a third of an inch on chunky yarn.
  const exactTopSts = (w.sleeveTop * gauge.bodySt) / 4;
  // Clamped at zero: a short sleeve's even-rounded cast-on can land a stitch above
  // the exact top target (two baby sizes at chunky gauge), and a sleeve that
  // "increases minus one" is a nonsense — it just knits straight, top = cast-on. The top
  // is derived from the WRIST cuff (not the actual cast-on) so a bell's wide cuff keeps the
  // moderate top; narrow_taper slims the top itself (~0.91×), for less bicep ease.
  const incPerSide = Math.max(0, Math.round((exactTopSts - wristCuffSts) / 2)); // legacy = moderate taper
  const narrowIncPerSide = Math.max(0, Math.round(((exactTopSts * NARROW_TOP_FACTOR) - wristCuffSts) / 2));
  // narrow_taper slims the top for a set-in sleeve (the cap re-fits the same armhole). A drop
  // top IS the armhole opening and a raglan/saddle top feeds its seam/strap, so the top can't
  // be slimmed there — narrow_taper falls back to the standard top for those.
  const slimTop = sleeveStyle === 'narrow_taper' && shoulder === 'set_in';
  const sleeveTopSts = wristCuffSts + 2 * (slimTop ? narrowIncPerSide : incPerSide); // even

  // The sleeve shape below the cap: a gather (even increase-across from the cuff to a
  // bloom just above it) then a taper (bloom → top). Most shapes have no gather (bloom =
  // cuff) and a plain increase-taper; a bell/bishop DECREASE bloom → top; a lantern is
  // straight (bloom = top, no taper). See the SleeveStyle doc for the per-shape recipe.
  const bloomTargetSts =
    sleeveStyle === 'lantern'
      ? sleeveTopSts
      : sleeveStyle === 'modified_lantern'
        ? evenStitchesFor(w.sleeveTop * MODIFIED_BLOOM_FACTOR, gauge) + 2 * SEAM_ALLOWANCE_STS
        : sleeveStyle === 'bishop'
          ? sleeveTopSts + evenStitchesFor(BISHOP_BLOOM_IN, gauge)
          : bodyCuffSts; // moderate, narrow, bell — no gather
  const gatherSts = Math.max(0, bloomTargetSts - bodyCuffSts);
  const bloomSts = bodyCuffSts + gatherSts; // effective bloom (never below the cuff)
  const shapePerSide = Math.round((sleeveTopSts - bloomSts) / 2); // + increase / − decrease / 0 straight

  // A drop sleeve has no cap: it tapers to the top and binds off straight. The whole
  // top width becomes the sewn edge (capTopSts), the cap-shaping fields are 0.
  if (shoulder === 'drop') {
    return {
      hem: hp.hem,
      sleeveLength,
      hemDepthIn,
      ribCastOnSts,
      bodyCuffSts,
      ribRows,
      taperRows,
      incPerSide,
      sleeveStyle,
      bloomSts,
      gatherSts,
      shapePerSide,
      sleeveTopSts,
      underarmCastOff: 0,
      capHeightRows: 0,
      capDecPerSide: 0,
      capTopSts: sleeveTopSts,
      strapRows: 0,
    };
  }

  // A raglan sleeve has no cap: after the underarm it decreases both edges steadily to a
  // small crown over the SAME rows as the body raglan (raglanPlan.ragRows), so the seams
  // match row-for-row. The crown joins the neckline.
  if (shoulder === 'raglan') {
    const rp = raglanPlan(size, style, gauge);
    const crown = Math.max(2, evenStitchesFor(0.75, gauge));
    const slvUA = sleeveTopSts - 2 * rp.underarmCastOff;
    const capDecPerSide = Math.round((slvUA - crown) / 2);
    return {
      hem: hp.hem,
      sleeveLength,
      hemDepthIn,
      ribCastOnSts,
      bodyCuffSts,
      ribRows,
      taperRows,
      incPerSide,
      sleeveStyle,
      bloomSts,
      gatherSts,
      shapePerSide,
      sleeveTopSts,
      underarmCastOff: rp.underarmCastOff,
      capHeightRows: rp.ragRows, // the raglan span (row-for-row with the body)
      capDecPerSide,
      capTopSts: slvUA - 2 * capDecPerSide, // the small crown, into the neck
      strapRows: 0,
    };
  }

  const underarmCastOff = armholeShaping(body.bodySts, body.upperBackSts).castOffPerSide;
  // A saddle narrows the cap to the STRAP width (not the usual broad crown) and then works
  // the strap straight across the shoulder; a set-in narrows to a broad flat crown that is
  // bound off. The strap length is the shoulder width in rows (it seams to that shoulder).
  const achieved = armholeShaping(body.bodySts, body.upperBackSts).achievedSts;
  const shoulderSts = Math.round((achieved - body.backNeckSts) / 2);
  const strapRows = shoulder === 'saddle' ? saddleStrapRows(shoulderSts, gauge) : 0;
  const capTopTarget =
    shoulder === 'saddle'
      ? evenStitchesFor(saddleStrapWidthIn(size), gauge)
      : evenStitchesFor(Math.max(w.sleeveTop * CROWN_FRACTION, MIN_CROWN_IN), gauge);
  const capDecPerSide = Math.round((sleeveTopSts - 2 * underarmCastOff - capTopTarget) / 2);
  // The crown/strap base is whatever is left after the symmetric shaping — even, by construction.
  const capTopSts = sleeveTopSts - 2 * underarmCastOff - 2 * capDecPerSide;

  // Cap height fills the armhole it sews into (row-for-row, not tape-length — see
  // CAP_FILL). Floored so every decrease still fits (the flattest cap works them all
  // every row); capped at the armhole depth, which a cap never exceeds.
  const idealHeight = Math.round(rowsFor(w.armholeDepth, gauge) * CAP_FILL);
  const minHeight = 2 + capDecPerSide; // all decreases, no plain rows — the flattest cap
  const maxHeight = rowsFor(w.armholeDepth, gauge); // never taller than the armhole
  const capHeightRows = Math.min(maxHeight, Math.max(minHeight, idealHeight));

  return {
    hem: hp.hem,
    sleeveLength,
    hemDepthIn,
    ribCastOnSts,
    bodyCuffSts,
    ribRows,
    taperRows,
    incPerSide,
    sleeveStyle,
    bloomSts,
    gatherSts,
    shapePerSide,
    sleeveTopSts,
    underarmCastOff,
    capHeightRows,
    capDecPerSide,
    capTopSts,
    strapRows,
  };
}

/** A complete sleeve for the given piece id. */
export function sleeveRows(
  piece: Piece,
  size: SizeRecord,
  style: EaseStyleId,
  gauge: Gauge,
  shoulder: ShoulderStyle = 'set_in',
  opts: GarmentOptions = {},
): Row[] {
  const p = sleevePlan(size, style, gauge, shoulder, opts);
  const hp = hemPlan(size, gauge, opts.hem ?? 'ribbing', p.bodyCuffSts, p.hemDepthIn);
  const rows: Row[] = [];
  let index = 0;
  let stitches = 0;
  const push = (ops: Row['ops'], section: string): void => {
    index += 1;
    for (const op of ops) {
      if (op.kind === 'cast_on') stitches = op.count;
      if (op.kind === 'bind_off') stitches -= op.count;
      if (op.kind === 'increase') stitches += op.count * (op.side === 'both' ? 2 : 1);
      if (op.kind === 'decrease') stitches -= op.count * (op.side === 'both' ? 2 : 1);
      // take_off leaves the stitches live on waste yarn — no count change.
    }
    rows.push({ index, piece, stitches, carriage: carriageForRow(index), ops, section });
  };

  // Cuff cast-on + hem (rib by default; the hem plan names the sections and supplies
  // any in-hem ops, e.g. a folded cuff's closing pick-up row).
  if (hp.pieceRows > 0) {
    push([{ kind: 'cast_on', count: p.ribCastOnSts }, ...hp.opsAt(1)], hp.sectionAt(1));
    for (let i = 2; i <= p.ribRows; i++) push(hp.opsAt(i), hp.sectionAt(i));
  } else {
    // No hem: the cast-on is the first taper row (its edge rolls; the prose says so).
    push([{ kind: 'cast_on', count: p.ribCastOnSts }], 'taper');
  }

  // Taper / shape. The first stocking row carries the hem's change ops (the rib drops its
  // odd extra stitch) plus, for a gathered shape (bishop / lantern / modified), an even
  // increase-ACROSS from the cuff out to the bloom. Then the taper runs bloom → top over the
  // remaining rows: a plain increase for the tapered shapes, a DECREASE for a bell/bishop
  // (wider at the bottom), or nothing for a straight lantern. With no hem the cast-on row IS
  // taper row 1. A plain moderate taper (no gather, increase) reduces to the original loop.
  const firstTaper = hp.pieceRows > 0 ? 1 : 2;
  const shaping = Math.abs(p.shapePerSide);
  const shapeOp: Row['ops'] =
    p.shapePerSide >= 0
      ? [{ kind: 'increase', count: 1, side: 'both' }]
      : [{ kind: 'decrease', count: 1, side: 'both' }];
  const shapeAt = new Set(evenRows(shaping, p.taperRows - (firstTaper - 1)));
  for (let t = firstTaper; t <= p.taperRows; t++) {
    const r = t - (firstTaper - 1); // 1-based within the taper
    if (r === 1 && (hp.firstBodyOps.length > 0 || p.gatherSts > 0)) {
      const ops: Row['ops'] = [...hp.firstBodyOps];
      if (p.gatherSts > 0) ops.push({ kind: 'increase', count: p.gatherSts, side: 'across' });
      push(ops, 'taper');
    } else {
      push(shapeAt.has(r) ? shapeOp : [], 'taper');
    }
  }

  // Drop shoulder: no cap — the whole straight top comes off on waste yarn (it sews
  // to the armhole edge in making up, so it stays live, not cast off).
  if (shoulder === 'drop') {
    push([{ kind: 'take_off', count: p.sleeveTopSts }], 'cap');
    return rows;
  }

  // Raglan: underarm cast-off, then dec 1 st each end steadily over the raglan span (the
  // same rows as the body edge it seams to), and cast off the small crown into the neck.
  if (shoulder === 'raglan') {
    push([{ kind: 'bind_off', count: p.underarmCastOff, side: carriageForRow(index + 1) }], 'cap');
    push([{ kind: 'bind_off', count: p.underarmCastOff, side: carriageForRow(index + 1) }], 'cap');
    const decRows = p.capHeightRows - 2;
    const decAt = evenRows(p.capDecPerSide, decRows);
    const decSet = new Set(decAt);
    for (let r = 1; r <= decRows; r++) push(decSet.has(r) ? [{ kind: 'decrease', count: 1, side: 'both' }] : [], 'cap');
    push([{ kind: 'bind_off', count: p.capTopSts, side: carriageForRow(index + 1) }], 'cap');
    return rows;
  }

  // Cap: cast off the underarm (matching the body), then a bell-shaped decrease
  // over the solved cap height — fast (every-row) zones at the bottom and top, and
  // a magic-formula even spread through the gentle middle to fill the height.
  // Finally cast off the crown.
  push([{ kind: 'bind_off', count: p.underarmCastOff, side: carriageForRow(index + 1) }], 'cap');
  push([{ kind: 'bind_off', count: p.underarmCastOff, side: carriageForRow(index + 1) }], 'cap');

  // Half the decreases at most, so the two fast zones cannot overlap. Taking
  // CAP_FAST_EACH_END from each end works 2× that many, which is more than the plan
  // allows once capDecPerSide falls below 6 — and it does at a coarse gauge on a small
  // sleeve. The cap then over-decreased, leaving fewer live stitches than the crown
  // take-off claimed (a Baby 18" at 18 sts × 22.4 rows built 6 decreases against a plan
  // of 5, and took off 6 stitches with 4 on the needles).
  const fast = Math.min(CAP_FAST_EACH_END, Math.floor(p.capDecPerSide / 2));
  const middleDecs = Math.max(0, p.capDecPerSide - 2 * fast);
  const middleRows = Math.max(middleDecs, p.capHeightRows - 2 - 2 * fast - 1);
  for (let i = 0; i < fast; i++) push([{ kind: 'decrease', count: 1, side: 'both' }], 'cap'); // fast bottom
  const decAt = new Set(evenRows(middleDecs, middleRows));
  for (let r = 1; r <= middleRows; r++) {
    push(decAt.has(r) ? [{ kind: 'decrease', count: 1, side: 'both' }] : [], 'cap'); // gentle middle
  }
  for (let i = 0; i < fast; i++) push([{ kind: 'decrease', count: 1, side: 'both' }], 'cap'); // fast top

  // A saddle continues on the crown stitches as a flat strap across the shoulder, then
  // casts off (the strap seams to the front and back shoulders; its end joins the neck).
  // A set-in/drop cap takes its crown off on waste yarn.
  if (shoulder === 'saddle') {
    for (let i = 0; i < p.strapRows; i++) push([], 'saddle');
    push([{ kind: 'bind_off', count: p.capTopSts, side: carriageForRow(index + 1) }], 'saddle');
    return rows;
  }
  push([{ kind: 'take_off', count: p.capTopSts }], 'cap'); // crown off on waste yarn
  return rows;
}

/** Both sleeves (identical for a plain garment). */
export function sleeves(
  size: SizeRecord,
  style: EaseStyleId,
  gauge: Gauge,
  shoulder: ShoulderStyle = 'set_in',
  opts: GarmentOptions = {},
): { left: Row[]; right: Row[] } {
  return {
    left: sleeveRows('sleeve_l', size, style, gauge, shoulder, opts),
    right: sleeveRows('sleeve_r', size, style, gauge, shoulder, opts),
  };
}
