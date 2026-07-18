import { describe, it, expect } from 'vitest';
declare const console: { log: (...args: unknown[]) => void };
import { findSize } from '../data/sizes';
import { DEFAULT_GAUGE } from '../gauge';
import { assembleGarment } from '../pieces/garment';
import { backRows } from '../pieces/back';
import { frontRows } from '../pieces/front';
import { renderPiece, renderPattern, patternText, makingUpProse } from './prose';

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
      'Cast on 147 stitches (73 left, 74 right), ending with the carriage on the right.',
    );
    expect(back.lines[1]).toBe('Set the tension to main tension, minus 2 whole numbers.');
    expect(back.lines[2]).toBe('Set the row counter to 000.');
    expect(has(back, 'Work in the rib pattern of your choice until the row counter reads 025. If you are knitting mock rib, follow your machine manual for how to work it.')).toBe(true);
  });

  it('drops the odd stitch and resets tension at the change to stocking', () => {
    expect(has(back, 'Reset the row counter to 000, change to stocking stitch, set the tension back to main tension, and decrease 1 stitch at the right hand edge. The carriage should be on the left.')).toBe(true);
    expect(has(back, 'There should be 146 stitches (73 left, 73 right).')).toBe(true);
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
    expect(has(back, 'on every 2nd row, at row counts 147, 149, 151, 153, 155, 157 and 159 (making a total of 8 times)')).toBe(true);
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
    expect(backT.lines[0]).toBe('CO 147 st (73L, 74R), COR.');
    expect(backT.lines[1]).toBe('Set to MT-2.');
    expect(backT.lines[2]).toBe('RC to 000.');
    expect(has(backT, 'Work your rib to RC 025. Mock rib: see machine manual.')).toBe(true);
  });
  it('abbreviates the transition, shaping and carriage', () => {
    expect(has(backT, 'RC to 000, change to st st, set to MT, dec 1 st at RH. COL.')).toBe(true);
    expect(has(backT, '146 st (73L, 73R).')).toBe(true);
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

describe('v-neck band mitre (edge decreases) + crossed-over alternative', () => {
  const vGarment = assembleGarment(W36, 'moderate', G, 'v');
  const vBand = renderPiece(vGarment.neckband, 'Neckband');
  const vBandT = renderPiece(vGarment.neckband, 'Neckband', 'abbreviated');
  const crew = renderPiece(assembleGarment(W36, 'moderate', G, 'round').neckband, 'Neckband');

  it('mitres both ends with edge decreases, seamed at the front (knittable)', () => {
    expect(has(vBand, 'Mitre the two ends.')).toBe(true);
    expect(vBand.lines.some((l) => l.includes('decrease 1 stitch at each end of every row') && l.includes('tapering both ends'))).toBe(true);
    expect(vBand.lines.some((l) => l.includes('meet at the centre front'))).toBe(true);
    // No unknittable mid-row centre decrease.
    expect(vBand.lines.some((l) => l.includes('centred double decrease'))).toBe(false);
  });

  it('comes off on waste yarn (not cast off) with waypoint markers', () => {
    expect(vBand.lines.some((l) => l.includes('off onto 5–6 rows of waste yarn'))).toBe(true);
    expect(vBand.lines.some((l) => l.includes('contrast-yarn marker at stitch'))).toBe(true);
  });

  it('presents the crossed-over point and mock-rib/folded band as alternatives', () => {
    expect(has(vBand, 'Alternative front point — crossed over.')).toBe(true);
    expect(vBand.lines.some((l) => l.includes('lap one end over the other at the centre front'))).toBe(true);
    expect(has(vBand, 'Alternative band — mock rib or a folded band.')).toBe(true);
  });

  it('a crew band mitres nothing but still offers the folded alternative', () => {
    expect(has(crew, 'Mitre the two ends.')).toBe(false);
    expect(has(crew, 'crossed over')).toBe(false);
    expect(has(crew, 'Alternative band — mock rib or a folded band.')).toBe(true);
  });

  it('abbreviates the mitre and the alternatives', () => {
    expect(has(vBandT, 'Mitre the two ends.')).toBe(true);
    expect(vBandT.lines.some((l) => l.includes('dec 1 st at each end every row'))).toBe(true);
    expect(has(vBandT, 'Alt point — crossed over.')).toBe(true);
    expect(has(vBandT, 'Alt band — mock rib / folded.')).toBe(true);
  });
});

describe('Making Up — order, style-specific seams, stretchy only where it matters', () => {
  const idx = (lines: string[], needle: string): number => lines.findIndex((l) => l.includes(needle));

  it('runs shoulders → band → last shoulder → sleeves → sides → ends', () => {
    const { lines } = makingUpProse('round', 'set_in');
    const left = idx(lines, 'Join the left shoulder');
    const band = idx(lines, 'Sew the neckband on');
    const right = idx(lines, 'Join the right shoulder');
    const sleeves = idx(lines, 'Set in the sleeves');
    const sides = idx(lines, 'Join the sides');
    const ends = idx(lines, 'Sew in all the loose ends');
    expect(left).toBeGreaterThanOrEqual(0);
    expect(left).toBeLessThan(band);
    expect(band).toBeLessThan(right);
    expect(right).toBeLessThan(sleeves);
    expect(sleeves).toBeLessThan(sides);
    expect(sides).toBeLessThan(ends);
  });

  it('flags a stretchy join on the neckband and armholes only — not shoulders or sides', () => {
    const { lines } = makingUpProse('round', 'drop');
    const stretchyLines = lines.filter((l) => l.includes('stretchy join'));
    expect(stretchyLines).toHaveLength(2); // band + armholes
    expect(stretchyLines.every((l) => l.includes('e.g. mattress stitch'))).toBe(true);
    expect(lines.find((l) => l.includes('Join the left shoulder'))!).not.toContain('stretchy');
    expect(lines.find((l) => l.includes('Join the sides'))!).not.toContain('stretchy');
  });

  it('set-in eases a cap in; drop sews a straight top on', () => {
    expect(makingUpProse('round', 'set_in').lines.some((l) => l.includes('Ease each sleeve cap into its armhole'))).toBe(true);
    expect(makingUpProse('round', 'drop').lines.some((l) => l.includes('straight top edge'))).toBe(true);
  });

  it('a V seams the mitred ends at the centre front; a crew does not', () => {
    expect(makingUpProse('v', 'set_in').lines.some((l) => l.includes('mitred ends together at the centre front'))).toBe(true);
    expect(makingUpProse('round', 'set_in').lines.some((l) => l.includes('mitred ends'))).toBe(false);
  });

  it('the seam-technique note is verbose-only', () => {
    expect(makingUpProse('round', 'set_in', 'verbose').lines.some((l) => l.includes('Several seaming methods will serve'))).toBe(true);
    expect(makingUpProse('round', 'set_in', 'abbreviated').lines.some((l) => l.includes('Several seaming methods'))).toBe(false);
  });

  it('is the last section of the whole pattern', () => {
    const pattern = renderPattern(assembleGarment(W36, 'moderate', G, 'v', 'drop'));
    expect(pattern.pieces[pattern.pieces.length - 1].title).toBe('Making Up');
  });
});

it('CHECKPOINT: prints both registers of the full Woman 36" pattern', () => {
  console.log('\n===== VERBOSE =====\n' + patternText(renderPattern(garment)));
  console.log('\n===== ABBREVIATED =====\n' + patternText(renderPattern(garment, 'abbreviated')));
  expect(true).toBe(true);
});

describe('every style combination renders (regression: empty shaping group)', () => {
  // A shaping row that was ITSELF a counter-reset boundary ended its own group before
  // collecting anything, then crashed reading the last row of an empty list. It was
  // reachable straight from the app — all four neck/shoulder combinations are
  // selectable — for the sizes where the neck divides on the row the rib ends.
  const CASES = [
    ['Baby', 20], ['Child', 24], ['Woman', 36], ['Man', 44],
  ] as const;
  for (const [category, chest] of CASES) {
    for (const neck of ['round', 'v'] as const) {
      for (const shoulder of ['set_in', 'drop'] as const) {
        it(`${category} ${chest}" ${neck}/${shoulder} renders without throwing`, () => {
          const size = findSize(category, chest, 'in')!;
          for (const style of ['verbose', 'abbreviated'] as const) {
            expect(() =>
              renderPiece(frontRows(size, 'moderate', DEFAULT_GAUGE, neck, shoulder), 'The Front', style),
            ).not.toThrow();
            expect(() =>
              renderPiece(backRows(size, 'moderate', DEFAULT_GAUGE, shoulder), 'The Back', style),
            ).not.toThrow();
          }
        });
      }
    }
  }
});
