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
import type { NeckStyle, ShoulderStyle, Technique, Units } from '../data/types';
import type { Gauge } from '../gauge';

export interface PieceProse {
  title: string;
  lines: string[];
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
  resetToStocking(drop: Carriage | undefined, carriage: Carriage): string;
  resetPlain(carriage: Carriage): string;
  rejoinRight(): string;
  stitchCount(n: number, split: boolean): string;
  knitUntil(rc: number, lengthIn: number, carriage?: Carriage): string;
  marker(): string;
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
  foldedTitle(): string;
  foldedBody(): string;
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
    `Cast on ${n} stitches ${splitV(n)}, ending with the carriage on the ${sideWord(ce)}.`,
  ribTension: () => 'Set the tension to main tension, minus 2 whole numbers.',
  setCounter: () => 'Set the row counter to 000.',
  ribUntil: (rc, _lengthIn) =>
    `Work in the rib pattern of your choice until the row counter reads ${pad(
      rc,
    )}. If you are knitting mock rib, follow your machine manual for how to work it.`,
  resetToStocking: (drop, carriage) =>
    'Reset the row counter to 000, change to stocking stitch, set the tension back to main tension' +
    (drop ? `, and decrease 1 stitch at the ${sideWord(drop)} hand edge.` : '.') +
    VERBOSE.carr(carriage),
  resetPlain: (carriage) => `Reset the row counter to 000.${VERBOSE.carr(carriage)}`,
  rejoinRight: () => 'Return the right side of the work to the needles and rejoin the yarn.',
  stitchCount: (n, split) =>
    split ? `There should be ${n} stitches ${splitV(n)}.` : `There should be ${n} stitches.`,
  knitUntil: (rc, _lengthIn, carriage) =>
    `Knit until the row counter reads ${pad(rc)}.` + (carriage ? VERBOSE.carr(carriage) : ''),
  marker: () =>
    'Hang a marker of contrast yarn on the right and left edge stitches; the markers line up when you set the sleeve into the armhole.',
  shapeLead: (gap, rc, action) =>
    `Knit ${gap === 1 ? '1 row' : `${gap} rows`} to row counter ${pad(rc)}, then ${action}.`,
  actDecBoth: (_rs) => 'decrease 1 stitch at either end of the row',
  actIncBoth: (_rs) => 'increase 1 stitch at either end of the row',
  actDecNeck: (_rs) => 'decrease 1 stitch at the neck edge',
  actBindOffEdge: (n, side) => `cast off ${n} stitches at the ${sideWord(side)} hand edge`,
  actBindOffNeck: (n) => `cast off ${n} stitches at the neck edge`,
  repeatOnce: (end, count) =>
    `Repeat the last instruction once more, at row counter ${pad(end)} (making a total of ${count} times).`,
  repeatRange: (a, b, count) =>
    `Repeat the last instruction for row counts ${pad(a)} to ${pad(b)} (making a total of ${count} times).`,
  repeatEvery: (step, list, count) =>
    `Repeat the last instruction on every ${ordinal(step)} row, at row counts ${andList(
      list,
    )} (making a total of ${count} times).`,
  repeatAt: (list, count) =>
    `Repeat the last instruction at row counts ${andList(list)} (making a total of ${count} times).`,
  divideNeck: (gap, rc, n) =>
    `Knit ${gap === 1 ? '1 row' : `${gap} rows`} to row counter ${pad(
      rc,
    )}, then cast off the centre ${n} stitches loosely to divide for the neck.`,
  parkRight: () => 'Put the right side of the work into hold; you will shape the left side first.',
  castingOff: () => 'Casting off.',
  breakYarnGraft: () => 'Break the yarn, leaving plenty of tail for grafting.',
  bindOffCentre: (n) => `Cast off the centre ${n} stitches loosely.`,
  bindOffRemainingCap: (n) => `Cast off the remaining ${n} stitches loosely to close the cap.`,
  bindOffAll: (n) => `Cast off all ${n} stitches loosely.`,
  takeShouldersEach: (n) =>
    `Take each shoulder off separately onto 5-6 rows of waste yarn. There should be ${n} stitches on each shoulder.`,
  takeShoulderThis: (n) =>
    `Take this shoulder off onto 5-6 rows of waste yarn. There should be ${n} stitches on this shoulder.`,
  pickUp: (n) => `Pick up and knit ${n} stitches evenly around the neck edge ${splitV(n)}.`,
  setHold: () => 'Set the carriage to hold.',
  holdGroup: (count, side, rc) =>
    `Bring ${count} needles at the ${sideWord(side)} into hold, then knit to row counter ${pad(rc)}.`,
  holdRepeatBack: (count, rc, carriage) =>
    `Repeat the last two instructions, holding ${count} needles each time, until the row counter reads ${pad(
      rc,
    )}.${VERBOSE.carr(carriage)}`,
  mitreHeading: () => 'Mitre the two ends.',
  mitreWork: (rc, count) =>
    `Working in the rib pattern of your choice, decrease 1 stitch at each end of every row until the row counter reads ${pad(
      rc,
    )} (${count} rows), tapering both ends to a diagonal.`,
  mitreMeetNote: () =>
    'These two mitred ends meet at the centre front; you seam them there when you make up, forming the point of the V.',
  crossoverTitle: () => 'Alternative front point — crossed over.',
  crossoverBody: () =>
    'For a crossed-over point instead of the mitre, work the band straight (no end shaping), then lap one end over the other at the centre front and stitch both down neatly on the inside. It is the more casual finish.',
  takeOff: (n) =>
    `Take all ${n} stitches off onto 5–6 rows of waste yarn — they stay live, ready to block and seam.`,
  bandCastOff: (n) => `Cast off all ${n} stitches loosely in rib.`,
  markWaypoints: (positions) =>
    `Hang a contrast-yarn marker at ${andList(positions.map((p) => `stitch ${p}`))} — this is where the band will meet the shoulder ${
      positions.length > 1 ? 'seams' : 'seam'
    }. Matching the markers to the seams keeps the band eased in evenly.`,
  foldedTitle: () => 'Alternative band — mock rib or a folded band.',
  foldedBody: () =>
    'To work the band in mock rib, or as a doubled band, knit twice as many rows in plain knitting (or mock rib). Then pick the first (cast-on) row up — onto spare needles, or, for a plain band, onto the needles holding the last row — so the band folds in half, and take both layers off together on the waste yarn. Sew on as before; the fold gives a neat, doubled edge.',
};

const TERSE: Vocab = {
  carr: (side) => ` ${corT(side)}.`,
  castOn: (n, ce) => `CO ${n} st ${splitT(n)}, ${corT(ce)}.`,
  ribTension: () => 'Set to MT-2.',
  setCounter: () => 'RC to 000.',
  ribUntil: (rc, _lengthIn) => `Work your rib to RC ${pad(rc)}. Mock rib: see machine manual.`,
  resetToStocking: (drop, carriage) =>
    'RC to 000, change to st st, set to MT' +
    (drop ? `, dec 1 st at ${edgeT(drop)}.` : '.') +
    TERSE.carr(carriage),
  resetPlain: (carriage) => `RC to 000.${TERSE.carr(carriage)}`,
  rejoinRight: () => 'Return R side to needles, rejoin yarn.',
  stitchCount: (n, split) => (split ? `${n} st ${splitT(n)}.` : `${n} st.`),
  knitUntil: (rc, _lengthIn, carriage) => `Kn to RC ${pad(rc)}.` + (carriage ? TERSE.carr(carriage) : ''),
  marker: () => 'Hang marker on R and L edge sts (line up when setting in the sleeve).',
  shapeLead: (_gap, rc, action) => `Kn to RC ${pad(rc)}, then ${action}.`,
  actDecBoth: (_rs) => 'dec 1 st at either end',
  actIncBoth: (_rs) => 'inc 1 st at either end',
  actDecNeck: (_rs) => 'dec 1 st at neck edge',
  actBindOffEdge: (n, side) => `BO ${n} st at ${edgeT(side)}`,
  actBindOffNeck: (n) => `BO ${n} st at neck edge`,
  repeatOnce: (end, count) => `Rpt instruction once more, at RC ${pad(end)} (total ${count} times).`,
  repeatRange: (a, b, count) =>
    `Rpt instruction for RC ${pad(a)} to ${pad(b)} (total ${count} times).`,
  repeatEvery: (step, list, count) =>
    `Rpt instruction every ${ordinal(step)} row, at RC ${andList(list)} (total ${count} times).`,
  repeatAt: (list, count) => `Rpt instruction at RC ${andList(list)} (total ${count} times).`,
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
  setHold: () => 'Set carriage to hold.',
  holdGroup: (count, side, rc) => `${count} N at ${side} into hold, then Kn to RC ${pad(rc)}.`,
  holdRepeatBack: (count, rc, carriage) =>
    `Rpt last 2 instructions, holding ${count} N each time, to RC ${pad(rc)}.${TERSE.carr(carriage)}`,
  mitreHeading: () => 'Mitre the two ends.',
  mitreWork: (rc, count) =>
    `In your chosen rib, dec 1 st at each end every row to RC ${pad(rc)} (${count} rows), tapering both ends.`,
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
  foldedTitle: () => 'Alt band — mock rib / folded.',
  foldedBody: () =>
    'Mock rib or doubled band: knit twice the rows plain (or mock rib), pick the first row up (spare needles, or the last row for a plain band) to fold in half, take both off together on waste yarn. Sew on as before.',
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
      terse ? `CO ${n} st.` : `Cast on ${n} stitches.`,
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
    stitchCount: (n) => (terse ? `${n} st.` : `There should be ${n} stitches.`),
    knitUntil: (_rc, lengthIn) =>
      terse ? `Work ${measure(lengthIn)}.` : `Continue in pattern ${measure(lengthIn)}.`,
    marker: () =>
      terse
        ? 'Mark each end of this row.'
        : 'Mark each end of this row with a contrast thread; the marks line up when you set the sleeve into the armhole.',
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
      terse ? `cast off ${n} st at the start of the row` : `cast off ${n} stitches at the beginning of the row`,
    actBindOffNeck: (n) =>
      terse ? `cast off ${n} st at the neck edge` : `cast off ${n} stitches at the neck edge`,
    repeatOnce: (_end, count) =>
      terse ? `Rpt once more (${count} times in all).` : `Repeat the last instruction once more (${count} times in all).`,
    repeatRange: (_a, _b, count) =>
      terse
        ? `Rpt on the next ${count - 1} rows (${count} times in all).`
        : `Repeat the last instruction on each of the next ${count - 1} rows (${count} times in all).`,
    repeatEvery: (step, _list, count) =>
      terse
        ? `Rpt every ${ordinal(step)} row, ${count} times in all.`
        : `Repeat the last instruction on every ${ordinal(step)} row until you have worked it ${count} times in all.`,
    repeatAt: (list, count) =>
      terse
        ? `Rpt ${count - 1} more times.`
        : `Repeat the last instruction ${count - 1} more times (${count} times in all).`,
    divideNeck: (gap, _rc, n) =>
      terse
        ? `Work ${gap === 1 ? '1 row' : `${gap} rows`}, then cast off the centre ${n} st to divide for the neck.`
        : `Work ${gap === 1 ? '1 row' : `${gap} rows`}, then cast off the centre ${n} stitches loosely to divide for the neck. Work each side separately from here.`,
    // Machine parks half the bed; by hand you slip the waiting stitches onto a holder.
    parkRight: () =>
      terse
        ? 'Slip the waiting stitches onto a holder.'
        : 'Slip the stitches of the second side onto a holder and leave them; you will work this side first.',
    castingOff: () => (terse ? 'Shaping the shoulder.' : 'Shaping the shoulder.'),
    breakYarnGraft: () =>
      terse ? 'Break the yarn, leaving a long tail.' : 'Break the yarn, leaving a tail long enough to join the shoulder.',
    bindOffCentre: (n) => (terse ? `Cast off the centre ${n} st loosely.` : `Cast off the centre ${n} stitches loosely.`),
    bindOffRemainingCap: (n) =>
      terse ? `Cast off the remaining ${n} st loosely.` : `Cast off the remaining ${n} stitches loosely to close the cap.`,
    bindOffAll: (n) => (terse ? `Cast off all ${n} st loosely.` : `Cast off all ${n} stitches loosely.`),
    // Shoulders are short-rowed, then left LIVE on a holder so the two can be joined
    // with a three-needle cast off. Grafting is not used here: it makes a soft join, and
    // a shoulder carries the weight of the garment.
    takeShouldersEach: (n) =>
      terse
        ? `Slip each shoulder onto its own holder — ${n} st each.`
        : `Slip each shoulder onto its own holder, leaving the stitches live. There should be ${n} stitches on each shoulder.`,
    takeShoulderThis: (n) =>
      terse
        ? `Slip this shoulder onto a holder — ${n} st.`
        : `Slip this shoulder onto a holder, leaving the stitches live. There should be ${n} stitches on this shoulder.`,
    pickUp: (n) =>
      terse
        ? `Pick up and knit ${n} st evenly round the neck.`
        : `With the right side facing, pick up and knit ${n} stitches evenly around the neck edge, working across the stitches held at the back and front as you come to them.`,
    setHold: () => '',
    // Short rows by hand: leave the stitches unworked and turn. Working the wrap in on
    // the following row is what closes the hole at the turn.
    holdGroup: (count) =>
      terse
        ? `Leave ${count} st unworked, turn.`
        : `Leave the last ${count} stitches of the row unworked and turn, ready to work back.`,
    holdRepeatBack: (count) =>
      terse
        ? `Rpt, leaving ${count} st each time, to the end of the shoulder.`
        : `Repeat the last two instructions, leaving ${count} stitches unworked each time, until every shoulder stitch has been left unworked.`,
    mitreHeading: () =>
      terse
        ? 'Shaping the V point. Mark the centre stitch.'
        : 'Shaping the point of the V. Before you begin, mark the stitch at the exact centre front of the band — the shaping runs down either side of it and it must not be lost.',
    mitreWork: (_rc, count) =>
      terse
        ? `Dec 1 st each side of the centre st every other row, ${count} times.`
        : `Work a centred double decrease at the marked centre stitch on every other row, ${count} times in all, so the centre stitch rides over the top as an unbroken line down the point of the V.`,
    mitreMeetNote: () => '',
    crossoverTitle: () => '',
    crossoverBody: () => '',
    takeOff: (n) =>
      terse ? `Slip all ${n} st onto a holder.` : `Slip all ${n} stitches onto a holder, leaving them live.`,
    bandCastOff: (n) =>
      terse
        ? `Cast off all ${n} st loosely in rib.`
        : `Cast off all ${n} stitches loosely in rib — a tight cast-off here will stop the neck going over the head.`,
    // A picked-up band is worked straight onto the neckline, so there is nothing to
    // ease on and no seam for a marker to line up with.
    markWaypoints: () => '',
    foldedTitle: () => '',
    foldedBody: () => '',
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
      // The V-neckband mitres both ends with edge decreases (section 'mitre'); every
      // other decrease is ordinary edge/both shaping.
      if (row.section === 'mitre') return { row, kind: 'mitre', op };
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
  // rib -> body change. Not the band's own terminal rows (its rib runs straight into
  // the marker row then off on waste yarn — no change to stocking stitch).
  if (
    prev.section === 'rib' &&
    cur.section !== 'rib' &&
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
    const line =
      pending.section === 'rib'
        ? v.ribUntil(c, lengthIn)
        : v.knitUntil(c, lengthIn, withCarriage ? pending.last.carriage : undefined);
    // Two plain runs can end up back to back once a register drops what sat between
    // them — a machine resets its counter there, a hand knitter has nothing to do. Two
    // consecutive "work until it measures X" lines read as a contradiction, and the
    // later one subsumes the earlier, so replace rather than append.
    if (lastLineWasPlain && lines.length && lines[lines.length - 1] !== '') lines[lines.length - 1] = line;
    else say(line);
    lastLineWasPlain = true;
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
        break;
      case 'cap':
        announced.add(key);
        heading('Shape the cap.');
        say(v.marker());
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
      const stocking = (prev as Row).section === 'rib';
      // At the change to stocking the rib's odd extra stitch is dropped on one side.
      const drop =
        stocking &&
        row.ops.length === 1 &&
        row.ops[0].kind === 'decrease' &&
        row.ops[0].side !== 'both'
          ? (row.ops[0] as { side: Carriage }).side
          : undefined;
      lines.push(
        stocking ? v.resetToStocking(drop, (prev as Row).carriage) : v.resetPlain((prev as Row).carriage),
      );
      // Starting the second (right) neck half: the parked side rejoins the work.
      if (row.side === 'right') say(v.rejoinRight());
      baseline = (prev as Row).index;
      prevCounter = 0;
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
      else say(v.castOn(n, otherSide(row.carriage)));
      say(v.ribTension());
      say(v.setCounter());
      i += 1;
      continue;
    }

    if (ev.kind === 'pick_up') {
      const n = (ev.op as { count: number }).count;
      say(v.pickUp(n));
      say(v.ribTension());
      say(v.setCounter());
      prevCounter = 0;
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
      if (technique === 'hand' && row.piece === 'collar') say(v.bandCastOff((ev.op as { count: number }).count));
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
    const indexAt = new Map(shapeRows.map((r) => [counter(r.index), r.index]));
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

  // The neckband (it ends by coming off on waste yarn) carries its alternatives as
  // extra info: a mock-rib / folded band for any band, and — for a V — the crossed-over
  // point instead of the mitre. Neither is a construction fork (see the memory notes).
  if (rows.some((r) => r.section === 'take_off')) {
    lines.push('');
    say(v.foldedTitle());
    say(v.foldedBody());
    if (rows.some((r) => r.section === 'mitre')) {
      lines.push('');
      say(v.crossoverTitle());
      say(v.crossoverBody());
    }
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
  return { title, lines: tidied };
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
  for (;;) {
    if (i >= evs.length) break;
    if (evs[i].kind === 'hold') {
      const op = evs[i].op as { count: number; side: Carriage };
      holds.push({ count: op.count, side: op.side, c: counter(evs[i].row.index), carriage: evs[i].row.carriage });
      i += 1;
    } else if (evs[i].kind === 'plain') {
      let k = i;
      while (k < evs.length && evs[k].kind === 'plain') k += 1;
      if (k < evs.length && evs[k].kind === 'hold') i = k;
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
function handMakingUpProse(neck: NeckStyle, shoulder: ShoulderStyle, style: ProseStyle): PieceProse {
  const verbose = style !== 'abbreviated';
  const lines: string[] = [];
  const stretchy = 'a stretchy seam such as mattress stitch';

  lines.push(
    verbose
      ? 'Block each piece to the measurements on its schematic and let it dry before you start. Leave the shoulder and neck stitches on their holders until you come to them.'
      : 'Block all pieces to the schematic measurements; let dry. Leave held stitches on their holders.',
  );
  if (verbose) {
    lines.push(
      'Work seams with the right sides together unless a step says otherwise, and join loosely enough that the seam stretches with the fabric.',
    );
  }

  // 1 — one shoulder, so the neckline can be worked as a single flat edge.
  lines.push('');
  lines.push(
    verbose
      ? 'Join one shoulder with a three-needle cast off: hold the front and back shoulder stitches on their needles with the right sides together, and cast them off together through both. Leave the other shoulder on its holders for now — it stays open so the neckband can be worked flat.'
      : 'Join one shoulder with a three-needle cast off. Leave the other open.',
  );

  // 2 — the band, worked in place.
  lines.push('');
  lines.push(
    verbose
      ? 'Work the neckband as given, picking the stitches up around the neckline with the right side facing and knitting across the held stitches as you reach them. Cast off loosely in rib — a tight cast-off here will stop the neck going over the head.'
      : 'Work the neckband as given, picking up round the neckline. Cast off loosely in rib.',
  );
  if (neck === 'v') {
    lines.push(
      verbose
        ? 'The point of the V is shaped as you work the band, so there is nothing to seam at the centre front.'
        : 'The V point is shaped in the band; nothing to seam at centre front.',
    );
  }

  // 3 — the second shoulder, closing the band with it.
  lines.push('');
  lines.push(
    verbose
      ? 'Join the second shoulder in the same way, taking the seam straight through the ends of the neckband so the band closes with it.'
      : 'Join the second shoulder, through the band ends.',
  );

  // 4 — sleeves.
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

  lines.push('');
  lines.push(
    verbose
      ? 'Join the sides: seam each side and its sleeve underarm in one line, from the cuff to the hem.'
      : 'Join the sides: cuff to hem in one line each side.',
  );

  lines.push('');
  lines.push(
    verbose
      ? 'Darn in the ends along a seam or a row of stitches on the wrong side, and give the seams a final press if the yarn takes one.'
      : 'Darn in the ends; press the seams if the yarn allows.',
  );
  return { title: 'Making Up', lines };
}

export function makingUpProse(
  neck: NeckStyle,
  shoulder: ShoulderStyle,
  style: ProseStyle = 'verbose',
  technique: Technique = 'machine',
): PieceProse {
  if (technique === 'hand') return handMakingUpProse(neck, shoulder, style);
  const verbose = style !== 'abbreviated';
  const lines: string[] = [];
  const stretchy = verbose ? 'a stretchy join (e.g. mattress stitch)' : 'stretchy join (e.g. mattress stitch)';

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

  // 2 — the neckband, in from the open shoulder and back to it.
  lines.push('');
  if (neck === 'v') {
    lines.push(
      verbose
        ? 'Seam the neckband’s two mitred ends together at the centre front, forming the point of the V.'
        : 'Seam the band’s mitred ends at centre front (the V point).',
    );
  }
  lines.push(
    verbose
      ? `Sew the neckband on. Starting at the open right shoulder, ease the band’s live edge onto the neckline all the way round and back to the start, matching each marker to its seam. Use ${stretchy} so the neck still stretches over the head.`
      : `Sew the band on from the open right shoulder, round and back to it, markers to seams. ${cap(stretchy)}.`,
  );

  // 3 — close the last (right) shoulder, shutting the band’s ends.
  lines.push('');
  lines.push(
    verbose
      ? 'Join the right shoulder: seam the front-right shoulder to the back-right shoulder, closing the ends of the neckband.'
      : 'Join right shoulder (front-right to back-right); closes the band ends.',
  );

  // 4 — the sleeves into the armholes (the set-in vs drop difference lives here).
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

  // 5 — sides + underarms in one line.
  lines.push('');
  lines.push(
    verbose
      ? 'Join the sides: seam each side and its sleeve underarm in one line, from the cuff to the hem.'
      : 'Join the sides: cuff to hem in one line each side.',
  );

  // 6 — finish.
  lines.push('');
  lines.push(verbose ? 'Sew in all the loose ends along the wrong side, then give the seams a light press.' : 'Sew in all ends.');

  return { title: 'Making Up', lines };
}

export function renderPattern(
  garment: {
    back: Row[];
    front: Row[];
    sleeveLeft: Row[];
    neckband: Row[];
    neck: NeckStyle;
    shoulder: ShoulderStyle;
  },
  styleOrOpts: ProseStyle | PieceOpts = 'verbose',
): Pattern {
  const o: PieceOpts = typeof styleOrOpts === 'string' ? { style: styleOrOpts } : styleOrOpts;
  return {
    pieces: [
      renderPiece(garment.back, 'The Back', o),
      renderPiece(garment.front, 'The Front', o),
      renderPiece(garment.sleeveLeft, 'The Sleeves (make 2)', o),
      renderPiece(garment.neckband, 'Neckband', o),
      makingUpProse(garment.neck, garment.shoulder, o.style ?? 'verbose', o.technique ?? 'machine'),
    ],
  };
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
