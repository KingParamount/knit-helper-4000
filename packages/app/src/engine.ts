/* Thin app-side wrapper over the pure engine: selection → gauge, written pattern,
 * and the four piece schematics. All synchronous, so it can run on every render. */
import {
  findSize,
  assembleGarment,
  renderPattern,
  backPlan,
  backRows,
  frontRows,
  frontNeckPlan,
  sleevePlan,
  sleeveRows,
  neckbandPlan,
  neckbandRows,
  backSchematic,
  frontSchematic,
  sleeveSchematic,
  neckbandSchematic,
  schematicSvg,
} from '@knit-helper-4000/engine';
import type {
  Category,
  Units,
  Gauge,
  NeckStyle,
  ShoulderStyle,
  ProseStyle,
  Pattern,
  PieceSchematic,
  SvgOpts,
} from '@knit-helper-4000/engine';

export type EaseId = 'skintight' | 'tight' | 'moderate' | 'comfortable' | 'oversized';
export type PieceId = 'back' | 'front' | 'sleeve' | 'neckband';

/** A swatch measured over a stitch/row count, distances stored canonically in inches. */
export interface Swatch {
  stDist: number; // inches spanned by stCount stitches
  stCount: number;
  rowDist: number; // inches spanned by rowCount rows
  rowCount: number;
}

export const DEFAULT_SWATCH: Swatch = { stDist: 5.375, stCount: 40, rowDist: 6, rowCount: 60 };

export function gaugeFromSwatch(s: Swatch): Gauge {
  return {
    bodySt: (s.stCount * 4) / s.stDist,
    bodyRow: (s.rowCount * 4) / s.rowDist,
    ribSt: 0,
    ribRow: 0,
  };
}

/** Human gauge readout, per 4in / 10cm. */
export function gaugeReadout(g: Gauge): { st: number; row: number } {
  return { st: Math.round(g.bodySt), row: Math.round(g.bodyRow) };
}

export interface BuildInput {
  category: Category;
  chest: number;
  units: Units;
  ease: EaseId;
  /** Front neck style; defaults to a crew ('round') when omitted. */
  neck?: NeckStyle;
  /** Shoulder / sleeve-join style; defaults to 'set_in' when omitted. */
  shoulder?: ShoulderStyle;
  swatch: Swatch;
}

export function resolveSize(category: Category, chest: number): ReturnType<typeof findSize> {
  return findSize(category, chest, 'in');
}

/**
 * The pattern as structured pieces. The screen joins them into one block of text;
 * the print sheet pairs each with its schematic, so it needs them apart.
 * renderPattern's order is back, front, sleeves, neckband, then Making Up — the
 * first four line up with PieceId, and Making Up has no piece to draw.
 */
export function buildPattern(input: BuildInput, style: ProseStyle): Pattern | null {
  const size = resolveSize(input.category, input.chest);
  if (!size) return null;
  const g = gaugeFromSwatch(input.swatch);
  const neck = input.neck ?? 'round';
  const shoulder = input.shoulder ?? 'set_in';
  return renderPattern(assembleGarment(size, input.ease, g, neck, shoulder), style);
}

export function buildPatternText(input: BuildInput, style: ProseStyle): string | null {
  const pattern = buildPattern(input, style);
  if (!pattern) return null;
  return pattern.pieces.map((p) => `${p.title}\n${p.lines.join('\n')}`).join('\n\n\n');
}

export function buildSchematics(input: BuildInput): Record<PieceId, PieceSchematic> | null {
  const size = resolveSize(input.category, input.chest);
  if (!size) return null;
  const g = gaugeFromSwatch(input.swatch);
  const neck = input.neck ?? 'round';
  const shoulder = input.shoulder ?? 'set_in';
  const bp = backPlan(size, input.ease, g, shoulder);
  const fnp = frontNeckPlan(size, input.ease, g, neck, shoulder);
  const sp = sleevePlan(size, input.ease, g, shoulder);
  const np = neckbandPlan(size, input.ease, g, neck, shoulder);
  return {
    back: backSchematic(backRows(size, input.ease, g, shoulder), bp, g),
    front: frontSchematic(frontRows(size, input.ease, g, neck, shoulder), bp, fnp, g),
    sleeve: sleeveSchematic(sleeveRows('sleeve_l', size, input.ease, g, shoulder), sp, g),
    neckband: neckbandSchematic(neckbandRows(size, input.ease, g, neck, shoulder), np, g),
  };
}

export function svgFor(piece: PieceSchematic, opts: SvgOpts): string {
  return schematicSvg(piece, opts);
}
