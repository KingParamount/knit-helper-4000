/**
 * Guard rails for the hand-knitting register.
 *
 * These exist because nobody on this project hand knits. The rules below came from
 * research and from the one person who could correct us, and every one of them is a
 * way the output could be *plausible but wrong* — which is exactly the failure a
 * reader cannot catch by skimming. So they are asserted mechanically, over every size
 * and style, rather than trusted to review.
 *
 * The most important is the left/right ban. On a machine the bed is fixed, so "the
 * left hand edge" is an absolute place. Hand knitting turns the work over every row,
 * so the same physical edge is at the start of a right-side row and the end of a
 * wrong-side one: left and right inverts row to row and a pattern that used them
 * would be wrong half the time, silently.
 */

import { describe, it, expect } from 'vitest';
import { findSize } from '../data/sizes';
import { DEFAULT_GAUGE } from '../gauge';
import type { NeckStyle, ShoulderStyle } from '../data/types';
import { backRows } from '../pieces/back';
import { frontRows } from '../pieces/front';
import { sleeveRows } from '../pieces/sleeve';
import { neckbandRows } from '../pieces/neckband';
import { renderPiece, makingUpProse, renderPattern } from './prose';
import { assembleGarment } from '../pieces/garment';
import type { Row } from '../row';

const G = DEFAULT_GAUGE;
const SIZES = [
  findSize('Baby', 20, 'in')!,
  findSize('Child', 24, 'in')!,
  findSize('Woman', 36, 'in')!,
  findSize('Man', 44, 'in')!,
];
const NECKS: NeckStyle[] = ['round', 'v'];
const SHOULDERS: ShoulderStyle[] = ['set_in', 'drop'];

/** Every hand-rendered line of every piece, for one size/style combination. */
function handLines(size: (typeof SIZES)[number], neck: NeckStyle, shoulder: ShoulderStyle): string[] {
  const pieces: [Row[], string][] = [
    [backRows(size, 'moderate', G, shoulder), 'The Back'],
    [frontRows(size, 'moderate', G, neck, shoulder), 'The Front'],
    [sleeveRows('sleeve_l', size, 'moderate', G, shoulder), 'The Sleeves'],
    [neckbandRows(size, 'moderate', G, neck, shoulder), 'Neckband'],
  ];
  const out: string[] = [];
  for (const style of ['verbose', 'abbreviated'] as const) {
    for (const [rows, title] of pieces) {
      out.push(...renderPiece(rows, title, { style, technique: 'hand', gauge: G, units: 'cm' }).lines);
    }
    // Making Up is where left/right would most easily creep back in — the machine
    // version names the left and right shoulders — so it is guarded too.
    out.push(...makingUpProse(neck, shoulder, style, 'hand').lines);
  }
  return out;
}

/** Machine idioms. Each has no hand equivalent at all; none may leak across. */
const MACHINE_ONLY: { label: string; re: RegExp }[] = [
  { label: 'row counter', re: /row counter|\bRC\b/i },
  { label: 'carriage', re: /carriage|\bCOL\b|\bCOR\b/i },
  { label: 'tension dial', re: /main tension|\bMT\b|tension[, ]*minus/i },
  { label: 'waste yarn', re: /waste yarn/i },
  { label: 'holding position', re: /into hold|set the carriage to hold|holding position/i },
  { label: 'needle bed', re: /needle bed|\bthe bed\b/i },
  { label: 'machine manual', re: /machine manual/i },
];

describe('hand register: no machine idiom survives the translation', () => {
  for (const size of SIZES) {
    for (const neck of NECKS) {
      for (const shoulder of SHOULDERS) {
        const label = `${size.category} ${size.chest}" ${neck}/${shoulder}`;
        it(`${label} — uses no machine-only vocabulary`, () => {
          const lines = handLines(size, neck, shoulder);
          for (const { label: what, re } of MACHINE_ONLY) {
            const bad = lines.filter((l) => re.test(l));
            expect(bad, `${what} leaked into hand prose: ${bad[0] ?? ''}`).toEqual([]);
          }
        });
      }
    }
  }
});

describe('hand register: never names a left or right edge', () => {
  // "right side" and "wrong side" are the FACE of the fabric, not a direction, and are
  // the correct hand vocabulary — strip them before looking for directional left/right.
  // Both the open and hyphenated forms — "the right side" and "right-side rows" are
  // equally the face of the fabric rather than a direction.
  const stripFaces = (line: string): string =>
    line.replace(/\bright[- ]sides?\b/gi, 'RS').replace(/\bwrong[- ]sides?\b/gi, 'WS');

  for (const size of SIZES) {
    for (const neck of NECKS) {
      for (const shoulder of SHOULDERS) {
        const label = `${size.category} ${size.chest}" ${neck}/${shoulder}`;
        it(`${label} — names edges for what they are, not which hand they are near`, () => {
          const bad = handLines(size, neck, shoulder)
            .map(stripFaces)
            .filter((l) => /\bleft\b|\bright\b|\bLH\b|\bRH\b/i.test(l));
          expect(bad, `directional left/right in hand prose: ${bad[0] ?? ''}`).toEqual([]);
        });
      }
    }
  }
});

describe('hand register: stitches that stay live go on a holder', () => {
  it('says holder, never waste yarn, wherever the machine takes stitches off', () => {
    const lines = handLines(SIZES[2], 'round', 'set_in');
    const live = lines.filter((l) => /holder/i.test(l));
    expect(live.length, 'expected live stitches to be held somewhere').toBeGreaterThan(0);
    expect(lines.filter((l) => /waste/i.test(l))).toEqual([]);
  });
});

describe('hand register: measures plain stretches, counts shaped ones', () => {
  const lines = handLines(SIZES[2], 'round', 'set_in');

  it('gives plain runs as a length, not a row number', () => {
    const plain = lines.filter((l) => /Continue in pattern|Work in the rib|^Rib to|^Work to/i.test(l));
    expect(plain.length).toBeGreaterThan(0);
    for (const l of plain) expect(l, `plain run should measure: ${l}`).toMatch(/\d+(\.\d+)?\s*(cm|in)/);
  });

  it('still counts rows for shaping, where measuring cannot reach', () => {
    const shaped = lines.filter((l) => /then (decrease|cast off|increase)/i.test(l));
    expect(shaped.length).toBeGreaterThan(0);
    for (const l of shaped) expect(l, `shaping should count rows: ${l}`).toMatch(/Work \d+ rows?|Work 1 row/i);
  });
});

describe('hand register: never dictates fabric, needles or yarn', () => {
  it('refers the knitter back to their own tension swatch', () => {
    const lines = handLines(SIZES[2], 'round', 'set_in');
    // The tension is many-to-one over yarn, needle and knitter, so naming any of them
    // would be inventing an input we were never given.
    expect(lines.filter((l) => /\b\d+(\.\d+)?\s*mm\b/i.test(l)), 'named a needle size').toEqual([]);
    expect(lines.filter((l) => /\bDK\b|4[- ]ply|aran|worsted|chunky/i.test(l)), 'named a yarn weight').toEqual([]);
    expect(lines.some((l) => /tension swatch/i.test(l)), 'should point back at the swatch').toBe(true);
  });
});

describe('hand register: names the decrease that suits the row it falls on', () => {
  // Caught a live bug: Facing is a three-state string ('rs' | 'ws' | 'alternating'),
  // and code branching on its truthiness claimed every row was a right-side row —
  // which typechecks perfectly, because all three values are non-empty strings.
  // Purl-side decreases appearing somewhere in the output is the evidence that the
  // facing is actually being read.
  const lines = handLines(SIZES[2], 'round', 'set_in');

  it('uses knit decreases on right-side rows and purl ones on wrong-side rows', () => {
    const knitwise = lines.filter((l) => /\bssk\b|\bk2tog\b/.test(l));
    const purlwise = lines.filter((l) => /\bp2tog\b|\bssp\b|purlwise/.test(l));
    expect(knitwise.length, 'expected knit decreases somewhere').toBeGreaterThan(0);
    // The armhole begins the row after the underarm cast-offs, so its alternate-row
    // phases land on wrong-side rows. If this ever reaches zero, either the geometry
    // moved or the facing is being ignored again.
    expect(purlwise.length, 'expected purl-side decreases on the wrong-side phases').toBeGreaterThan(0);
  });

  it('never gives a purl decrease and a knit decrease for the same single-face row', () => {
    // A phase worked wholly on one face must name one pairing, not both. Only an
    // every-row phase (which genuinely covers both faces) may mention the two.
    // The abbreviated register writes the alternating case as "RS: …; WS: …", the
    // verbose one spells it out — both are legitimately two pairings on one line.
    const alternating = /right-side rows|\bRS:/;
    const single = lines.filter(
      (l) => /(ssk|k2tog)/.test(l) && /(p2tog|ssp)/.test(l) && !alternating.test(l),
    );
    expect(single, `mixed pairings on a single-face row: ${single[0] ?? ''}`).toEqual([]);
  });
});

describe('hand construction: the band mitres where a hand knitter actually decreases', () => {
  it('shapes the V at a centred double decrease, not at the two ends', () => {
    const size = SIZES[2];
    const hand = neckbandRows(size, 'moderate', G, 'v', 'set_in', 'hand');
    const machine = neckbandRows(size, 'moderate', G, 'v', 'set_in', 'machine');

    const sides = (rows: typeof hand): string[] =>
      rows.flatMap((r) => r.ops.filter((o) => o.kind === 'decrease').map((o) => String((o as { side: string }).side)));

    expect(new Set(sides(hand))).toEqual(new Set(['center']));
    expect(new Set(sides(machine))).toEqual(new Set(['both']));

    // The same stitches leave the band either way — only the place differs. If these
    // ever diverge, one of the two constructions has stopped matching its plan.
    expect(hand[hand.length - 1].stitches).toBe(machine[machine.length - 1].stitches);
  });

  it('leaves a crew band unshaped in both techniques', () => {
    const hand = neckbandRows(SIZES[2], 'moderate', G, 'round', 'set_in', 'hand');
    expect(hand.flatMap((r) => r.ops.filter((o) => o.kind === 'decrease'))).toEqual([]);
  });
});

describe('hand pattern can be worked from the first line to the last', () => {
  // The band is picked up off a neckline that does not exist until a shoulder is
  // joined. If all the making-up sat at the end — right for a machine, whose band is a
  // separate strip — the knitter would reach the neckband with nothing to pick up from.
  for (const neck of NECKS) {
    for (const shoulder of SHOULDERS) {
      it(`${neck}/${shoulder} — joins a shoulder before the neckband`, () => {
        const garment = assembleGarment(SIZES[2], 'moderate', G, neck, shoulder);
        const titles = renderPattern(garment, { technique: 'hand', gauge: G, units: 'cm' }).pieces.map(
          (p) => p.title,
        );
        const shoulderStep = titles.findIndex((x) => /shoulder/i.test(x));
        const band = titles.findIndex((x) => /neckband/i.test(x));
        expect(shoulderStep, 'expected a shoulder-joining step').toBeGreaterThanOrEqual(0);
        expect(shoulderStep, `shoulder must precede the band: ${titles.join(' -> ')}`).toBeLessThan(band);
      });
    }
  }

  it('machine keeps its making-up at the end, where the separate band allows', () => {
    const garment = assembleGarment(SIZES[2], 'moderate', G, 'v', 'set_in');
    const titles = renderPattern(garment, { technique: 'machine' }).pieces.map((p) => p.title);
    expect(titles[titles.length - 1]).toMatch(/making up/i);
  });
});
