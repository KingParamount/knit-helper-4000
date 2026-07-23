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
  BackNeckStyle,
  ShoulderStyle,
  BodyLength,
  HemStyle,
  SleeveLength,
  Technique,
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

/**
 * Human gauge readout, over the span the caller is going to LABEL it with.
 *
 * 10cm and 4in are used interchangeably by nearly every knitting source, and they are
 * not the same: 10cm is 3.937in, 1.6% short. The engine holds gauge per 4in (rule 3,
 * one canonical unit), so reading that number out under a "10 cm" label overstates it
 * — small, but the same order as the half-stitch miscount the whole count-first swatch
 * method exists to avoid. Convert at the render boundary, where every other unit
 * conversion happens.
 */
const IN_PER_10CM = 10 / 2.54;

export function gaugeReadout(g: Gauge, units: Units = 'in'): { st: number; row: number; span: string } {
  const factor = units === 'cm' ? IN_PER_10CM / 4 : 1;
  return {
    st: Math.round(g.bodySt * factor),
    row: Math.round(g.bodyRow * factor),
    span: units === 'cm' ? '10 cm' : '4 in',
  };
}

export interface BuildInput {
  category: Category;
  chest: number;
  units: Units;
  ease: EaseId;
  /** Front neck style; defaults to a crew ('round') when omitted. */
  neck?: NeckStyle;
  /** Back neck style; defaults to a scoop when omitted. */
  backNeck?: BackNeckStyle;
  /** Shoulder / sleeve-join style; defaults to 'set_in' when omitted. */
  shoulder?: ShoulderStyle;
  /** Where the body ends; defaults to 'hip' when omitted. */
  bodyLength?: BodyLength;
  /** Hem style for body and cuffs; defaults to 'ribbing' when omitted. */
  hem?: HemStyle;
  /** Sleeve length; defaults to 'full' when omitted. */
  sleeveLength?: SleeveLength;
  /** How it is made. Machine unless said otherwise. */
  technique?: Technique;
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
  const backNeck = input.backNeck ?? 'scoop';
  const shoulder = input.shoulder ?? 'set_in';
  const opts = { bodyLength: input.bodyLength ?? 'hip', hem: input.hem ?? 'ribbing', sleeveLength: input.sleeveLength ?? 'full' } as const;
  // Hand prose measures rather than counts, so it needs the row gauge and the
  // knitter's units; machine prose reads neither.
  return renderPattern(assembleGarment(size, input.ease, g, neck, shoulder, backNeck, opts), {
    style,
    technique: input.technique ?? 'machine',
    gauge: g,
    units: input.units,
  });
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
  const backNeck = input.backNeck ?? 'scoop';
  const shoulder = input.shoulder ?? 'set_in';
  const opts = { bodyLength: input.bodyLength ?? 'hip', hem: input.hem ?? 'ribbing', sleeveLength: input.sleeveLength ?? 'full' } as const;
  const bp = backPlan(size, input.ease, g, shoulder, backNeck, opts);
  const fnp = frontNeckPlan(size, input.ease, g, neck, shoulder, opts);
  const sp = sleevePlan(size, input.ease, g, shoulder, opts);
  const np = neckbandPlan(size, input.ease, g, neck, shoulder, backNeck);
  // Only the band's rows differ by technique — a hand V mitres at a centred double
  // decrease, a machine one at its two ends — and the chart has to show which.
  const technique = input.technique ?? 'machine';
  return {
    back: backSchematic(backRows(size, input.ease, g, shoulder, backNeck, opts), bp, g),
    front: frontSchematic(frontRows(size, input.ease, g, neck, shoulder, opts), bp, fnp, g),
    sleeve: sleeveSchematic(sleeveRows('sleeve_l', size, input.ease, g, shoulder, opts), sp, g),
    neckband: neckbandSchematic(neckbandRows(size, input.ease, g, neck, shoulder, technique, backNeck), np, g),
  };
}

export function svgFor(piece: PieceSchematic, opts: SvgOpts): string {
  return schematicSvg(piece, opts);
}
