import { describe, it, expect } from 'vitest';
declare const console: { log: (...args: unknown[]) => void };
import { findSize } from '../data/sizes';
import { DEFAULT_GAUGE } from '../gauge';
import { assembleGarment } from '../pieces/garment';
import { renderPiece, renderPattern, patternText } from './prose';

const W36 = findSize('Woman', 36, 'in')!;
const G = DEFAULT_GAUGE;
const garment = assembleGarment(W36, 'moderate', G);
const back = renderPiece(garment.back, 'The Back');
const backT = renderPiece(garment.back, 'The Back', 'abbreviated');
const has = (piece: { lines: string[] }, text: string): boolean =>
  piece.lines.some((l) => l.includes(text));

describe('cast-on, tension and counter (verbose)', () => {
  it('casts on odd rib, sets rib tension, then the counter', () => {
    expect(back.lines[0]).toBe(
      'Cast on 145 stitches in 1x1 rib (72 left, 73 right), ending with the carriage on the right.',
    );
    expect(back.lines[1]).toBe('Set the tension to main tension, minus 2 whole numbers.');
    expect(back.lines[2]).toBe('Set the row counter to 000.');
    expect(has(back, 'Knit 1x1 rib until the row counter reads 025.')).toBe(true);
  });

  it('drops the odd stitch and resets tension at the change to stocking', () => {
    expect(has(back, 'Reset the row counter to 000, change to stocking stitch, set the tension back to main tension, and decrease 1 stitch at the right hand edge. The carriage should be on the left.')).toBe(true);
    expect(has(back, 'There should be 144 stitches (72 left, 72 right).')).toBe(true);
  });
});

describe('plain stretches read the dial', () => {
  it('never says "knit N rows" as a bare instruction', () => {
    for (const p of renderPattern(garment).pieces) {
      for (const l of p.lines) expect(l).not.toMatch(/^Knit \d+ rows\.$/);
    }
  });
  it('states the body end and carriage', () => {
    expect(has(back, 'Knit until the row counter reads 136. The carriage should be on the left.')).toBe(true);
  });
});

describe('armhole shaping (verbose)', () => {
  it('leads each cast-off with the counter and states the edge', () => {
    expect(has(back, 'Knit 1 row to row counter 137, then cast off 8 stitches at the right hand edge.')).toBe(true);
    expect(has(back, 'Knit 1 row to row counter 138, then cast off 8 stitches at the left hand edge.')).toBe(true);
  });
  it('states a decrease once then repeats it, per phase', () => {
    expect(has(back, 'Knit 1 row to row counter 139, then decrease 1 stitch at either end of the row.')).toBe(true);
    expect(has(back, 'Repeat the last instruction for row counts 140 to 143 (making a total of 5 times). The carriage should be on the right.')).toBe(true);
    expect(has(back, 'on every 2nd row, at row counts 147, 149, 151, 153, 155 and 157 (making a total of 7 times)')).toBe(true);
  });
});

describe('back neck scoop + shoulders (verbose) — holds phrased as shaping', () => {
  it('divides for the back neck and short-rows each shoulder with a reset counter', () => {
    expect(has(back, 'cast off the centre 42 stitches loosely to divide for the neck.')).toBe(true);
    expect(has(back, 'Shape the left back neck.')).toBe(true);
    expect(has(back, 'Set the carriage to hold.')).toBe(true);
    expect(has(back, 'Bring 6 needles at the left into hold, then knit to row counter 007.')).toBe(true);
    expect(has(back, 'Bring 5 needles at the left into hold, then knit to row counter 009.')).toBe(true);
  });
  it('takes each shoulder off on waste yarn for grafting', () => {
    expect(has(back, 'Take this shoulder off onto 5-6 rows of waste yarn. There should be 26 stitches on this shoulder.')).toBe(true);
    expect(has(back, 'Break the yarn, leaving plenty of tail for grafting.')).toBe(true);
  });
});

describe('abbreviated mode', () => {
  it('abbreviates cast-on, tension, counter and rib', () => {
    expect(backT.lines[0]).toBe('CO 145 st in 1x1 rib (72L, 73R), COR.');
    expect(backT.lines[1]).toBe('Set to MT-2.');
    expect(backT.lines[2]).toBe('RC to 000.');
    expect(has(backT, 'Rib to RC 025.')).toBe(true);
  });
  it('abbreviates the transition, shaping and carriage', () => {
    expect(has(backT, 'RC to 000, change to st st, set to MT, dec 1 st at RH. COL.')).toBe(true);
    expect(has(backT, '144 st (72L, 72R).')).toBe(true);
    expect(has(backT, 'Kn to RC 137, then BO 8 st at RH.')).toBe(true);
    expect(has(backT, 'Kn to RC 139, then dec 1 st at either end.')).toBe(true);
    expect(has(backT, 'Rpt instruction for RC 140 to 143 (total 5 times). COR.')).toBe(true);
  });
  it('divides for the back neck and short-rows the shoulders; never CO for a cast-off', () => {
    expect(has(backT, 'BO centre 42 st loosely to divide for neck.')).toBe(true);
    expect(has(backT, '6 N at L into hold, then Kn to RC 007.')).toBe(true);
    expect(has(backT, 'Take shoulder off to waste yarn. 26 st per shoulder.')).toBe(true);
    // never CO for a cast-off:
    for (const l of backT.lines) expect(l).not.toMatch(/CO \d+ st at/);
  });
});

it('CHECKPOINT: prints both registers of the full Woman 36" pattern', () => {
  console.log('\n===== VERBOSE =====\n' + patternText(renderPattern(garment)));
  console.log('\n===== ABBREVIATED =====\n' + patternText(renderPattern(garment, 'abbreviated')));
  expect(true).toBe(true);
});
