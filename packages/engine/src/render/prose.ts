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
import type { NeckStyle, ShoulderStyle } from '../data/types';

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

interface Vocab {
  carr(side: Carriage): string; // carriage-position suffix (leading space)
  castOn(n: number, carriageEnd: Carriage): string;
  ribTension(): string;
  setCounter(): string;
  ribUntil(rc: number): string;
  resetToStocking(drop: Carriage | undefined, carriage: Carriage): string;
  resetPlain(carriage: Carriage): string;
  rejoinRight(): string;
  stitchCount(n: number, split: boolean): string;
  knitUntil(rc: number, carriage?: Carriage): string;
  marker(): string;
  shapeLead(gap: number, rc: number, action: string): string;
  actDecBoth(): string;
  actIncBoth(): string;
  actDecNeck(): string;
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
  ribUntil: (rc) =>
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
  knitUntil: (rc, carriage) =>
    `Knit until the row counter reads ${pad(rc)}.` + (carriage ? VERBOSE.carr(carriage) : ''),
  marker: () =>
    'Hang a marker of contrast yarn on the right and left edge stitches; the markers line up when you set the sleeve into the armhole.',
  shapeLead: (gap, rc, action) =>
    `Knit ${gap === 1 ? '1 row' : `${gap} rows`} to row counter ${pad(rc)}, then ${action}.`,
  actDecBoth: () => 'decrease 1 stitch at either end of the row',
  actIncBoth: () => 'increase 1 stitch at either end of the row',
  actDecNeck: () => 'decrease 1 stitch at the neck edge',
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
  ribUntil: (rc) => `Work your rib to RC ${pad(rc)}. Mock rib: see machine manual.`,
  resetToStocking: (drop, carriage) =>
    'RC to 000, change to st st, set to MT' +
    (drop ? `, dec 1 st at ${edgeT(drop)}.` : '.') +
    TERSE.carr(carriage),
  resetPlain: (carriage) => `RC to 000.${TERSE.carr(carriage)}`,
  rejoinRight: () => 'Return R side to needles, rejoin yarn.',
  stitchCount: (n, split) => (split ? `${n} st ${splitT(n)}.` : `${n} st.`),
  knitUntil: (rc, carriage) => `Kn to RC ${pad(rc)}.` + (carriage ? TERSE.carr(carriage) : ''),
  marker: () => 'Hang marker on R and L edge sts (line up when setting in the sleeve).',
  shapeLead: (_gap, rc, action) => `Kn to RC ${pad(rc)}, then ${action}.`,
  actDecBoth: () => 'dec 1 st at either end',
  actIncBoth: () => 'inc 1 st at either end',
  actDecNeck: () => 'dec 1 st at neck edge',
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
  markWaypoints: (positions) =>
    `Hang a contrast marker at ${andList(positions.map((p) => `st ${p}`))} (band meets the shoulder ${
      positions.length > 1 ? 'seams' : 'seam'
    }; match markers to seams to ease in).`,
  foldedTitle: () => 'Alt band — mock rib / folded.',
  foldedBody: () =>
    'Mock rib or doubled band: knit twice the rows plain (or mock rib), pick the first row up (spare needles, or the last row for a plain band) to fold in half, take both off together on waste yarn. Sew on as before.',
};

function vocabFor(style: ProseStyle): Vocab {
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

export function renderPiece(rows: Row[], title: string, style: ProseStyle = 'verbose'): PieceProse {
  const v = vocabFor(style);
  const lines: string[] = [];
  const evs = rows.map(classify);
  const announced = new Set<string>();

  let baseline = 0; // counter reading of a row = row.index - baseline
  const counter = (idx: number): number => idx - baseline;

  let prevCounter = 0; // last counter position we described
  let pending: { section?: string; last: Row } | null = null; // run of plain rows

  const flushPlain = (withCarriage: boolean): void => {
    if (!pending) return;
    const c = counter(pending.last.index);
    if (pending.section === 'rib') lines.push(v.ribUntil(c));
    else lines.push(v.knitUntil(c, withCarriage ? pending.last.carriage : undefined));
    prevCounter = c;
    pending = null;
  };

  const heading = (text: string): void => {
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
        lines.push(v.marker());
        break;
      case 'cap':
        announced.add(key);
        heading('Shape the cap.');
        lines.push(v.marker());
        break;
      case 'shoulder':
        announced.add(key);
        heading('Shape the shoulders.');
        lines.push(v.setHold());
        break;
      case 'neck':
        if (row.side === 'left' || row.side === 'right') {
          announced.add(key);
          heading(`Shape the ${sideWord(row.side === 'left' ? 'L' : 'R')} ${row.piece === 'back' ? 'back' : 'front'} neck.`);
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
      if (row.side === 'right') lines.push(v.rejoinRight());
      baseline = (prev as Row).index;
      prevCounter = 0;
      if (drop) {
        lines.push(v.stitchCount(row.stitches, true));
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
      lines.push(v.castOn(n, otherSide(row.carriage)));
      lines.push(v.ribTension());
      lines.push(v.setCounter());
      i += 1;
      continue;
    }

    if (ev.kind === 'pick_up') {
      const n = (ev.op as { count: number }).count;
      lines.push(v.pickUp(n));
      lines.push(v.ribTension());
      lines.push(v.setCounter());
      prevCounter = 0;
      i += 1;
      continue;
    }

    if (ev.kind === 'mark') {
      lines.push(v.markWaypoints((ev.op as { positions: number[] }).positions));
      prevCounter = counter(row.index);
      i += 1;
      continue;
    }

    if (ev.kind === 'take_off') {
      lines.push('');
      lines.push(v.takeOff((ev.op as { count: number }).count));
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
      lines.push(v.mitreWork(last, mitreRows.length));
      lines.push(v.stitchCount(mitreRows[mitreRows.length - 1].stitches, false));
      lines.push(v.mitreMeetNote());
      prevCounter = last;
      i = j;
      continue;
    }

    if (ev.kind === 'co_center') {
      const c = counter(row.index);
      const n = (ev.op as { count: number }).count;
      switch (row.section) {
        case 'neck_split':
          lines.push(v.divideNeck(c - prevCounter, c, n));
          lines.push(v.parkRight());
          break;
        case 'cap':
          lines.push('');
          lines.push(v.castingOff());
          lines.push(v.bindOffRemainingCap(n));
          break;
        case 'castoff': // neckband
          lines.push('');
          lines.push(v.castingOff());
          lines.push(v.bindOffAll(n));
          break;
        default: // back neck
          lines.push('');
          lines.push(v.castingOff());
          lines.push(v.breakYarnGraft());
          lines.push(v.bindOffCentre(n));
          lines.push(v.takeShouldersEach(row.stitches / 2));
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
      lines.push(v.shapeLead(c - prevCounter, c, action));
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
        if (isResetBoundary(evs[j].row, evs[j - 1]?.row)) break;
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
    const action =
      kind === 'dec_both' ? v.actDecBoth() : kind === 'inc_both' ? v.actIncBoth() : v.actDecNeck();
    for (const p of toPhases(allCounters)) {
      lines.push(v.shapeLead(p.start - prevCounter, p.start, action));
      if (p.count > 1) {
        const inPhase = allCounters.filter((c) => c >= p.start && c <= p.end);
        lines.push(repeatLine(p, inPhase, v));
      }
      lines[lines.length - 1] += v.carr(carriageAt.get(p.end) as Carriage);
      prevCounter = p.end;
    }
    // Stitch-count checkpoint. A one-edge neck shaping works an off-centre half, so
    // it is not split left/right.
    lines.push(v.stitchCount(shapeRows[shapeRows.length - 1].stitches, kind !== 'dec_edge'));
    i = j;
  }

  // The neckband (it ends by coming off on waste yarn) carries its alternatives as
  // extra info: a mock-rib / folded band for any band, and — for a V — the crossed-over
  // point instead of the mitre. Neither is a construction fork (see the memory notes).
  if (rows.some((r) => r.section === 'take_off')) {
    lines.push('');
    lines.push(v.foldedTitle());
    lines.push(v.foldedBody());
    if (rows.some((r) => r.section === 'mitre')) {
      lines.push('');
      lines.push(v.crossoverTitle());
      lines.push(v.crossoverBody());
    }
  }

  return { title, lines };
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

  const frontHalf = !!evs[start].row.side;
  const last = holds[holds.length - 1];
  let tail = holds.length - 1; // trailing holds sharing the last group's count
  while (tail > 0 && holds[tail - 1].count === last.count) tail -= 1;

  if (!frontHalf) {
    // Back: alternating sides, one hold per row. Show through the first pair of the
    // steady count, then repeat the pair.
    const showThrough = Math.min(tail + 1, holds.length - 1);
    for (let k = 0; k <= showThrough; k++) {
      lines.push(v.holdGroup(holds[k].count, holds[k].side, holds[k].c));
    }
    if (showThrough < holds.length - 1) {
      lines.push(v.holdRepeatBack(last.count, last.c, last.carriage));
    }
  } else {
    // Front half: one edge, a plain return between holds.
    for (let k = 0; k <= tail; k++) {
      lines.push(v.holdGroup(holds[k].count, holds[k].side, holds[k].c));
    }
    if (tail < holds.length - 1) {
      const rest = holds.slice(tail + 1).map((h) => pad(h.c));
      lines.push(v.repeatAt(rest, holds.length - tail));
    }
    lines.push(v.takeShoulderThis(evs[start].row.stitches));
    lines.push(v.breakYarnGraft());
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
export function makingUpProse(
  neck: NeckStyle,
  shoulder: ShoulderStyle,
  style: ProseStyle = 'verbose',
): PieceProse {
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
  style: ProseStyle = 'verbose',
): Pattern {
  return {
    pieces: [
      renderPiece(garment.back, 'The Back', style),
      renderPiece(garment.front, 'The Front', style),
      renderPiece(garment.sleeveLeft, 'The Sleeves (make 2)', style),
      renderPiece(garment.neckband, 'Neckband', style),
      makingUpProse(garment.neck, garment.shoulder, style),
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
