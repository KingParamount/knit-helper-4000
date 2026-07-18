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
import { renderPiece } from './prose';
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
  const stripFaces = (line: string): string =>
    line.replace(/\bright side\b/gi, 'RS').replace(/\bwrong side\b/gi, 'WS');

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
