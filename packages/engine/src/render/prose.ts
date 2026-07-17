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
  markPoint(): string;
  mitreWork(rc: number, count: number): string;
  crossoverTitle(): string;
  crossoverBody(): string;
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
    `Cast on ${n} stitches in rib ${splitV(n)}, ending with the carriage on the ${sideWord(ce)}. (Any rib pattern is fine — the count suits 1×1; adjust for 2×2 etc. to taste.)`,
  ribTension: () => 'Set the tension to main tension, minus 2 whole numbers.',
  setCounter: () => 'Set the row counter to 000.',
  ribUntil: (rc) => `Knit rib until the row counter reads ${pad(rc)}.`,
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
  mitreHeading: () => 'Mitre the front point.',
  markPoint: () =>
    'Mark the centre stitch — it sits at the base of the V, where the two front edges meet.',
  mitreWork: (rc, count) =>
    `On every row, work a centred double decrease at the marked stitch — decrease 1 stitch on each side of it, so the point column stays unbroken — until the row counter reads ${pad(
      rc,
    )} (${count} decrease rows in all). Keep the marker on the centre stitch as the point travels in.`,
  crossoverTitle: () => 'Alternative front point — crossed over.',
  crossoverBody: () =>
    'For a crossed-over point instead of the mitre, skip the centre decreases above: work all the picked-up stitches straight in rib for the same number of rows and cast off. Then lap the left band end over the right at the base of the V and stitch both ends down neatly on the inside. It is the more casual finish and the easier one to work flat.',
};

const TERSE: Vocab = {
  carr: (side) => ` ${corT(side)}.`,
  castOn: (n, ce) => `CO ${n} st in rib ${splitT(n)}, ${corT(ce)}.`,
  ribTension: () => 'Set to MT-2.',
  setCounter: () => 'RC to 000.',
  ribUntil: (rc) => `Rib to RC ${pad(rc)}.`,
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
  mitreHeading: () => 'Mitre front point.',
  markPoint: () => 'Mark centre st (base of V, where the front edges meet).',
  mitreWork: (rc, count) =>
    `Every row, centred double dec at marked st (dec 1 st each side) to RC ${pad(rc)} (${count}×), marker on centre st.`,
  crossoverTitle: () => 'Alt point — crossed over.',
  crossoverBody: () =>
    'For a crossed-over point: skip the centre dec, work all PU st straight in rib for the same rows, BO. Lap L band end over R at base of V, stitch down inside.',
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
  | 'hold';

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
      return {
        row,
        kind: op.side === 'both' ? 'dec_both' : op.side === 'center' ? 'mitre' : 'dec_edge',
        op,
      };
    case 'increase':
      return { row, kind: 'inc_both', op };
    case 'hold':
      return { row, kind: 'hold', op };
  }
}

function isResetBoundary(cur: Row, prev: Row | undefined): boolean {
  if (!prev) return false;
  // rib -> body change (but not rib straight into a final cast-off, e.g. a neckband).
  if (prev.section === 'rib' && cur.section !== 'rib' && cur.section !== 'castoff') return true;
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

    maybeHeading(row);

    if (ev.kind === 'hold') {
      i = renderHolds(evs, i, lines, counter, v);
      prevCounter = counter(evs[i - 1].row.index);
      continue;
    }

    if (ev.kind === 'mitre') {
      // The V-neckband mitre: a centred double decrease at the point every row.
      // Gather the run, mark the point, describe the first row, then repeat.
      const mitreRows: Row[] = [];
      let j = i;
      while (j < evs.length && evs[j].kind === 'mitre') {
        mitreRows.push(evs[j].row);
        j += 1;
      }
      heading(v.mitreHeading());
      lines.push(v.markPoint());
      const last = counter(mitreRows[mitreRows.length - 1].index);
      lines.push(v.mitreWork(last, mitreRows.length));
      lines.push(v.stitchCount(mitreRows[mitreRows.length - 1].stitches, false));
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

  // A mitred V-band offers the crossed-over point as an alternative finish (extra
  // info in the prose, not a construction fork — see vneck-band-both-finishes).
  if (rows.some((r) => r.section === 'mitre')) {
    lines.push('');
    lines.push(v.crossoverTitle());
    lines.push(v.crossoverBody());
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

export function renderPattern(
  garment: { back: Row[]; front: Row[]; sleeveLeft: Row[]; neckband: Row[] },
  style: ProseStyle = 'verbose',
): Pattern {
  return {
    pieces: [
      renderPiece(garment.back, 'The Back', style),
      renderPiece(garment.front, 'The Front', style),
      renderPiece(garment.sleeveLeft, 'The Sleeves (make 2)', style),
      renderPiece(garment.neckband, 'Neckband', style),
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
