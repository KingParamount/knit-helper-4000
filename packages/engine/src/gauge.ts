/** Gauge and the conversion from finished inches to stitch/row counts. */

/**
 * Stitch and row gauge, each measured over 4 inches (= 10 cm) — the convention
 * the original used (`manual.txt:1365`) and standard in hand and machine knitting.
 * Rib gauge 0 means "not measured": fall back to the body gauge (the original's
 * behaviour, `manual.txt:1367`; a dedicated default-rib model is open item R1).
 */
export interface Gauge {
  bodySt: number;
  bodyRow: number;
  ribSt: number;
  ribRow: number;
}

/**
 * Default: a standard-gauge machine in 4-ply. Mid-range of the usual band
 * (28–32 sts, 38–44 rows per 4"). Used until the user enters their own swatch.
 */
export const DEFAULT_GAUGE: Gauge = {
  bodySt: 30,
  bodyRow: 40,
  ribSt: 0,
  ribRow: 0,
};

/** Effective rib gauge, falling back to the body gauge when unmeasured. */
export function ribGauge(g: Gauge): { st: number; row: number } {
  return {
    st: g.ribSt > 0 ? g.ribSt : g.bodySt,
    row: g.ribRow > 0 ? g.ribRow : g.bodyRow,
  };
}

/** Whole stitches for a finished width, at the body stitch gauge. */
export function stitchesFor(inches: number, g: Gauge): number {
  return Math.round((inches * g.bodySt) / 4);
}

/**
 * Stitches for a finished width, rounded to the nearest EVEN number. Extended
 * lengths of plain (or patterned) knitting are worked on an even stitch count, and
 * that parity discipline overrides the exact width — see the stitch-parity rules.
 * (Ribbing is the exception: it is cast on odd, one more than the body, and dropped
 * to this even count at the change to stocking stitch.)
 */
export function evenStitchesFor(inches: number, g: Gauge): number {
  return Math.round((inches * g.bodySt) / 8) * 2;
}

/** Whole rows for a finished length, at the body row gauge. */
export function rowsFor(inches: number, g: Gauge): number {
  return Math.round((inches * g.bodyRow) / 4);
}

/** Whole rows for a rib length, at the (possibly defaulted) rib row gauge. */
export function ribRowsFor(inches: number, g: Gauge): number {
  return Math.round((inches * ribGauge(g).row) / 4);
}
