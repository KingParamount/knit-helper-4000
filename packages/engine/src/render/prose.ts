/**
 * Prose renderer (Phase 2) — machine-first. Turns a piece's Row[] into a printable
 * written pattern in our own words. See prose-instruction-style + the CLAUDE.md
 * "renderers over one structure" rule.
 *
 * The walk below is one structure; the wording comes from a `Vocab` — VERBOSE (full
 * sentences) or TERSE (machine-knitter shorthand: CO/BO, st, RC, COR/COL, MT). The
 * two read the same instructions, differently abbreviated.
 *
 * House style (all consequences of "instructions must be what the knitter can see
 * and feel on the machine, not hold in their head"):
 *
 *  - One action per line. Shaping lines lead with the row counter; a repeated shape
 *    is stated once, then "Repeat …". Plain stretches are "knit until the counter
 *    reads N" — read the dial, never count rows.
 *  - The counter is set to 000 after cast-on and reset at the rib→body change and
 *    the neck split; readings are relative to the last reset.
 *  - Ribbing is knit at main tension minus two; the tension goes back to main at the
 *    change to stocking stitch. Rib is cast on odd (extra on the right) and dropped
 *    one on the right at that change, so both selvedges are knit stitches.
 *  - Carriage side is stated at the natural checkpoints, derived from the row array.
 *  - Shoulders are short-rowed off onto waste yarn for grafting later.
 *
 * Pure and I/O-free; output is structured (a title + line list per piece).
 */

import type { Row, Op, Carriage } from '../row';
import type { NeckStyle, BackNeckStyle, ShoulderStyle, Technique, Units, CollarStyle } from '../data/types';
import type { Gauge } from '../gauge';
import { HEM_SECTIONS, HEM_END_SECTIONS } from '../pieces/hem';

export interface PieceProse {
  title: string;
  lines: string[];
  /**
   * Which piece this is, where it is one. Renderers used to match prose to schematics
   * by position in the pieces array, which broke the moment hand knitting split its
   * making-up in two and moved a block in front of the neckband.
   */
  piece?: 'back' | 'front' | 'sleeve' | 'neckband' | 'armband';
}

export type ProseStyle = 'verbose' | 'abbreviated';

// ---------------------------------------------------------------------------
// Structural helpers (shared by both vocabularies).
// ---------------------------------------------------------------------------

/** Row counters are read off a three-digit mechanical dial. */
function pad(n: number): string {
  return String(n).padStart(3, '0');
}

function sideWord(side: Carriage): string {
  return side === 'L' ? 'left' : 'right';
}

/** Capitalise the first letter (for reusing a mid-sentence phrase as a sentence). */
function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function otherSide(side: Carriage): Carriage {
  return side === 'L' ? 'R' : 'L';
}

function ordinal(n: number): string {
  const rem100 = n % 100;
  if (rem100 >= 11 && rem100 <= 13) return `${n}th`;
  switch (n % 10) {
    case 1:
      return `${n}st`;
    case 2:
      return `${n}nd`;
    case 3:
      return `${n}rd`;
    default:
      return `${n}th`;
  }
}

/** "147" | "147 and 149" | "147, 149 and 151". */
function andList(items: string[]): string {
  if (items.length === 1) return items[0];
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}

/** "1 stitch" | "3 stitches" — the one count word that does not just take an -s. */
function sts(n: number): string {
  return `${n} ${n === 1 ? 'stitch' : 'stitches'}`;
}

/** "1 row" | "2 rows", "1 time" | "5 times", "1 needle" | "6 needles". */
function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? '' : 's'}`;
}

// ---------------------------------------------------------------------------
// The vocabulary — every user-facing phrase, in two registers.
// ---------------------------------------------------------------------------

/**
 * Which face a shaping instruction is worked on. 'alternating' is a phase that shapes
 * on every row and so works both faces — which only a hand knitter has to care about,
 * since a machine bed never turns over.
 */
export type Facing = 'rs' | 'ws' | 'alternating';

interface Vocab {
  carr(side: Carriage): string; // carriage-position suffix (leading space)
  castOn(n: number, carriageEnd: Carriage): string;
  ribTension(): string;
  setCounter(): string;
  ribUntil(rc: number, lengthIn: number): string;
  /** Hem-section variants of ribTension/ribUntil (moss, garter, frill, folded halves). */
  hemTension(section: string): string;
  hemUntil(section: string, rc: number, lengthIn: number): string;
  /** The change to the body after a non-rib hem (counter reset, tension back). */
  hemChange(section: string, carriage: Carriage): string;
  /** A folded band's turn row (plain fold in the numbers; picot as the aside). */
  foldedTurn(rc: number): string;
  /** A folded band's closing row: the cast-on edge knits together with the work. */
  foldedJoin(n: number): string;
  /** A frill's gather: knit two together all the way across. */
  frillGather(removed: number, remaining: number): string;
  /** A gathered sleeve cuff (bishop/lantern): increase evenly across to the fuller width. */
  bloomAcross(total: number): string;
  /** Hem 'none': the cast-on edge will roll, and the pattern should say so once. */
  noHemNote(): string;
  resetToStocking(drop: Carriage | undefined, carriage: Carriage): string;
  resetPlain(carriage: Carriage): string;
  rejoinRight(): string;
  stitchCount(n: number, split: boolean): string;
  knitUntil(rc: number, lengthIn: number, carriage?: Carriage): string;
  marker(): string;
  /** Hand only: a one-time note that WS shaping rows are written as purl decreases. */
  wsShapingNote(): string;
  shapeLead(gap: number, rc: number, action: string): string;
  actDecBoth(facing: Facing): string;
  actIncBoth(facing: Facing): string;
  actDecNeck(facing: Facing): string;
  actBindOffEdge(n: number, side: Carriage): string;
  actBindOffNeck(n: number): string;
  repeatOnce(end: number, count: number): string;
  repeatRange(a: number, b: number, count: number): string;
  repeatEvery(step: number, list: string[], count: number): string;
  repeatAt(list: string[], count: number): string;
  divideNeck(gap: number, rc: number, n: number): string;
  parkRight(): string;
  castingOff(): string;
  breakYarnGraft(): string;
  bindOffCentre(n: number): string;
  bindOffRemainingCap(n: number): string;
  bindOffAll(n: number): string;
  takeShouldersEach(n: number): string;
  takeShoulderThis(n: number): string;
  pickUp(n: number): string;
  /** Hand only: pick a band up around an armhole (the sleeveless armhole band). */
  pickUpArmhole(n: number): string;
  setHold(): string;
  holdGroup(count: number, side: Carriage, rc: number): string;
  holdRepeatBack(count: number, rc: number, carriage: Carriage): string;
  mitreHeading(): string;
  mitreWork(rc: number, count: number): string;
  mitreMeetNote(): string;
  crossoverTitle(): string;
  crossoverBody(): string;
  takeOff(n: number): string;
  /** Finishing a band that was worked in place (hand only; machine sews its band on). */
  bandCastOff(n: number): string;
  markWaypoints(positions: number[]): string;
}

function splitV(n: number): string {
  return `(${Math.floor(n / 2)} left, ${Math.ceil(n / 2)} right)`;
}
function splitT(n: number): string {
  return `(${Math.floor(n / 2)}L, ${Math.ceil(n / 2)}R)`;
}
function edgeT(side: Carriage): string {
  return side === 'L' ? 'LH' : 'RH';
}
function corT(side: Carriage): string {
  return side === 'L' ? 'COL' : 'COR';
}

const VERBOSE: Vocab = {
  carr: (side) => ` The carriage should be on the ${sideWord(side)}.`,
  castOn: (n, ce) =>
    `Cast on ${sts(n)} ${splitV(n)}, ending with the carriage on the ${sideWord(ce)}.`,
  ribTension: () => 'Set the tension to main tension, minus 2 whole numbers.',
  setCounter: () => 'Set the row counter to 000.',
  ribUntil: (rc, _lengthIn) =>
    `Work in the rib pattern of your choice until the row counter reads ${pad(
      rc,
    )}. If you are knitting mock rib, follow your machine manual for how to work it.`,
  hemTension: (section) => {
    switch (section) {
      case 'moss_band':
        return 'Set the tension to main tension, minus 2 whole numbers. Moss stitch on a single bed is hand-tooled; a garter carriage can also work it.';
      case 'garter_band':
        return 'Keep the tension at main tension. Garter stitch on a machine means turning the work with a garter bar every row, or using a garter carriage.';
      case 'folded_facing':
        return 'Set the tension one or two whole numbers below main tension — the facing folds inside, and knitting the band tighter stops the doubled hem flaring.';
      default:
        return '';
    }
  },
  hemUntil: (section, rc, _lengthIn) => {
    switch (section) {
      case 'moss_band':
        return `Work in moss stitch until the row counter reads ${pad(rc)}.`;
      case 'garter_band':
        return `Work in garter stitch until the row counter reads ${pad(rc)}.`;
      case 'frill':
        return `Knit the frill until the row counter reads ${pad(rc)}, working the first 2 rows in garter stitch so the edge does not curl.`;
      case 'folded_facing':
        return `Knit the facing until the row counter reads ${pad(rc)}.`;
      default:
        return `Knit until the row counter reads ${pad(rc)}.`;
    }
  },
  hemChange: (section, carriage) =>
    'Reset the row counter to 000, change to stocking stitch' +
    (section === 'garter_band' ? '.' : ', and set the tension back to main tension.') +
    VERBOSE.carr(carriage),
  foldedTurn: (rc) =>
    `Row ${pad(rc)} is the fold line: knit it at a slightly looser tension. For a picot edge instead, transfer every other stitch to its neighbour for this one row — the eyelets fold into a row of points.`,
  foldedJoin: (n) =>
    `Pick the cast-on edge up onto the needles — one loop onto each of the ${n} needles — and knit 1 row through loop and stitch together, closing the hem.`,
  frillGather: (removed, remaining) =>
    `Transfer every second stitch onto its neighbour and knit 1 row: ${sts(removed + remaining)} become ${remaining}.`,
  bloomAcross: (total) =>
    `Increase evenly across the row to ${sts(total)} — the fuller sleeve springs from the cuff here; the ribbed cuff gathers it back in.`,
  noHemNote: () =>
    'There is no hem band; the stocking stitch edge will roll. Steam it flat when you block, or keep the roll as the finish.',
  resetToStocking: (drop, carriage) =>
    'Reset the row counter to 000, change to stocking stitch, set the tension back to main tension' +
    (drop ? `, and decrease 1 stitch at the ${sideWord(drop)} hand edge.` : '.') +
    VERBOSE.carr(carriage),
  resetPlain: (carriage) => `Reset the row counter to 000.${VERBOSE.carr(carriage)}`,
  rejoinRight: () => 'Return the right side of the work to the needles and rejoin the yarn.',
  stitchCount: (n, split) =>
    split ? `There should be ${sts(n)} ${splitV(n)}.` : `There should be ${sts(n)}.`,
  knitUntil: (rc, _lengthIn, carriage) =>
    `Knit until the row counter reads ${pad(rc)}.` + (carriage ? VERBOSE.carr(carriage) : ''),
  marker: () =>
    'Hang a marker of contrast yarn on the right and left edge stitches; the markers line up when you set the sleeve into the armhole.',
  // The machine bed never turns over, so facing is not the knitter's concern here.
  wsShapingNote: () => '',
  shapeLead: (gap, rc, action) =>
    `Knit ${gap === 1 ? '1 row' : `${gap} rows`} to row counter ${pad(rc)}, then ${action}.`,
  actDecBoth: (_rs) => 'decrease 1 stitch at either end of the row',
  actIncBoth: (_rs) => 'increase 1 stitch at either end of the row',
  actDecNeck: (_rs) => 'decrease 1 stitch at the neck edge',
  actBindOffEdge: (n, side) => `cast off ${sts(n)} at the ${sideWord(side)} hand edge`,
  actBindOffNeck: (n) => `cast off ${sts(n)} at the neck edge`,
  repeatOnce: (end, count) =>
    `Repeat the last instruction once more, at row counter ${pad(end)} (making a total of ${plural(count, 'time')}).`,
  repeatRange: (a, b, count) =>
    `Repeat the last instruction for row counts ${pad(a)} to ${pad(b)} (making a total of ${plural(count, 'time')}).`,
  repeatEvery: (step, list, count) =>
    `Repeat the last instruction on every ${ordinal(step)} row, at row counts ${andList(
      list,
    )} (making a total of ${plural(count, 'time')}).`,
  repeatAt: (list, count) =>
    `Repeat the last instruction at row counts ${andList(list)} (making a total of ${plural(count, 'time')}).`,
  divideNeck: (gap, rc, n) =>
    `Knit ${gap === 1 ? '1 row' : `${gap} rows`} to row counter ${pad(
      rc,
    )}, then cast off the centre ${sts(n)} loosely to divide for the neck.`,
  parkRight: () => 'Put the right side of the work into hold; you will shape the left side first.',
  castingOff: () => 'Casting off.',
  breakYarnGraft: () => 'Break the yarn, leaving plenty of tail for grafting.',
  bindOffCentre: (n) => `Cast off the centre ${sts(n)} loosely.`,
  bindOffRemainingCap: (n) => `Cast off the remaining ${sts(n)} loosely to close the cap.`,
  bindOffAll: (n) => `Cast off all ${sts(n)} loosely.`,
  takeShouldersEach: (n) =>
    `Take each shoulder off separately onto 5-6 rows of waste yarn. There should be ${sts(n)} on each shoulder.`,
  takeShoulderThis: (n) =>
    `Take this shoulder off onto 5-6 rows of waste yarn. There should be ${sts(n)} on this shoulder.`,
  pickUp: (n) => `Pick up and knit ${sts(n)} evenly around the neck edge ${splitV(n)}.`,
  pickUpArmhole: (n) => `Pick up and knit ${sts(n)} evenly around the armhole edge ${splitV(n)}.`,
  setHold: () => 'Set the carriage to hold.',
  holdGroup: (count, side, rc) =>
    `Bring ${plural(count, 'needle')} at the ${sideWord(side)} into hold, then knit to row counter ${pad(rc)}.`,
  holdRepeatBack: (count, rc, carriage) =>
    `Repeat the last two instructions, holding ${plural(count, 'needle')} each time, until the row counter reads ${pad(
      rc,
    )}.${VERBOSE.carr(carriage)}`,
  mitreHeading: () => 'Mitre the two ends.',
  mitreWork: (rc, count) =>
    `Working in the rib pattern of your choice, decrease 1 stitch at each end of every row until the row counter reads ${pad(
      rc,
    )} (${plural(count, 'row')}), tapering both ends to a diagonal.`,
  mitreMeetNote: () =>
    'These two mitred ends meet at the centre front; you seam them there when you make up, forming the point of the V.',
  crossoverTitle: () => 'Alternative front point — crossed over.',
  crossoverBody: () =>
    'For a crossed-over point instead of the mitre, work the band straight (no end shaping), then lap one end over the other at the centre front and stitch both down neatly on the inside. It is the more casual finish.',
  takeOff: (n) =>
    `Take all ${sts(n)} off onto 5–6 rows of waste yarn — they stay live, ready to block and seam.`,
  bandCastOff: (n) => `Cast off all ${sts(n)} loosely in rib.`,
  markWaypoints: (positions) =>
    `Hang a contrast-yarn marker at ${andList(positions.map((p) => `stitch ${p}`))} — this is where the band will meet the shoulder ${
      positions.length > 1 ? 'seams' : 'seam'
    }. Matching the markers to the seams keeps the band eased in evenly.`,
};

const TERSE: Vocab = {
  carr: (side) => ` ${corT(side)}.`,
  castOn: (n, ce) => `CO ${n} st ${splitT(n)}, ${corT(ce)}.`,
  ribTension: () => 'Set to MT-2.',
  setCounter: () => 'RC to 000.',
  ribUntil: (rc, _lengthIn) => `Work your rib to RC ${pad(rc)}. Mock rib: see machine manual.`,
  hemTension: (section) => {
    switch (section) {
      case 'moss_band':
        return 'Set to MT-2. Moss st: hand-tool (or garter carriage).';
      case 'garter_band':
        return 'Keep MT. Garter st: garter bar every row (or garter carriage).';
      case 'folded_facing':
        return 'Set to MT-1 or MT-2 (tight facing stops the hem flaring).';
      default:
        return '';
    }
  },
  hemUntil: (section, rc, _lengthIn) => {
    switch (section) {
      case 'moss_band':
        return `Moss st to RC ${pad(rc)}.`;
      case 'garter_band':
        return `Garter st to RC ${pad(rc)}.`;
      case 'frill':
        return `Frill to RC ${pad(rc)} (first 2 rows garter, to stop curl).`;
      case 'folded_facing':
        return `Kn facing to RC ${pad(rc)}.`;
      default:
        return `Kn to RC ${pad(rc)}.`;
    }
  },
  hemChange: (section, carriage) =>
    'RC to 000, change to st st' +
    (section === 'garter_band' ? '.' : ', set to MT.') +
    TERSE.carr(carriage),
  foldedTurn: (rc) =>
    `RC ${pad(rc)} = fold line: knit loose (picot alt: transfer every other st to neighbour this row).`,
  foldedJoin: (n) => `PU cast-on edge, 1 loop per needle (${n} N), kn 1 row through both — hem closed.`,
  frillGather: (removed, remaining) =>
    `Transfer every 2nd st to neighbour, kn 1 row: ${removed + remaining} st → ${remaining} st.`,
  bloomAcross: (total) => `Inc evenly across to ${total} st (fuller sleeve; cuff gathers it in).`,
  noHemNote: () => 'No hem band; st st edge rolls. Steam flat at blocking, or keep the roll.',
  resetToStocking: (drop, carriage) =>
    'RC to 000, change to st st, set to MT' +
    (drop ? `, dec 1 st at ${edgeT(drop)}.` : '.') +
    TERSE.carr(carriage),
  resetPlain: (carriage) => `RC to 000.${TERSE.carr(carriage)}`,
  rejoinRight: () => 'Return R side to needles, rejoin yarn.',
  stitchCount: (n, split) => (split ? `${n} st ${splitT(n)}.` : `${n} st.`),
  knitUntil: (rc, _lengthIn, carriage) => `Kn to RC ${pad(rc)}.` + (carriage ? TERSE.carr(carriage) : ''),
  marker: () => 'Hang marker on R and L edge sts (line up when setting in the sleeve).',
  wsShapingNote: () => '',
  shapeLead: (_gap, rc, action) => `Kn to RC ${pad(rc)}, then ${action}.`,
  actDecBoth: (_rs) => 'dec 1 st at either end',
  actIncBoth: (_rs) => 'inc 1 st at either end',
  actDecNeck: (_rs) => 'dec 1 st at neck edge',
  actBindOffEdge: (n, side) => `BO ${n} st at ${edgeT(side)}`,
  actBindOffNeck: (n) => `BO ${n} st at neck edge`,
  repeatOnce: (end, count) => `Rpt instruction once more, at RC ${pad(end)} (total ${plural(count, 'time')}).`,
  repeatRange: (a, b, count) =>
    `Rpt instruction for RC ${pad(a)} to ${pad(b)} (total ${plural(count, 'time')}).`,
  repeatEvery: (step, list, count) =>
    `Rpt instruction every ${ordinal(step)} row, at RC ${andList(list)} (total ${plural(count, 'time')}).`,
  repeatAt: (list, count) => `Rpt instruction at RC ${andList(list)} (total ${plural(count, 'time')}).`,
  divideNeck: (_gap, rc, n) =>
    `Kn to RC ${pad(rc)}, then BO centre ${n} st loosely to divide for neck.`,
  parkRight: () => 'Put R side into hold; shape L side first.',
  castingOff: () => 'Casting off.',
  breakYarnGraft: () => 'Break yarn, leaving tail.',
  bindOffCentre: (n) => `BO centre ${n} st loosely.`,
  bindOffRemainingCap: (n) => `BO remaining ${n} st loosely to close cap.`,
  bindOffAll: (n) => `BO all ${n} st loosely.`,
  takeShouldersEach: (n) => `Take shoulders off to waste yarn. ${n} st per shoulder.`,
  takeShoulderThis: (n) => `Take shoulder off to waste yarn. ${n} st per shoulder.`,
  pickUp: (n) => `PU ${n} st around neck edge ${splitT(n)}.`,
  pickUpArmhole: (n) => `PU ${n} st around armhole edge ${splitT(n)}.`,
  setHold: () => 'Set carriage to hold.',
  holdGroup: (count, side, rc) => `${count} N at ${side} into hold, then Kn to RC ${pad(rc)}.`,
  holdRepeatBack: (count, rc, carriage) =>
    `Rpt last 2 instructions, holding ${count} N each time, to RC ${pad(rc)}.${TERSE.carr(carriage)}`,
  mitreHeading: () => 'Mitre the two ends.',
  mitreWork: (rc, count) =>
    `In your chosen rib, dec 1 st at each end every row to RC ${pad(rc)} (${plural(count, 'row')}), tapering both ends.`,
  mitreMeetNote: () => 'The two mitred ends seam at centre front in making up (the V point).',
  crossoverTitle: () => 'Alt point — crossed over.',
  crossoverBody: () =>
    'Crossed-over: work the band straight (no end shaping), lap one end over the other at centre front, stitch down inside.',
  takeOff: (n) => `Take all ${n} st off on 5–6 rows waste yarn (live, to block & seam).`,
  bandCastOff: (n) => `BO all ${n} st loosely in rib.`,
  markWaypoints: (positions) =>
    `Hang a contrast marker at ${andList(positions.map((p) => `st ${p}`))} (band meets the shoulder ${
      positions.length > 1 ? 'seams' : 'seam'
    }; match markers to seams to ease in).`,
};


/**
 * A length, for prose that measures rather than counts.
 *
 * Rounded to something a knitter can actually find on a tape: half a centimetre, or a
 * quarter inch. Finer than that is false precision — the fabric moves more than that
 * under its own weight, and the tension it came from was measured by hand.
 */
export function fmtLength(inches: number, units: Units): string {
  if (units === 'cm') {
    const cm = Math.round(inches * 2.54 * 2) / 2;
    return `${cm % 1 === 0 ? cm.toFixed(0) : cm.toFixed(1)} cm`;
  }
  const q = Math.round(inches * 4);
  const whole = Math.floor(q / 4);
  const frac = ['', '¼', '½', '¾'][q % 4];
  if (whole === 0) return `${frac || '0'} in`;
  return `${whole}${frac} in`;
}

// ---------------------------------------------------------------------------
// The hand-knitting register.
// ---------------------------------------------------------------------------

/**
 * Hand knitting over the SAME row array. What changes and why:
 *
 *  - **Measure plain stretches, count shaped ones.** Hand patterns say "until the
 *    piece measures 35 cm"; row tension varies between knitters far more than stitch
 *    tension does, so a length is the more reliable instruction. But you cannot
 *    measure your way to "decrease on this row", so shaping stays counted. That split
 *    is per-context, not a blanket swap for the machine's row counter.
 *  - **Never left/right.** The work turns over every row, so the same physical edge is
 *    at the start of a right-side row and the end of a wrong-side one. Edges are named
 *    for what they are — "each end of the row", "the neck edge" — which is true
 *    whichever way the work is facing. (The machine register can say left and right
 *    because the bed does not move.)
 *  - **No machine idioms at all**: no row counter, no carriage, no tension dial, no
 *    holding position, no waste yarn. Stitches that stay live go on a holder.
 *  - **The knitter's own fabric.** We never name a stitch pattern: the tension came
 *    from their swatch, so the garment is whatever they swatched in. Likewise we never
 *    name a needle size or yarn — tension is many-to-one over yarn, needle and knitter,
 *    so inferring backwards would be inventing an input we were never given.
 *
 * Decrease pairing follows the majority convention: ssk at the start of a right-side
 * row, k2tog at the end, so each slant follows its edge. Sources describe the opposite
 * pairing as a legitimate deliberate choice, so this is a default and not a law.
 */
function handVocab(style: ProseStyle, units: Units): Vocab {
  const terse = style === 'abbreviated';
  const len = (inches: number): string => fmtLength(inches, units);
  // "the piece measures X" — the fabric is measured from the cast-on edge, not from a
  // section boundary, because that is where a tape measure actually starts.
  const measure = (inches: number): string =>
    terse ? `work to ${len(inches)} from cast-on` : `until the piece measures ${len(inches)} from the cast-on edge`;

  return {
    // A hand knitter has no carriage; the facing is carried in the row instructions.
    carr: () => '',
    castOn: (n) =>
      terse ? `CO ${n} st.` : `Cast on ${sts(n)}.`,
    // Rib is worked on smaller needles, but there is no way to measure how much
    // smaller: it depends on the yarn and the knitter, and they have not swatched it.
    // So this is advice, and the rib's DEPTH is given as a measurement instead of a
    // row count, which needs no rib tension at all.
    ribTension: () =>
      terse
        ? 'Use needles a size or two smaller than your swatch needles.'
        : 'Work the rib on needles a size or two smaller than the ones you used for your tension swatch.',
    setCounter: () => '',
    ribUntil: (_rc, lengthIn) =>
      terse
        ? `Rib to ${len(lengthIn)}.`
        : `Work in the rib of your choice until it measures ${len(lengthIn)}.`,
    hemTension: (section) => {
      switch (section) {
        case 'folded_facing':
          return terse
            ? 'Use needles a size or two smaller for the hem.'
            : 'Work the hem on needles a size or two smaller than your tension-swatch needles — the doubled band sits flatter knitted tight.';
        default:
          // Moss, garter and a frill lie flat at the swatch tension — no needle change.
          return '';
      }
    },
    hemUntil: (section, _rc, lengthIn) => {
      switch (section) {
        case 'moss_band':
          return terse
            ? `Moss st to ${len(lengthIn)}.`
            : `Work in moss stitch until it measures ${len(lengthIn)}.`;
        case 'garter_band':
          return terse
            ? `Garter st to ${len(lengthIn)}.`
            : `Work in garter stitch (knit every row) until it measures ${len(lengthIn)}.`;
        case 'frill':
          return terse
            ? `Frill to ${len(lengthIn)} (first 2 rows knit, to stop curl).`
            : `Work the frill in stocking stitch until it measures ${len(lengthIn)}, knitting the first 2 rows plain so the edge does not curl.`;
        case 'folded_facing':
          return terse
            ? `St st to ${len(lengthIn)} (facing).`
            : `Work in stocking stitch until it measures ${len(lengthIn)} — this half is the facing, which folds inside.`;
        default:
          return terse
            ? `Work to ${len(lengthIn)} from cast-on.`
            : `Continue in stocking stitch until the piece measures ${len(lengthIn)} from the cast-on edge.`;
      }
    },
    hemChange: (section) => {
      // A frill is already stocking stitch and already on the swatch needles — the
      // gather row is the whole change, so there is nothing to announce.
      if (section === 'frill') return '';
      const needles =
        section === 'folded_join'
          ? terse
            ? 'Change back to your swatch needles'
            : 'Change back to the needles you used for your tension swatch'
          : terse
            ? 'Change to the stitch you swatched in'
            : 'Change to the stitch your tension swatch was knitted in';
      return `${needles}.`;
    },
    foldedTurn: () =>
      terse
        ? 'Purl 1 RS row = fold line (picot alt: *k2tog, yo* across).'
        : 'Purl 1 row on the right side to mark the fold line. For a picot edge instead, work *knit 2 together, yarn over* to the end — the eyelets fold into a row of points.',
    foldedJoin: (n) =>
      terse
        ? `Fold at turn row; knit each st tog with its cast-on loop (${n} st). Or sew hem down at making up.`
        : `Fold the hem at the turn row and knit each stitch together with its matching cast-on loop (${sts(n)}), closing the hem. If you prefer, work straight on and slip-stitch the hem down when you make up.`,
    frillGather: (removed, remaining) =>
      terse
        ? `K2tog across: ${removed + remaining} st → ${remaining} st.`
        : `Knit 2 together all the way across the row: ${sts(removed + remaining)} become ${sts(remaining)}.`,
    bloomAcross: (total) =>
      terse
        ? `Inc evenly across to ${total} st (full sleeve; cuff gathers in).`
        : `Increase evenly across the row to ${sts(total)} stitches — the fuller sleeve springs from the cuff, and the ribbed cuff gathers it in.`,
    noHemNote: () =>
      terse
        ? 'No hem; st st edge rolls. Steam at blocking, or keep the roll.'
        : 'There is no hem; the stocking stitch edge will roll. Steam it flat when you block, or keep the roll as the finish.',
    resetToStocking: (drop) =>
      (terse
        ? 'Change to your swatch needles and the stitch you swatched in'
        : 'Change to the needles you used for your tension swatch, and to the stitch your tension swatch was knitted in') +
      (drop ? ', decreasing 1 stitch on the first row.' : '.'),
    resetPlain: () => '',
    rejoinRight: () =>
      terse
        ? 'Rejoin yarn to the held stitches.'
        : 'Return the held stitches to a needle and rejoin the yarn, ready to work the second side.',
    stitchCount: (n) => (terse ? `${n} st.` : `There should be ${sts(n)}.`),
    knitUntil: (_rc, lengthIn) =>
      terse ? `Work ${measure(lengthIn)}.` : `Continue in pattern ${measure(lengthIn)}.`,
    marker: () =>
      terse
        ? 'Mark each end of this row.'
        : 'Mark each end of this row with a contrast thread; the marks line up when you set the sleeve into the armhole.',
    // Surfaced to the knitter what the shared row array leaves implicit: some shaping
    // rows fall on the wrong side. We write those as leaning purl decreases by default,
    // but a plain decrease is a perfectly good substitute — which is all the original
    // ever asked for. See the note by actDecBoth on why the rows are not re-cadenced.
    wsShapingNote: () =>
      terse
        ? 'Some shaping rows fall on the wrong side; these are given as purl decreases (p2tog/ssp) to lean the same way. A plain decrease is fine instead.'
        : 'Some of these shaping rows fall on a wrong-side (purl) row. They are written as purl decreases — p2tog at the start of the row and ssp at the end — so they lean the same way as the ones worked on the right side. If you would rather keep it simple, work an ordinary decrease on those rows instead; the lean shows a little less but the fit is the same.',
    // Shaping is counted, not measured — you cannot measure your way to a decrease row.
    shapeLead: (gap, _rc, action) =>
      terse
        ? `Work ${gap === 1 ? '1 row' : `${gap} rows`}, then ${action}.`
        : `Work ${gap === 1 ? '1 row' : `${gap} rows`}, then ${action}.`,
    /*
     * Shaping is conventionally worked on right-side rows, because the slant of a
     * decrease reads on the knit face and barely shows on the purl one. This shaping
     * does not all fall there: the armhole starts the row after the underarm cast-offs,
     * so its alternate-row phases land on wrong-side rows, and the fastest phase works
     * every row and therefore both faces whatever we do.
     *
     * We name the decrease for the row's facing rather than move the shaping. The row
     * array is shared with the machine pattern, whose proportions are validated against
     * real published patterns; re-cadencing it for hand would deepen the armhole and put
     * the hand version outside everything that validation covers. Purl-side paired
     * decreases exist for exactly this case.
     *
     * The pairing mirrors: an edge keeps its lean whichever face is being worked. On a
     * right-side row ssk opens the row and k2tog closes it; on a wrong-side row the work
     * is turned, so the edge that ssk shaped is now at the END of the row and takes ssp,
     * and the k2tog edge opens the row and takes p2tog.
     *
     * FLAGGED FOR A KNITTER: most of the armhole lands on wrong-side rows. It is
     * workable and the decreases lean correctly, but a hand knitter may simply prefer
     * the whole armhole shifted a row so it falls on right-side rows instead.
     */
    actDecBoth: (facing) => {
      if (facing === 'rs') {
        return terse
          ? 'dec 1 st at each end (ssk at the start, k2tog at the end)'
          : 'decrease 1 stitch at each end of the row — ssk at the start, k2tog at the end, so each decrease leans with its edge';
      }
      if (facing === 'ws') {
        return terse
          ? 'dec 1 st at each end (p2tog at the start, ssp at the end)'
          : 'decrease 1 stitch at each end of the row — p2tog at the start, ssp at the end, which lean to match the decreases worked on the right side';
      }
      // Every row, so both faces: give the knitter the pair for each.
      return terse
        ? 'dec 1 st at each end (RS: ssk/k2tog; WS: p2tog/ssp)'
        : 'decrease 1 stitch at each end of the row, working ssk at the start and k2tog at the end on right-side rows, and p2tog at the start and ssp at the end on wrong-side rows';
    },
    actIncBoth: () => (terse ? 'inc 1 st at each end' : 'increase 1 stitch at each end of the row'),
    actDecNeck: (facing) => {
      if (facing === 'rs') return terse ? 'dec 1 st at the neck edge' : 'decrease 1 stitch at the neck edge';
      if (facing === 'ws') {
        return terse
          ? 'dec 1 st at the neck edge (purlwise)'
          : 'decrease 1 stitch at the neck edge, working the decrease purlwise';
      }
      return terse
        ? 'dec 1 st at the neck edge (purlwise on WS rows)'
        : 'decrease 1 stitch at the neck edge, working it purlwise on wrong-side rows';
    },
    // Casting off can only happen at the START of a row — the working yarn has to be at
    // the stitches being removed, and at the end of a row it is positioned to turn. So
    // a cast-off at each edge always costs a pair of rows. Naming the edge rather than a
    // side keeps it true whichever way the work is facing.
    actBindOffEdge: (n) =>
      terse ? `cast off ${n} st at the start of the row` : `cast off ${sts(n)} at the beginning of the row`,
    actBindOffNeck: (n) =>
      terse ? `cast off ${n} st at the neck edge` : `cast off ${sts(n)} at the neck edge`,
    repeatOnce: (_end, count) =>
      terse
        ? `Rpt once more (${plural(count, 'time')} in all).`
        : `Repeat the last instruction once more (${plural(count, 'time')} in all).`,
    repeatRange: (_a, _b, count) =>
      terse
        ? `Rpt on the next ${plural(count - 1, 'row')} (${plural(count, 'time')} in all).`
        : `Repeat the last instruction on each of the next ${plural(count - 1, 'row')} (${plural(count, 'time')} in all).`,
    repeatEvery: (step, _list, count) =>
      terse
        ? `Rpt every ${ordinal(step)} row, ${plural(count, 'time')} in all.`
        : `Repeat the last instruction on every ${ordinal(step)} row until you have worked it ${plural(count, 'time')} in all.`,
    repeatAt: (list, count) =>
      terse
        ? `Rpt ${count - 1} more ${count - 1 === 1 ? 'time' : 'times'}.`
        : `Repeat the last instruction ${count - 1} more ${count - 1 === 1 ? 'time' : 'times'} (${plural(count, 'time')} in all).`,
    divideNeck: (gap, _rc, n) =>
      terse
        ? `Work ${gap === 1 ? '1 row' : `${gap} rows`}, then cast off the centre ${n} st to divide for the neck.`
        : `Work ${gap === 1 ? '1 row' : `${gap} rows`}, then cast off the centre ${sts(n)} loosely to divide for the neck. Work each side separately from here.`,
    // Machine parks half the bed; by hand you slip the waiting stitches onto a holder.
    parkRight: () =>
      terse
        ? 'Slip the waiting stitches onto a holder.'
        : 'Slip the stitches of the second side onto a holder and leave them; you will work this side first.',
    castingOff: () => (terse ? 'Shaping the shoulder.' : 'Shaping the shoulder.'),
    breakYarnGraft: () =>
      terse ? 'Break the yarn, leaving a long tail.' : 'Break the yarn, leaving a tail long enough to join the shoulder.',
    bindOffCentre: (n) => (terse ? `Cast off the centre ${n} st loosely.` : `Cast off the centre ${sts(n)} loosely.`),
    bindOffRemainingCap: (n) =>
      terse ? `Cast off the remaining ${n} st loosely.` : `Cast off the remaining ${sts(n)} loosely to close the cap.`,
    bindOffAll: (n) => (terse ? `Cast off all ${n} st loosely.` : `Cast off all ${sts(n)} loosely.`),
    // Shoulders are short-rowed, then left LIVE on a holder so the two can be joined
    // with a three-needle cast off. Grafting is not used here: it makes a soft join, and
    // a shoulder carries the weight of the garment.
    takeShouldersEach: (n) =>
      terse
        ? `Slip each shoulder onto its own holder — ${n} st each.`
        : `Slip each shoulder onto its own holder, leaving the stitches live. There should be ${sts(n)} on each shoulder.`,
    takeShoulderThis: (n) =>
      terse
        ? `Slip this shoulder onto a holder — ${n} st.`
        : `Slip this shoulder onto a holder, leaving the stitches live. There should be ${sts(n)} on this shoulder.`,
    // The starting point is not decoration: the chart sites the V mitre by counting
    // along from here, so a knitter who began somewhere else would decrease in the
    // wrong place. Prose and chart have to agree about where stitch 1 is.
    pickUp: (n) =>
      terse
        ? `From the open shoulder, pick up and knit ${n} st evenly round the neck, back neck first.`
        : `With the right side facing and beginning at the open shoulder, pick up and knit ${sts(n)} evenly around the neck edge — across the back neck first, then down and around the front — knitting across the held stitches as you reach them.`,
    pickUpArmhole: (n) =>
      terse
        ? `From the underarm, pick up and knit ${n} st evenly round the armhole.`
        : `With the right side facing and beginning at the underarm seam, pick up and knit ${sts(n)} evenly around the armhole edge.`,
    setHold: () => '',
    // Short rows by hand: leave the stitches unworked and turn. Working the wrap in on
    // the following row is what closes the hole at the turn.
    holdGroup: (count) =>
      terse
        ? `Leave ${count} st unworked, turn.`
        : `Leave the last ${sts(count)} of the row unworked and turn, ready to work back.`,
    holdRepeatBack: (count) =>
      terse
        ? `Rpt, leaving ${count} st each time, to the end of the shoulder.`
        : `Repeat the last two instructions, leaving ${sts(count)} unworked each time, until every shoulder stitch has been left unworked.`,
    mitreHeading: () =>
      terse
        ? 'Shaping the V point. Mark the centre stitch.'
        : 'Shaping the point of the V. Before you begin, mark the stitch at the exact centre front of the band — the shaping runs down either side of it and it must not be lost.',
    mitreWork: (_rc, count) =>
      // Both registers must describe the SAME operation. The terse wording used to say
      // "dec 1 st each side of the centre stitch", which is a different thing: two
      // separate decreases flanking the centre leave the centre stitch unconsumed and
      // give two shaping lines instead of the single unbroken one a mitre wants.
      terse
        ? `Work a centred double decrease at the marked centre st every other row, ${plural(count, 'time')}.`
        : `Work a centred double decrease at the marked centre stitch on every other row, ${plural(count, 'time')} in all, so the centre stitch rides over the top as an unbroken line down the point of the V.`,
    mitreMeetNote: () => '',
    crossoverTitle: () => '',
    crossoverBody: () => '',
    takeOff: (n) =>
      terse ? `Slip all ${n} st onto a holder.` : `Slip all ${sts(n)} onto a holder, leaving them live.`,
    bandCastOff: (n) =>
      terse
        ? `Cast off all ${n} st loosely in rib.`
        : `Cast off all ${sts(n)} loosely in rib — a tight cast-off here will stop the neck going over the head.`,
    // A picked-up band is worked straight onto the neckline, so there is nothing to
    // ease on and no seam for a marker to line up with.
    markWaypoints: () => '',
  };
}

function vocabFor(style: ProseStyle, technique: Technique = 'machine', units: Units = 'in'): Vocab {
  if (technique === 'hand') return handVocab(style, units);
  return style === 'abbreviated' ? TERSE : VERBOSE;
}

// ---------------------------------------------------------------------------
// Grouping a regular/graduated shaping run into phases for the "Repeat" line.
// ---------------------------------------------------------------------------

interface Phase {
  start: number;
  end: number;
  count: number;
  minStep: number;
  maxStep: number;
}

function stepSpan(nums: number[], rows: number[]): { min: number; max: number } {
  let min = Infinity;
  let max = -Infinity;
  for (let k = 1; k < rows.length; k++) {
    const d = nums[rows[k]] - nums[rows[k - 1]];
    if (d < min) min = d;
    if (d > max) max = d;
  }
  return Number.isFinite(min) ? { min, max } : { min: 0, max: 0 };
}

/**
 * Split a rising sequence of counter readings into phases. Evenly spread shaping
 * rounds to whole rows, so "every 7th" is really 7s and 8s — that jitter reads as
 * one phase. A genuine change of pace (every row, then every 2nd, then every 4th)
 * stays separate. Adjacent stretches merge only when their whole interval band is
 * within one row AND never drops to every-row. Rows never overlap between phases.
 */
function toPhases(nums: number[]): Phase[] {
  if (nums.length === 1) {
    return [{ start: nums[0], end: nums[0], count: 1, minStep: 0, maxStep: 0 }];
  }
  const runs: number[][] = [[0]];
  let lastStep: number | undefined;
  for (let k = 1; k < nums.length; k++) {
    const step = nums[k] - nums[k - 1];
    if (lastStep === undefined || step === lastStep) runs[runs.length - 1].push(k);
    else runs.push([k]);
    lastStep = step;
  }
  const merged: number[][] = [];
  for (const run of runs) {
    const last = merged[merged.length - 1];
    if (last) {
      const span = stepSpan(nums, last.concat(run));
      if (span.max - span.min <= 1 && span.min >= 2) {
        merged[merged.length - 1] = last.concat(run);
        continue;
      }
    }
    merged.push(run.slice());
  }
  return merged.map((rows) => {
    const span = stepSpan(nums, rows);
    return {
      start: nums[rows[0]],
      end: nums[rows[rows.length - 1]],
      count: rows.length,
      minStep: rows.length === 1 ? 0 : span.min,
      maxStep: rows.length === 1 ? 0 : span.max,
    };
  });
}

/**
 * The "Repeat …" line for a phase of two or more rows. A regular interval collapses
 * to "every Nth row" wording; an irregular (evenly spread) run is enumerated counter
 * by counter — "every 7th or 8th" is too vague to knit to.
 */
function repeatLine(p: Phase, counters: number[], v: Vocab): string {
  if (p.count === 2) return v.repeatOnce(p.end, p.count);
  if (p.minStep === 1 && p.maxStep === 1) return v.repeatRange(p.start + 1, p.end, p.count);
  if (p.minStep === p.maxStep) {
    const rest: string[] = [];
    for (let val = p.start + p.minStep; val <= p.end; val += p.minStep) rest.push(pad(val));
    return v.repeatEvery(p.minStep, rest, p.count);
  }
  const rest = counters.filter((c) => c > p.start).map(pad);
  return v.repeatAt(rest, p.count);
}

// ---------------------------------------------------------------------------
// Per-row classification.
// ---------------------------------------------------------------------------

type Kind =
  | 'plain'
  | 'cast_on'
  | 'pick_up'
  | 'co_center'
  | 'co_edge'
  | 'dec_both'
  | 'dec_edge'
  | 'gather'
  | 'mitre'
  | 'inc_both'
  | 'hold'
  | 'take_off'
  | 'mark';

interface Ev {
  row: Row;
  kind: Kind;
  op?: Op;
}

function classify(row: Row): Ev {
  if (row.ops.length === 0) return { row, kind: 'plain' };
  const op = row.ops[0]; // the piece generators put one shaping op per row
  switch (op.kind) {
    case 'cast_on':
      return { row, kind: 'cast_on', op };
    case 'pick_up':
      return { row, kind: 'pick_up', op };
    case 'bind_off':
      return { row, kind: op.side === 'center' ? 'co_center' : 'co_edge', op };
    case 'decrease':
      // The V-neckband mitres both ends with edge decreases (section 'mitre'); a
      // frill gathers the whole row (side 'across'); every other decrease is
      // ordinary edge/both shaping.
      if (row.section === 'mitre') return { row, kind: 'mitre', op };
      if (op.side === 'across') return { row, kind: 'gather', op };
      return { row, kind: op.side === 'both' ? 'dec_both' : 'dec_edge', op };
    case 'increase':
      return { row, kind: 'inc_both', op };
    case 'hold':
      return { row, kind: 'hold', op };
    case 'take_off':
      return { row, kind: 'take_off', op };
    case 'mark':
      return { row, kind: 'mark', op };
  }
}

function isResetBoundary(cur: Row, prev: Row | undefined): boolean {
  if (!prev) return false;
  // hem -> body change (rib or any other hem style). Not the band's own terminal rows
  // (its rib runs straight into the marker row then off on waste yarn — no change to
  // stocking stitch), and not a folded band's internal facing/turn/outer boundaries,
  // which share one counter run.
  if (
    HEM_END_SECTIONS.has(prev.section ?? '') &&
    !HEM_SECTIONS.has(cur.section ?? '') &&
    cur.section !== 'castoff' &&
    cur.section !== 'mark' &&
    cur.section !== 'take_off'
  )
    return true;
  if (cur.side && cur.side !== prev.side) return true;
  return false;
}

function neckish(section: string | undefined): boolean {
  return section === 'neck' || section === 'neck_split';
}

// ---------------------------------------------------------------------------
// The walk.
// ---------------------------------------------------------------------------

/**
 * What a piece needs beyond its rows. `gauge` and `units` exist for hand knitting:
 * a machine pattern counts rows off the dial and never needs a length, but a hand
 * pattern says "until the piece measures 35 cm", so lengths must be renderable.
 */
export interface PieceOpts {
  style?: ProseStyle;
  technique?: Technique;
  gauge?: Gauge;
  units?: Units;
}

export function renderPiece(
  rows: Row[],
  title: string,
  styleOrOpts: ProseStyle | PieceOpts = 'verbose',
): PieceProse {
  const o: PieceOpts = typeof styleOrOpts === 'string' ? { style: styleOrOpts } : styleOrOpts;
  const style = o.style ?? 'verbose';
  const technique = o.technique ?? 'machine';
  const v = vocabFor(style, technique, o.units ?? 'in');
  // Rows to inches, for the lengths hand prose measures to. Falls back to zero when
  // no gauge is supplied — machine prose never reads it.
  const rowIn = o.gauge ? 4 / o.gauge.bodyRow : 0;
  const lines: string[] = [];
  const evs = rows.map(classify);
  const announced = new Set<string>();

  let baseline = 0; // counter reading of a row = row.index - baseline
  const counter = (idx: number): number => idx - baseline;

  let prevCounter = 0; // last counter position we described
  let pending: { section?: string; last: Row } | null = null; // run of plain rows
  let lastLineWasPlain = false; // the previous emitted line was a plain-run instruction

  const flushPlain = (withCarriage: boolean): void => {
    if (!pending) return;
    const c = counter(pending.last.index);
    // Machine reads the counter, which is relative to the last reset. Hand measures
    // the fabric, which is absolute from the cast-on edge — so both are passed.
    const lengthIn = pending.last.index * rowIn;
    const sec = pending.section ?? '';
    const line =
      sec === 'rib'
        ? v.ribUntil(c, lengthIn)
        : sec === 'folded_turn'
          ? v.foldedTurn(c)
          : HEM_SECTIONS.has(sec)
            ? v.hemUntil(sec, c, lengthIn)
            : v.knitUntil(c, lengthIn, withCarriage ? pending.last.carriage : undefined);
    // Two plain runs can end up back to back once a register drops what sat between
    // them — a machine resets its counter there, a hand knitter has nothing to do. Two
    // consecutive "work until it measures X" lines read as a contradiction, and the
    // later one subsumes the earlier, so replace rather than append. Hem-section lines
    // are never subsumable: a folded band's facing, fold row and outer half are three
    // distinct instructions that happen to be plain rows.
    if (lastLineWasPlain && lines.length && lines[lines.length - 1] !== '') lines[lines.length - 1] = line;
    else say(line);
    lastLineWasPlain = !HEM_SECTIONS.has(sec);
    prevCounter = c;
    pending = null;
  };

  /** Push a line unless this register had nothing to say (an empty vocab result). */
  const say = (text: string): void => {
    if (text) lines.push(text);
    lastLineWasPlain = false;
  };

  const heading = (text: string): void => {
    if (!text) return;
    lines.push('');
    lines.push(text);
  };

  const maybeHeading = (row: Row): void => {
    const key = `${row.section}:${row.side ?? ''}`;
    if (announced.has(key)) return;
    switch (row.section) {
      case 'armhole':
        announced.add(key);
        heading('Shape the armholes.');
        say(v.marker());
        say(v.wsShapingNote());
        break;
      case 'cap':
        announced.add(key);
        heading('Shape the cap.');
        say(v.marker());
        say(v.wsShapingNote());
        break;
      case 'shoulder':
        announced.add(key);
        heading('Shape the shoulders.');
        say(v.setHold());
        break;
      case 'neck':
        if (row.side === 'left' || row.side === 'right') {
          announced.add(key);
          heading(
            technique === 'hand'
              ? // Named by working order, not by side: the work turns over every row,
                // so "left" would mean the knitter's left on one row and the other on
                // the next. First/second is true however the piece is facing.
                `Shape the neck on the ${announced.has('neckside') ? 'second' : 'first'} side.`
              : `Shape the ${sideWord(row.side === 'left' ? 'L' : 'R')} ${row.piece === 'back' ? 'back' : 'front'} neck.`,
          );
          announced.add('neckside');
        }
        break;
      default:
        break;
    }
  };

  let i = 0;
  while (i < evs.length) {
    const ev = evs[i];
    const row = ev.row;
    const prev = i > 0 ? evs[i - 1].row : undefined;

    if (isResetBoundary(row, prev)) {
      flushPlain(false);
      const prevSec = (prev as Row).section ?? '';
      const stocking = prevSec === 'rib';
      // At the change to stocking the rib's odd extra stitch is dropped on one side.
      // (count === 1 keeps a frill's gather-across from being mistaken for the drop.)
      const drop =
        stocking &&
        row.ops.length === 1 &&
        row.ops[0].kind === 'decrease' &&
        row.ops[0].count === 1 &&
        row.ops[0].side !== 'both'
          ? (row.ops[0] as { side: Carriage }).side
          : undefined;
      // say(), not a raw push: the line must clear the plain-run flag, or the next
      // "knit until" would subsume the reset instruction.
      say(
        stocking
          ? v.resetToStocking(drop, (prev as Row).carriage)
          : HEM_END_SECTIONS.has(prevSec)
            ? v.hemChange(prevSec, (prev as Row).carriage)
            : v.resetPlain((prev as Row).carriage),
      );
      // Starting the second (right) neck half: the parked side rejoins the work.
      if (row.side === 'right') say(v.rejoinRight());
      baseline = (prev as Row).index;
      prevCounter = 0;
      // A gathered sleeve cuff blooms on this row: a big increase-across to the fuller
      // sleeve (the rib's own odd-stitch drop is folded into the same row's count).
      const bloom = stocking && row.ops.some((o) => o.kind === 'increase' && o.side === 'across');
      if (bloom) {
        say(v.bloomAcross(row.stitches));
        say(v.stitchCount(row.stitches, false));
        pending = { section: row.section, last: row };
        i += 1;
        continue;
      }
      if (drop) {
        say(v.stitchCount(row.stitches, true));
        pending = { section: row.section, last: row }; // the drop is stated; body lead-in
        i += 1;
        continue;
      }
    }

    if (ev.kind === 'plain') {
      // A change of section mid-plain (body straight → the shoulder wait rows) is a
      // real "knit to length" boundary; flush before it.
      if (pending && pending.section !== row.section) flushPlain(true);
      // The integral boat band starts here: announce it and change to rib. (A boat has no
      // separate neckband — this band, worked on every stitch, IS the neck edge.)
      if (row.section === 'boat_band' && !announced.has('boat_band')) {
        announced.add('boat_band');
        heading('The boat neckband.');
        say(
          technique === 'hand'
            ? 'Change to the smaller (ribbing) needles and work the band in K1P1 rib.'
            : 'Change to the ribbing tension and work the band in K1P1 rib.',
        );
      }
      pending = { section: row.section, last: row };
      i += 1;
      continue;
    }

    // A shaping row. Flush a preceding plain run only if it was a different section.
    if (pending && pending.section !== row.section) flushPlain(true);
    else pending = null;

    if (ev.kind === 'cast_on') {
      const n = (ev.op as { count: number }).count;
      // The neckband is the same strip of stitches either way, but it arrives on the
      // needles differently. A machine casts it on separately and sews it to the
      // neckline afterwards, because picking a curved neck up onto the bed is awkward;
      // a hand knitter picks the stitches up straight off the neckline and carries on,
      // which is why the hand version needs no easing markers and no seam for the band.
      if (technique === 'hand' && row.piece === 'collar') say(v.pickUp(n));
      else if (technique === 'hand' && row.piece === 'armband') say(v.pickUpArmhole(n));
      else say(v.castOn(n, otherSide(row.carriage)));
      // The tension line follows the hem: rib (and the neckband, whose cast-on row is
      // its own section) keeps the historical rib-tension line; the other hem styles
      // speak their own; hem 'none' casts straight onto the body, where the only thing
      // worth saying is that the edge will roll.
      {
        const sec = row.section ?? '';
        // A stocking-stitch collar (rolled edge / cowl) casts on at main tension and rolls.
        if (sec === 'body' || sec === 'taper' || sec === 'stocking') say(v.noHemNote());
        else if (HEM_SECTIONS.has(sec) && sec !== 'rib') say(v.hemTension(sec));
        else say(v.ribTension());
      }
      say(v.setCounter());
      i += 1;
      continue;
    }

    if (ev.kind === 'pick_up') {
      const n = (ev.op as { count: number }).count;
      // A folded band's closing row picks its own cast-on edge up — a hem join, not
      // a band pickup, and no counter reset (the hem's run continues to the change).
      if (row.section === 'folded_join') {
        say(v.foldedJoin(n));
        i += 1;
        continue;
      }
      say(v.pickUp(n));
      say(v.ribTension());
      say(v.setCounter());
      prevCounter = 0;
      i += 1;
      continue;
    }

    if (ev.kind === 'gather') {
      const op = ev.op as { count: number };
      say(v.frillGather(op.count, row.stitches));
      say(v.stitchCount(row.stitches, false));
      pending = { section: row.section, last: row }; // the gather row starts the body run
      i += 1;
      continue;
    }

    if (ev.kind === 'mark') {
      say(v.markWaypoints((ev.op as { positions: number[] }).positions));
      prevCounter = counter(row.index);
      i += 1;
      continue;
    }

    if (ev.kind === 'take_off') {
      lines.push('');
      // The machine takes every piece off on waste yarn, the band included, because
      // the band is sewn on later. A hand knitter's band was picked up and worked in
      // place, so it is finished here — cast off, not held. Body pieces still hold
      // live, for the three-needle join at the shoulder.
      // Hand: a picked-up band is finished here — cast off, not held. The neckband's
      // cast-off warns about clearing the head; an armhole band takes a plainer note.
      if (technique === 'hand' && row.piece === 'collar')
        say(v.bandCastOff((ev.op as { count: number }).count));
      else if (technique === 'hand' && row.piece === 'armband')
        say(v.bindOffAll((ev.op as { count: number }).count));
      else say(v.takeOff((ev.op as { count: number }).count));
      i += 1;
      continue;
    }

    maybeHeading(row);

    if (ev.kind === 'hold') {
      i = renderHolds(evs, i, lines, counter, v);
      prevCounter = counter(evs[i - 1].row.index);
      continue;
    }

    if (ev.kind === 'mitre') {
      // The V-neckband mitre: an EDGE decrease at each end every row (knittable — no
      // mid-row transfers), tapering both ends so they seam into a point at the front.
      const mitreRows: Row[] = [];
      let j = i;
      while (j < evs.length && evs[j].kind === 'mitre') {
        mitreRows.push(evs[j].row);
        j += 1;
      }
      heading(v.mitreHeading());
      const last = counter(mitreRows[mitreRows.length - 1].index);
      say(v.mitreWork(last, mitreRows.length));
      say(v.stitchCount(mitreRows[mitreRows.length - 1].stitches, false));
      say(v.mitreMeetNote());
      prevCounter = last;
      i = j;
      continue;
    }

    if (ev.kind === 'co_center') {
      const c = counter(row.index);
      const n = (ev.op as { count: number }).count;
      switch (row.section) {
        case 'neck_split':
          say(v.divideNeck(c - prevCounter, c, n));
          say(v.parkRight());
          break;
        case 'cap':
          lines.push('');
          say(v.castingOff());
          say(v.bindOffRemainingCap(n));
          break;
        case 'castoff': // neckband
          lines.push('');
          say(v.castingOff());
          say(v.bindOffAll(n));
          break;
        default: // back neck
          lines.push('');
          say(v.castingOff());
          say(v.breakYarnGraft());
          say(v.bindOffCentre(n));
          say(v.takeShouldersEach(row.stitches / 2));
      }
      prevCounter = c;
      i += 1;
      continue;
    }

    if (ev.kind === 'co_edge') {
      const c = counter(row.index);
      const n = (ev.op as { count: number }).count;
      const side = (ev.op as { side: Carriage }).side;
      const action = neckish(row.section) ? v.actBindOffNeck(n) : v.actBindOffEdge(n, side);
      say(v.shapeLead(c - prevCounter, c, action));
      prevCounter = c;
      i += 1;
      continue;
    }

    // A phased shaping run (decrease / increase). Gather the same-kind rows,
    // absorbing plain gaps, then describe it phase by phase.
    const kind = ev.kind;
    const shapeRows: Row[] = [];
    let j = i;
    while (j < evs.length) {
      if (evs[j].kind === kind) {
        // Only a boundary BETWEEN shaping rows ends the group. Testing the first row
        // too meant that a shaping row which was itself a reset boundary broke the
        // loop immediately, leaving the group empty — which crashed on the stitch-count
        // checkpoint below, and would otherwise have spun forever, since j never
        // advanced past i. Reachable from the app: v-neck + drop shoulder at Baby 20",
        // Child 24" and Man 44", where the neck divides on the row the rib ends.
        if (j > i && isResetBoundary(evs[j].row, evs[j - 1]?.row)) break;
        shapeRows.push(evs[j].row);
        j += 1;
      } else if (evs[j].kind === 'plain') {
        let k = j;
        while (k < evs.length && evs[k].kind === 'plain') k += 1;
        if (k < evs.length && evs[k].kind === kind && !isResetBoundary(evs[k].row, evs[k - 1].row)) {
          j = k;
        } else break;
      } else break;
    }
    const allCounters = shapeRows.map((r) => counter(r.index));
    const carriageAt = new Map(shapeRows.map((r) => [counter(r.index), r.carriage]));
    // Right side is the odd row, working flat from a cast-on. A phase whose rows are
    // all one parity is worked wholly on that face; an every-row phase alternates.
    const facingOf = (p: Phase): Facing => {
      const covered = shapeRows.filter((r) => {
        const c = counter(r.index);
        return c >= p.start && c <= p.end;
      });
      const odd = covered.filter((r) => r.index % 2 === 1).length;
      if (odd === covered.length) return 'rs';
      if (odd === 0) return 'ws';
      return 'alternating';
    };
    const actionFor = (f: Facing): string =>
      kind === 'dec_both' ? v.actDecBoth(f) : kind === 'inc_both' ? v.actIncBoth(f) : v.actDecNeck(f);
    for (const p of toPhases(allCounters)) {
      say(v.shapeLead(p.start - prevCounter, p.start, actionFor(facingOf(p))));
      if (p.count > 1) {
        const inPhase = allCounters.filter((c) => c >= p.start && c <= p.end);
        lines.push(repeatLine(p, inPhase, v));
      }
      lines[lines.length - 1] += v.carr(carriageAt.get(p.end) as Carriage);
      prevCounter = p.end;
    }
    // Stitch-count checkpoint. A one-edge neck shaping works an off-centre half, so
    // it is not split left/right.
    say(v.stitchCount(shapeRows[shapeRows.length - 1].stitches, kind !== 'dec_edge'));
    i = j;
  }

  // For a V-neckband, the prose adds the crossed-over point as an alternative to the
  // mitre (see the memory notes). Extra info, not a construction fork.
  if (rows.some((r) => r.section === 'mitre')) {
    lines.push('');
    say(v.crossoverTitle());
    say(v.crossoverBody());
  }

  // Members with no equivalent in this register return an empty string (a hand knitter
  // has no carriage to report, no counter to reset). Drop those, and any blank run they
  // leave behind, so one register's absences do not punch holes in the other's layout.
  const tidied: string[] = [];
  for (const line of lines) {
    if (line === '' && (tidied.length === 0 || tidied[tidied.length - 1] === '')) continue;
    tidied.push(line);
  }
  while (tidied.length && tidied[tidied.length - 1] === '') tidied.pop();
  const p0 = rows[0]?.piece;
  const piece =
    p0 === 'back' ? 'back'
    : p0 === 'front' ? 'front'
    : p0 === 'collar' ? 'neckband'
    : p0 === 'armband' ? 'armband'
    : p0 === 'sleeve_l' || p0 === 'sleeve_r' ? 'sleeve'
    : undefined;
  return { title, lines: tidied, piece };
}

/**
 * Short-row shoulder holds.
 *
 *  - The back holds one group per side on every row (alternating), so a steady
 *    count collapses to "Repeat the last two instructions …".
 *  - A front half holds on one edge only, with a plain return row between each hold;
 *    a steady count collapses to a "Repeat … at row counts …" line, and the finished
 *    shoulder comes off onto waste yarn (see machine-holding-hole-rule).
 */
function renderHolds(
  evs: Ev[],
  start: number,
  lines: string[],
  counter: (idx: number) => number,
  v: Vocab,
): number {
  const holds: { count: number; side: Carriage; c: number; carriage: Carriage }[] = [];
  let i = start;
  // A split piece works one half's shoulder then the other; the halves carry a `side`
  // and must not be merged. Normally the second half opens with its own neck shaping,
  // which stops this run — but a flat neck has no neck shaping, so the two shoulders run
  // straight into each other. Stop at the change of half so each is rendered on its own.
  const half = evs[start].row.side;
  for (;;) {
    if (i >= evs.length) break;
    if (evs[i].kind === 'hold') {
      if (evs[i].row.side !== half) break;
      const op = evs[i].op as { count: number; side: Carriage };
      holds.push({ count: op.count, side: op.side, c: counter(evs[i].row.index), carriage: evs[i].row.carriage });
      i += 1;
    } else if (evs[i].kind === 'plain') {
      let k = i;
      while (k < evs.length && evs[k].kind === 'plain') k += 1;
      if (k < evs.length && evs[k].kind === 'hold' && evs[k].row.side === half) i = k;
      else break;
    } else break;
  }

  const say = (text: string): void => {
    if (text) lines.push(text);
  };
  const frontHalf = !!evs[start].row.side;
  const last = holds[holds.length - 1];
  let tail = holds.length - 1; // trailing holds sharing the last group's count
  while (tail > 0 && holds[tail - 1].count === last.count) tail -= 1;

  if (!frontHalf) {
    // Back: alternating sides, one hold per row. Show through the first pair of the
    // steady count, then repeat the pair.
    const showThrough = Math.min(tail + 1, holds.length - 1);
    for (let k = 0; k <= showThrough; k++) {
      say(v.holdGroup(holds[k].count, holds[k].side, holds[k].c));
    }
    if (showThrough < holds.length - 1) {
      say(v.holdRepeatBack(last.count, last.c, last.carriage));
    }
  } else {
    // Front half: one edge, a plain return between holds.
    for (let k = 0; k <= tail; k++) {
      say(v.holdGroup(holds[k].count, holds[k].side, holds[k].c));
    }
    if (tail < holds.length - 1) {
      const rest = holds.slice(tail + 1).map((h) => pad(h.c));
      say(v.repeatAt(rest, holds.length - tail));
    }
    say(v.takeShoulderThis(evs[start].row.stitches));
    say(v.breakYarnGraft());
  }
  return i;
}

// ---------------------------------------------------------------------------
// Whole-garment convenience.
// ---------------------------------------------------------------------------

export interface Pattern {
  pieces: PieceProse[];
}

/**
 * The Making Up section. Every piece comes off on waste yarn, so nothing is joined on
 * the machine — assembly happens here, and the order is specific to the neck and
 * shoulder style. The through-line: join all the shoulder seams but ONE (the right
 * front, left open), sew the neckband on from that open seam round to it, close the
 * last seam, then the sleeves, then the sides, then the ends.
 *
 * The shoulder step here joins only the two body shoulder seams — a set-in or drop
 * sleeve does not reach the neckband, so its arms go in later, at the armhole step.
 * (Raglan and saddle sleeves DO meet the neckband, so when they arrive their arm seams
 * join in this same going-round step, before the band — that's why it is built as its
 * own block.) A stretchy join is called out only where it matters — the neckband and
 * the armholes — with an example; other seams take any method.
 */

/**
 * Making up a hand-knitted garment. The order differs from the machine version because
 * the neckband is not a separate strip:
 *
 *  - Nothing comes off on waste yarn, so there is nothing to unpick. Shoulders and the
 *    back neck were left LIVE on holders.
 *  - Shoulders are joined with a three-needle cast off, worked straight from those live
 *    stitches. It makes a firmer, less bulky join than casting off and sewing, and a
 *    shoulder carries the weight of the garment. Grafting is deliberately not used here
 *    for the same reason — it gives a soft join.
 *  - The band is picked up around the finished neckline and worked in place, so there is
 *    no band to ease on, no markers to match to seams, and no band seam. That is why one
 *    shoulder is joined before the band and the other after: the open shoulder is what
 *    lets the neckline be worked flat, and closing it afterwards closes the band too.
 *
 * The V mitre is worked as the band is knitted (a centred double decrease down a marked
 * centre stitch), not seamed afterwards — so the machine version's "seam the mitred ends
 * at the centre front" step has no counterpart here.
 */
/**
 * The hand pattern's making-up comes in TWO parts, and the neckband sits between them.
 *
 * A hand knitter picks the band up off the neckline — which does not exist until a
 * shoulder is joined. Putting all of the making-up at the end (right for the machine,
 * whose band is knitted separately as its own strip) would mean the pattern could not
 * be worked from the first line to the last: you would reach the neckband with nothing
 * to pick up from. So blocking and the first shoulder come BEFORE the band, and the
 * rest — the second shoulder, which closes the band's ends with it, then sleeves, sides
 * and ends — comes after.
 */
function handBeforeBandProse(style: ProseStyle, shoulder: ShoulderStyle = 'set_in'): PieceProse {
  const verbose = style !== 'abbreviated';
  const lines: string[] = [];

  // A saddle has cast-off shoulders and no three-needle join: the neckline exists once the
  // straps are seamed to the shoulders, so that comes before the band is picked up.
  if (shoulder === 'saddle') {
    lines.push(
      verbose
        ? 'Block each piece to its schematic and let it dry before you go on. The shoulders are cast off; the neck stitches wait on their holders.'
        : 'Block all pieces to the schematic; let dry. Neck stitches wait on holders.',
    );
    lines.push('');
    lines.push(
      verbose
        ? 'Seam each sleeve strap to the front and back shoulders, easing it along the shoulder so the strap end sits at the neck. Leave the back edge of the right strap open so the band can be picked up and worked flat.'
        : 'Seam each strap to the front and back shoulders (strap end at the neck). Leave the right strap’s back edge open.',
    );
    lines.push('');
    lines.push(
      verbose
        ? 'The neckband is picked up from this neckline next; work it before closing the last strap.'
        : 'Pick up the neckband next, before closing the last strap.',
    );
    return { title: 'Joining the Straps', lines };
  }

  // Raglan: the neckline exists once the raglan seams are joined, so that comes before the
  // band; the last seam is left open so the band can be picked up and worked flat.
  if (shoulder === 'raglan') {
    lines.push(
      verbose
        ? 'Block each piece to its schematic and let it dry before you go on. The raglan tops are cast off; the front and back neck stitches wait on their holders.'
        : 'Block all pieces to the schematic; let dry. Neck stitches wait on holders.',
    );
    lines.push('');
    lines.push(
      verbose
        ? 'Join the raglan seams — each sleeve’s diagonal edges to the matching front and back edges (the same length, row for row). Leave the back edge of the right sleeve open so the band can be picked up and worked flat.'
        : 'Seam the raglan edges (row for row), sleeves to front and back. Leave the right sleeve’s back edge open.',
    );
    lines.push('');
    lines.push(
      verbose
        ? 'The neckband is picked up from this neckline next; work it before closing the last raglan seam.'
        : 'Pick up the neckband next, before closing the last raglan seam.',
    );
    return { title: 'Joining the Raglan Seams', lines };
  }

  lines.push(
    verbose
      ? 'Block each piece to the measurements on its schematic and let it dry before you go on. Leave the shoulder and neck stitches on their holders until you come to them.'
      : 'Block all pieces to the schematic measurements; let dry. Leave held stitches on their holders.',
  );
  if (verbose) {
    lines.push(
      'Work seams with the right sides together unless a step says otherwise, and join loosely enough that the seam stretches with the fabric.',
    );
  }
  lines.push('');
  lines.push(
    verbose
      ? 'Join one shoulder with a three-needle cast off: hold the front and back shoulder stitches on their needles with the right sides together, and cast them off together through both. Leave the other shoulder on its holders — it stays open so the neckband can be worked flat.'
      : 'Join one shoulder with a three-needle cast off. Leave the other open.',
  );
  lines.push('');
  lines.push(
    verbose
      ? 'The neckband is picked up from this neckline next, so work it before you close the second shoulder.'
      : 'Work the neckband next, before closing the second shoulder.',
  );
  return { title: 'Joining the First Shoulder', lines };
}

function handMakingUpProse(
  neck: NeckStyle,
  shoulder: ShoulderStyle,
  style: ProseStyle,
  sleeveless = false,
  backNeck: BackNeckStyle = 'scoop',
  collar: CollarStyle = 'single_band',
): PieceProse {
  const verbose = style !== 'abbreviated';
  const lines: string[] = [];
  const stretchy = 'a stretchy seam such as mattress stitch';

  // Boat: butt-seam the straight tops part way in from each armhole, leaving the centre
  // open. No separate neckband — the rib band is part of each piece.
  if (neck === 'boat') {
    lines.push(verbose ? 'Block both pieces to the schematic and let them dry.' : 'Block both pieces; let dry.');
    lines.push('');
    lines.push(
      verbose
        ? `Butt the shoulders: hold the front and back tops together and seam each shoulder in from the armhole to the point the schematic marks, ribbed band and all, leaving the wide centre open for the neck. Use ${stretchy}.`
        : `Butt-seam each shoulder in from the armhole to the marked point; leave the centre open.`,
    );
    lines.push('');
    if (shoulder === 'drop') {
      lines.push(
        verbose
          ? `Sew in the sleeves. Centre each sleeve's straight top edge on the shoulder seam and sew it to the straight armhole edge down each side, using ${stretchy}.`
          : `Sew in the sleeves: straight top to the armhole edge, centred on the shoulder seam.`,
      );
    } else {
      lines.push(
        verbose
          ? `Set in the sleeves. Ease each sleeve cap into its armhole, matching the cap top to the shoulder seam and the underarm cast-offs to each other, using ${stretchy}.`
          : `Set in the sleeves: ease each cap into its armhole, cap top to shoulder seam.`,
      );
    }
    lines.push('');
    lines.push(
      verbose
        ? 'Join the sides: seam each side and its sleeve underarm in one line, from the cuff to the hem.'
        : 'Join the sides: cuff to hem in one line each side.',
    );
    lines.push('');
    lines.push(verbose ? 'Darn in the ends along a seam on the wrong side, and press if the yarn takes it.' : 'Darn in the ends; press if the yarn allows.');
    return { title: 'Making Up', lines };
  }

  // Saddle: the straps were seamed and the band picked up before this (see "Joining the
  // Straps"); here the last strap is closed and the sleeves set in.
  if (shoulder === 'saddle') {
    lines.push(
      verbose
        ? 'Close the last strap: seam the back edge of the right strap to the back shoulder, taking the seam through the ends of the neckband so the band closes with it.'
        : 'Close the right strap to the back shoulder, through the band ends.',
    );
    lines.push('');
    lines.push(
      verbose
        ? `Set in the sleeves: ease each sleeve cap into its armhole below the strap, matching the underarm cast-offs, using ${stretchy}.`
        : `Set in the sleeve caps below the straps, underarm cast-offs together.`,
    );
    lines.push('');
    lines.push(
      verbose
        ? 'Join the sides: seam each side and its sleeve underarm in one line, from the cuff to the hem.'
        : 'Join the sides: cuff to hem in one line each side.',
    );
    lines.push('');
    lines.push(verbose ? 'Darn in the ends along a seam on the wrong side, and press if the yarn takes it.' : 'Darn in the ends; press if the yarn allows.');
    return { title: 'Making Up', lines };
  }

  // Raglan: the seams were joined and the band picked up before this (see "Joining the
  // Raglan Seams"); here the last raglan seam is closed and the sides seamed.
  if (shoulder === 'raglan') {
    lines.push(
      verbose
        ? 'Close the last raglan seam — the back edge of the right sleeve to the back — taking the seam through the ends of the neckband so the band closes with it.'
        : 'Close the last raglan seam (right sleeve to back), through the band ends.',
    );
    lines.push('');
    lines.push(
      verbose
        ? 'Join the sides: seam each side and its sleeve underarm in one line, from the cuff to the hem.'
        : 'Join the sides: cuff to hem in one line each side.',
    );
    lines.push('');
    lines.push(verbose ? 'Darn in the ends along a seam on the wrong side, and press if the yarn takes it.' : 'Darn in the ends; press if the yarn allows.');
    return { title: 'Making Up', lines };
  }

  if (neck === 'v') {
    lines.push(
      verbose
        ? 'The point of the V was shaped as you worked the band, so there is nothing to seam at the centre front.'
        : 'The V point is shaped in the band; nothing to seam at centre front.',
    );
    lines.push('');
  }

  // A square neck: the band is picked up around the neck, so the corners are shaped in
  // place as it is worked — a paired decrease at each corner stitch (KW's mitre).
  const squareCorners = (neck === 'square' ? 2 : 0) + (backNeck === 'square' ? 2 : 0);
  if (squareCorners > 0) {
    lines.push(
      verbose
        ? `Square neck: as you pick up and work the band, mitre each of the ${squareCorners} corners. Mark the corner stitch at each one; then on every right-side row work to two stitches before it, SSK, knit the corner stitch, K2tog — a paired decrease that pulls the band square around the corner and keeps it flat.`
        : `Square neck — mitre each of the ${squareCorners} corners as you work the band: on right-side rows, SSK before the corner st, K it, K2tog after.`,
    );
    lines.push('');
  }

  // The second shoulder, closing the band with it. 'none' has no band — the neck edge is just
  // finished; every other collar closes with the second shoulder, then takes its own finish.
  if (collar === 'none') {
    lines.push(
      verbose
        ? 'Join the second shoulder. There is no collar — finish the neck edge neatly (a row of single crochet or a tidy edge) so it does not stretch.'
        : 'Join the second shoulder. No collar — finish the neck edge neatly.',
    );
  } else {
    lines.push(
      verbose
        ? 'Join the second shoulder in the same way, taking the seam straight through the ends of the collar so the band closes with it.'
        : 'Join the second shoulder, through the band ends.',
    );
    for (const l of collarFinishLines(collar, verbose)) lines.push(l);
  }

  // 4 — sleeves (skipped for sleeveless; the bands are picked up after the sides close).
  if (!sleeveless) {
    lines.push('');
    if (shoulder === 'drop') {
      lines.push(
        verbose
          ? `Sew in the sleeves. Centre each sleeve's straight top edge on the shoulder seam and sew it to the straight armhole edge down each side, using ${stretchy}.`
          : `Sew in the sleeves: straight top to the armhole edge, centred on the shoulder seam.`,
      );
    } else {
      lines.push(
        verbose
          ? `Set in the sleeves. Ease each sleeve cap into its armhole, matching the top of the cap to the shoulder seam and the underarm cast-offs to each other, using ${stretchy}.`
          : `Set in the sleeves: ease each cap into its armhole, cap top to shoulder seam.`,
      );
    }
  }

  lines.push('');
  lines.push(
    sleeveless
      ? verbose
        ? 'Join the sides: seam each side from the base of the armhole down to the hem.'
        : 'Join the sides: armhole to hem each side.'
      : verbose
        ? 'Join the sides: seam each side and its sleeve underarm in one line, from the cuff to the hem.'
        : 'Join the sides: cuff to hem in one line each side.',
  );

  // Sleeveless: work each armhole band in place, now the armhole is a closed loop.
  if (sleeveless) {
    lines.push('');
    lines.push(
      verbose
        ? 'Work the two armhole bands (above): with each armhole now a closed loop, pick up around it from the underarm seam, work the band, and cast off loosely.'
        : 'Work the two armhole bands (above): pick up round each closed armhole, work, cast off loosely.',
    );
  }

  lines.push('');
  lines.push(
    verbose
      ? 'Darn in the ends along a seam or a row of stitches on the wrong side, and give the seams a final press if the yarn takes one.'
      : 'Darn in the ends; press the seams if the yarn allows.',
  );
  return { title: 'Making Up', lines };
}

/**
 * Collar-specific finishing lines, appended after the band is sewn on: a double band folds
 * to the inside, a rolled edge / cowl rolls, a turtleneck must clear the head. Single band and
 * the flat-necked funnel need nothing extra. ('none' is handled before the band step.)
 */
function collarFinishLines(collar: CollarStyle, verbose: boolean): string[] {
  switch (collar) {
    case 'double_band':
      return [
        verbose
          ? 'Fold the doubled band to the inside and stitch its live edge down to the neckline, enclosing a firm double-thickness band.'
          : 'Fold the doubled band inside; stitch the live edge to the neckline.',
      ];
    case 'rolled_edge':
      return [
        verbose
          ? 'The rolled collar is stocking stitch — leave it to roll to the outside (purl side out), or tack it lightly in place.'
          : 'Rolled collar: let it roll (purl side out), or tack lightly.',
      ];
    case 'cowl':
      return [
        verbose
          ? 'The cowl is a loose stocking drape — leave it to roll and fall softly; a looser gauge drapes more, a tighter one sits closer.'
          : 'Cowl: let it drape and roll; gauge sets how loose it falls.',
      ];
    case 'turtleneck':
      return [
        verbose
          ? 'Before you close the collar seam, check the turtleneck stretches easily over the head — cast off very loosely if it does not — then seam it, and it folds down when worn.'
          : 'Check the turtleneck clears the head (cast off loosely), then seam; it folds down.',
      ];
    default:
      return [];
  }
}

export function makingUpProse(
  neck: NeckStyle,
  shoulder: ShoulderStyle,
  style: ProseStyle = 'verbose',
  technique: Technique = 'machine',
  sleeveless = false,
  backNeck: BackNeckStyle = 'scoop',
  collar: CollarStyle = 'single_band',
): PieceProse {
  if (technique === 'hand') return handMakingUpProse(neck, shoulder, style, sleeveless, backNeck, collar);
  const verbose = style !== 'abbreviated';
  const lines: string[] = [];
  const stretchy = verbose ? 'a stretchy join (e.g. mattress stitch)' : 'stretchy join (e.g. mattress stitch)';

  // A boat is butt-seamed: the two straight tops meet edge to edge, seamed only part way
  // in from each armhole, and there is NO separate neckband (the band is part of each
  // piece). See the schematic for exactly how much of each shoulder to seam.
  if (neck === 'boat') {
    lines.push(
      verbose
        ? 'Block each piece to its schematic and let it dry; take the pieces off their waste yarn as you seam them.'
        : 'Block both pieces to the schematic; let dry.',
    );
    lines.push('');
    lines.push(
      verbose
        ? `Butt the shoulders. With the front and back top edges together (right sides facing), seam each shoulder in from the armhole, stopping where the schematic marks it and leaving the wide centre open for the neck. Seam the ribbed band edge to edge along with the shoulder. Use ${stretchy}.`
        : `Butt-seam each shoulder in from the armhole to the marked point; leave the centre open. ${cap(stretchy)}.`,
    );
    lines.push('');
    if (shoulder === 'drop') {
      lines.push(
        verbose
          ? `Sew in the sleeves. Centre each sleeve’s straight top edge on the shoulder seam and sew it to the straight armhole edge down each side. Use ${stretchy}.`
          : `Sew in the sleeves: straight top to the armhole edge, centred on the shoulder seam. ${cap(stretchy)}.`,
      );
    } else {
      lines.push(
        verbose
          ? `Set in the sleeves. Ease each sleeve cap into its armhole, lining the cap top up with the shoulder seam and the underarm cast-offs together. Use ${stretchy}.`
          : `Set in the sleeves: ease each cap into its armhole, cap top to shoulder seam. ${cap(stretchy)}.`,
      );
    }
    lines.push('');
    lines.push(
      verbose
        ? 'Join the sides: seam each side and its sleeve underarm in one line, from the cuff to the hem.'
        : 'Join the sides: cuff to hem in one line each side.',
    );
    lines.push('');
    lines.push(
      verbose
        ? 'Sew in all the loose ends along the wrong side, then give the seams a light press.'
        : 'Darn in the ends; press the seams if the yarn allows.',
    );
    return { title: 'Making Up', lines };
  }

  // A saddle has no shoulder-to-shoulder seam: each sleeve's strap bridges the shoulder,
  // seaming to the front and back shoulder cast-offs, and its end meets the neck. One
  // strap edge is left open so the band can be worked flat, then closed with it.
  if (shoulder === 'saddle') {
    lines.push(
      verbose
        ? 'Block each piece to its schematic and let it dry; take the pieces off their waste yarn as you seam them.'
        : 'Block all pieces to the schematic; let dry.',
    );
    lines.push('');
    lines.push(
      verbose
        ? `Seam the saddle straps to the shoulders. Sew each sleeve strap's two long edges to the front and back shoulder cast-offs, easing it along the shoulder so the strap end sits at the neck; use ${stretchy}. Leave the back edge of the right strap open for the band.`
        : 'Seam each saddle strap to the front and back shoulders; strap end at the neck. Leave the right strap’s back edge open.',
    );
    if (neck === 'v') {
      lines.push('');
      lines.push(verbose ? 'The V point was shaped in the band, so there is nothing to seam at the centre front.' : 'V point is in the band.');
    }
    lines.push('');
    lines.push(
      verbose
        ? `Sew the neckband on. Starting at the open right strap, ease the band's live edge round the neckline — back neck, each strap end and the front neck — and back to the start, matching each marker to its seam. Use ${stretchy} so the neck stretches over the head.`
        : `Sew the band on from the open right strap, round and back, markers to seams. ${cap(stretchy)}.`,
    );
    lines.push('');
    lines.push(
      verbose
        ? 'Close the right strap: seam its back edge to the back shoulder, closing the ends of the neckband with it.'
        : 'Close the right strap to the back shoulder (shuts the band ends).',
    );
    lines.push('');
    lines.push(
      verbose
        ? `Set in the sleeves. Ease each sleeve cap into its armhole below the strap, matching the underarm cast-offs to each other, using ${stretchy}.`
        : `Set in the sleeve caps below the straps, underarm cast-offs together. ${cap(stretchy)}.`,
    );
    lines.push('');
    lines.push(
      verbose
        ? 'Join the sides: seam each side and its sleeve underarm in one line, from the cuff to the hem.'
        : 'Join the sides: cuff to hem in one line each side.',
    );
    lines.push('');
    lines.push(verbose ? 'Darn in the ends along a seam on the wrong side, and press the seams if the yarn takes it.' : 'Darn in the ends; press if the yarn allows.');
    return { title: 'Making Up', lines };
  }

  // A raglan has four diagonal seams and no shoulder or set-in step: each sleeve's two
  // raglan edges seam to the front and back raglan edges. One is left open for the band.
  if (shoulder === 'raglan') {
    lines.push(
      verbose
        ? 'Block each piece to its schematic and let it dry; take the pieces off their waste yarn as you seam them.'
        : 'Block all pieces to the schematic; let dry.',
    );
    lines.push('');
    lines.push(
      verbose
        ? `Join the raglan seams. Sew each sleeve's diagonal raglan edges to the matching front and back edges — they are the same length, row for row — using ${stretchy}. Join every seam but the back edge of the right sleeve, left open for the band.`
        : 'Seam the raglan edges (row for row): each sleeve to front and back. Leave the right sleeve’s back edge open.',
    );
    lines.push('');
    lines.push(
      verbose
        ? `Sew the neckband on. Starting at the open raglan seam, ease the band's live edge round the neckline — back neck, each sleeve top and the front neck — and back to the start, matching each marker to its raglan seam. Use ${stretchy} so the neck stretches over the head.`
        : `Sew the band on from the open seam, round and back, markers to the raglan seams. ${cap(stretchy)}.`,
    );
    lines.push('');
    lines.push(
      verbose
        ? 'Close the last raglan seam (the right sleeve to the back), taking the seam through the ends of the neckband so the band closes with it.'
        : 'Close the last raglan seam (right sleeve to back), through the band ends.',
    );
    lines.push('');
    lines.push(
      verbose
        ? 'Join the sides: seam each side and its sleeve underarm in one line, from the cuff to the hem.'
        : 'Join the sides: cuff to hem in one line each side.',
    );
    lines.push('');
    lines.push(verbose ? 'Darn in the ends along a seam on the wrong side, and press the seams if the yarn takes it.' : 'Darn in the ends; press if the yarn allows.');
    return { title: 'Making Up', lines };
  }

  // Block first — everything goes together flatter and truer to size off the machine.
  lines.push(
    verbose
      ? 'Block each piece to the measurements on its schematic and let it dry before you start; take the pieces off their waste yarn only as you come to seam them.'
      : 'Block all pieces to the schematic measurements; let dry. Unpick the waste yarn as you seam each.',
  );
  if (verbose) {
    lines.push(
      'Several seaming methods will serve — mattress stitch, backstitch, an edge-to-edge join — and your machine manual shows how to work them and where each suits. Work with right sides together unless a step says otherwise.',
    );
  } else {
    lines.push('Right sides together unless noted.');
  }

  // 1 — join all shoulder seams but the right front (left open for the band).
  lines.push('');
  lines.push(
    verbose
      ? 'Join the left shoulder: seam the front-left shoulder to the back-left shoulder. Leave the right shoulder open for now.'
      : 'Join left shoulder (front-left to back-left). Leave the right shoulder open.',
  );

  // 2 — the neckband, in from the open shoulder and back to it. 'none' has no band — the neck
  // edge is just finished neatly.
  lines.push('');
  if (collar === 'none') {
    lines.push(
      verbose
        ? 'No collar: finish the neck edge neatly — a row of single crochet or a tidy cast-off keeps it from stretching.'
        : 'No collar: finish the neck edge neatly (single crochet or a tidy cast-off).',
    );
  } else {
    if (neck === 'v') {
      lines.push(
        verbose
          ? 'Seam the neckband’s two mitred ends together at the centre front, forming the point of the V.'
          : 'Seam the band’s mitred ends at centre front (the V point).',
      );
    }
    lines.push(
      verbose
        ? `Sew the collar on. Starting at the open right shoulder, ease the band’s live edge onto the neckline all the way round and back to the start, matching each marker to its seam. Use ${stretchy} so the neck still stretches over the head.`
        : `Sew the collar on from the open right shoulder, round and back to it, markers to seams. ${cap(stretchy)}.`,
    );
    for (const l of collarFinishLines(collar, verbose)) lines.push(l);
  }

  // A square neck turns right-angle corners the straight band cannot follow on its own —
  // mitre each corner in the seam so it turns squarely and lies flat. (Front square = 2
  // corners; a square back adds 2 more. See the neckline-shapes notes.)
  const squareCorners = (neck === 'square' ? 2 : 0) + (backNeck === 'square' ? 2 : 0);
  if (squareCorners > 0) {
    lines.push('');
    lines.push(
      verbose
        ? `The neck is square, with ${squareCorners} right-angle ${squareCorners === 2 ? 'corners' : 'corners'}. A straight band will not turn a corner flat, so mitre each one as you seam: at the corner, fold the band back on itself at 45° to form a neat mitre, easing the extra band into the fold, and stitch the fold down on the inside. Keep the corners crisp and symmetrical.`
        : `Square neck — mitre the band at each of the ${squareCorners} corners: fold a 45° tuck and stitch it down inside so the band turns square.`,
    );
  }

  // 3 — close the last (right) shoulder, shutting the band’s ends (no band ends for 'none').
  lines.push('');
  lines.push(
    collar === 'none'
      ? verbose
        ? 'Join the right shoulder: seam the front-right shoulder to the back-right shoulder.'
        : 'Join right shoulder (front-right to back-right).'
      : verbose
        ? 'Join the right shoulder: seam the front-right shoulder to the back-right shoulder, closing the ends of the collar.'
        : 'Join right shoulder (front-right to back-right); closes the band ends.',
  );

  // 4 — the sleeves into the armholes (the set-in vs drop difference lives here). A
  // sleeveless garment has no sleeve; its bands go on after the sides are closed (step 5).
  if (!sleeveless) {
    lines.push('');
    if (shoulder === 'drop') {
      lines.push(
        verbose
          ? `Sew in the sleeves. Centre each sleeve’s straight top edge on the shoulder seam and sew it to the straight armhole edge down each side. Use ${stretchy}.`
          : `Sew in the sleeves: straight top to the armhole edge, centred on the shoulder seam. ${cap(stretchy)}.`,
      );
    } else {
      lines.push(
        verbose
          ? `Set in the sleeves. Ease each sleeve cap into its armhole, lining the top of the cap up with the shoulder seam and the underarm cast-offs together. Use ${stretchy}.`
          : `Set in the sleeves: ease each cap into its armhole, cap top to shoulder seam. ${cap(stretchy)}.`,
      );
    }
  }

  // 5 — sides. A sleeved garment runs the side and the sleeve underarm in one line; a
  // sleeveless one seams the side alone, armhole to hem.
  lines.push('');
  lines.push(
    sleeveless
      ? verbose
        ? 'Join the sides: seam each side from the base of the armhole down to the hem.'
        : 'Join the sides: armhole to hem each side.'
      : verbose
        ? 'Join the sides: seam each side and its sleeve underarm in one line, from the cuff to the hem.'
        : 'Join the sides: cuff to hem in one line each side.',
  );

  // 5b — sleeveless: the armhole bands, once each armhole is a closed loop.
  if (sleeveless) {
    lines.push('');
    lines.push(
      verbose
        ? `Sew the armhole bands on. Starting at the underarm seam, ease each band’s live edge round its armhole and back to the start. Use ${stretchy} so the armhole still stretches.`
        : `Sew each armhole band on from the underarm, round and back. ${cap(stretchy)}.`,
    );
  }

  // 6 — finish.
  lines.push('');
  lines.push(verbose ? 'Sew in all the loose ends along the wrong side, then give the seams a light press.' : 'Sew in all ends.');

  return { title: 'Making Up', lines };
}


// ---------------------------------------------------------------------------
// The abbreviations key.
// ---------------------------------------------------------------------------

/**
 * Every abbreviation a pattern uses has to be defined in it — a knitter cannot be
 * assumed to share our shorthand, and a pattern is often read years after it is
 * printed, away from whatever explained it. This was missing from the machine output
 * too: the concise register has always emitted CO, BO and RC with nothing defining
 * them.
 *
 * Only what is actually used gets listed, so the key stays short and true: the verbose
 * machine register spells everything out and gets no key at all, while verbose HAND
 * still needs one, because ssk and k2tog are abbreviations however much prose surrounds
 * them.
 *
 * Definitions say how to work the thing, not just what the letters stand for. Expanding
 * "ssk" to "slip, slip, knit" tells you nothing about how to slip, and slipping purlwise
 * there twists the stitches — so the definitions describe the action and, where it
 * matters, which way the result leans.
 */
interface Abbrev {
  abbr: string;
  /** Matched against the rendered lines to decide whether it earns a place. */
  re: RegExp;
  def: string;
}

const ABBREVS: Abbrev[] = [
  // Shared shorthand.
  { abbr: 'st, sts', re: /\b\d+ sts?\b/, def: 'stitch, stitches' },
  { abbr: 'CO', re: /\bCO\b/, def: 'cast on' },
  { abbr: 'BO', re: /\bBO\b/, def: 'cast off' },
  { abbr: 'dec', re: /\bdec\b/, def: 'decrease' },
  { abbr: 'inc', re: /\binc\b/, def: 'increase' },
  { abbr: 'Kn', re: /\bKn\b/, def: 'knit' },
  { abbr: 'Rpt', re: /\bRpt\b/, def: 'repeat' },
  { abbr: 'st st', re: /\bst st\b/, def: 'stocking stitch' },

  // Machine only — the bed does not move, so its left and right are fixed places.
  { abbr: 'RC', re: /\bRC\b/, def: 'row counter — the reading on the machine’s counter' },
  { abbr: 'COL', re: /\bCOL\b/, def: 'carriage on the left at the end of the row' },
  { abbr: 'COR', re: /\bCOR\b/, def: 'carriage on the right at the end of the row' },
  { abbr: 'MT', re: /\bMT\b/, def: 'main tension — the tension setting your tension swatch was knitted at' },
  { abbr: 'MT-2', re: /\bMT-2\b/, def: 'main tension, less 2 whole numbers on the dial' },
  { abbr: 'LH, RH', re: /\b[LR]H\b/, def: 'the left-hand and right-hand ends of the needle bed' },

  // Hand only — the work turns every row, so these describe faces and leans.
  { abbr: 'RS, WS', re: /\bRS\b|\bWS\b|right-side row|wrong-side row/, def: 'right side and wrong side — the two faces of the fabric' },
  {
    abbr: 'ssk',
    re: /\bssk\b/,
    def: 'slip 2 stitches separately knitwise, then knit them together through the back loops. Leans left.',
  },
  {
    abbr: 'k2tog',
    re: /\bk2tog\b/,
    def: 'knit 2 stitches together. Leans right.',
  },
  {
    abbr: 'p2tog',
    re: /\bp2tog\b/,
    def: 'purl 2 stitches together. Leans right when seen from the knit face.',
  },
  {
    abbr: 'ssp',
    re: /\bssp\b/,
    def: 'slip 2 stitches separately knitwise, return them to the left needle, then purl them together through the back loops. Leans left when seen from the knit face.',
  },
  {
    abbr: 'centred double decrease',
    re: /centred double decrease/i,
    def: 'slip 2 stitches together knitwise, knit 1, then pass the 2 slipped stitches over. Takes 3 stitches to 1 and does not lean — the centre stitch rides over the top.',
  },
  {
    abbr: 'three-needle cast off',
    re: /three-needle cast off/i,
    def: 'with two sets of live stitches on their needles and the right sides together, knit one from each needle together and cast off as you go, joining and finishing the edge in one pass.',
  },
];

/**
 * The key for a rendered pattern — only the abbreviations it actually contains.
 * Returns null when the prose spells everything out, which is the usual case for the
 * verbose machine register.
 */
export function abbreviationsProse(pieces: PieceProse[], style: ProseStyle = 'verbose'): PieceProse | null {
  const haystack = pieces.flatMap((p) => p.lines).join('\n');
  const used = ABBREVS.filter((a) => a.re.test(haystack));
  if (used.length === 0) return null;
  const lines =
    style === 'abbreviated'
      ? used.map((a) => `${a.abbr} — ${a.def}`)
      : ['These are the only abbreviations this pattern uses.', '', ...used.map((a) => `${a.abbr} — ${a.def}`)];
  return { title: 'Abbreviations', lines };
}

/** The heading a collar's piece is given — named for what the knitter recognises. */
function collarTitle(collar: CollarStyle): string {
  switch (collar) {
    case 'turtleneck':
      return 'The Turtleneck';
    case 'funnel':
      return 'The Funnel Collar';
    case 'cowl':
      return 'The Cowl';
    case 'rolled_edge':
      return 'The Rolled Collar';
    case 'double_band':
      return 'The Neckband (doubled)';
    default:
      return 'Neckband';
  }
}

export function renderPattern(
  garment: {
    back: Row[];
    front: Row[];
    sleeveLeft: Row[];
    armholeBand?: Row[];
    neckband: Row[];
    neck: NeckStyle;
    backNeck?: BackNeckStyle;
    shoulder: ShoulderStyle;
    collar?: CollarStyle;
  },
  styleOrOpts: ProseStyle | PieceOpts = 'verbose',
): Pattern {
  const o: PieceOpts = typeof styleOrOpts === 'string' ? { style: styleOrOpts } : styleOrOpts;
  const style = o.style ?? 'verbose';
  const technique = o.technique ?? 'machine';
  const sleeveless = !!garment.armholeBand && garment.sleeveLeft.length === 0;
  // A boat's front and back are the same straight-topped piece with an integral band, so
  // it is written once ("make 2 alike") and there is no separate neckband piece.
  const boat = garment.neck === 'boat';
  const body = boat
    ? [
        renderPiece(garment.back, 'The Back and Front (make 2 alike)', o),
        renderPiece(garment.sleeveLeft, 'The Sleeves (make 2)', o),
      ]
    : [
        renderPiece(garment.back, 'The Back', o),
        renderPiece(garment.front, 'The Front', o),
        // Sleeveless swaps the sleeve piece for an armhole band, worked twice.
        sleeveless
          ? renderPiece(garment.armholeBand!, 'The Armhole Bands (make 2)', o)
          : renderPiece(garment.sleeveLeft, 'The Sleeves (make 2)', o),
      ];
  const collar = garment.collar ?? 'single_band';
  const makingUp = makingUpProse(garment.neck, garment.shoulder, style, technique, sleeveless, garment.backNeck, collar);
  // A hand knitter picks the band up off a neckline that only exists once a shoulder is
  // joined, so that join has to precede the band for the pattern to be workable in
  // order. A machine band is a separate strip, so all of its making-up waits to the end.
  // A boat has no separate band at all, and 'none' has no band either — an empty neckband.
  const noBand = boat || garment.neckband.length === 0;
  const band = noBand ? null : renderPiece(garment.neckband, collarTitle(collar), o);
  const pieces = noBand
    ? [...body, makingUp]
    : technique === 'hand'
      ? [...body, handBeforeBandProse(style, garment.shoulder), band!, makingUp]
      : [...body, band!, makingUp];
  // Built from the finished prose, so it can only ever list what is really there.
  const key = abbreviationsProse(pieces, style);
  return { pieces: key ? [...pieces, key] : pieces };
}

export function patternText(pattern: Pattern): string {
  const out: string[] = [];
  for (const piece of pattern.pieces) {
    out.push(piece.title);
    out.push('');
    out.push(...piece.lines);
    out.push('');
  }
  return out.join('\n').replace(/\n{3,}/g, '\n\n');
}
