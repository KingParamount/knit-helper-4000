/**
 * Seam geometry — pure readers over a row array, with no piece dependencies (a
 * leaf module, so both the pieces that generate seams and the assembly checker can
 * share it without an import cycle). "How long is this sewn edge?" is a geometric
 * fact independent of any pattern prose.
 */

import type { Row } from '../row';
import type { Gauge } from '../gauge';

/** Body armhole edge: the curved decreases plus the straight run to the shoulder. */
export const ARMHOLE_SECTIONS = new Set(['armhole', 'upper_back']);
/** Sleeve-cap edge: everything from the underarm to the crown. */
export const CAP_SECTIONS = new Set(['cap']);

/**
 * Curved length (inches) of one side edge over `sections`, following the selvedge
 * row by row. Excludes the flat underarm cast-off (the leading L/R bind-offs,
 * before the first decrease — they seam to the sleeve underarm, not to the cap
 * curve) and any centre bind-off (the crown, or the back neck). Each row is one
 * row of height plus whatever this edge travels horizontally, taken as a
 * Pythagorean per-row segment — the length a tape follows down the seam.
 */
export function seamEdgeLength(rows: Row[], sections: Set<string>, gauge: Gauge): number {
  const sw = 4 / gauge.bodySt; // inches per stitch
  const rh = 4 / gauge.bodyRow; // inches per row
  let seenDecrease = false;
  let length = 0;
  for (const r of rows) {
    if (!sections.has(r.section ?? '')) continue;
    let dx = 0;
    let skipRow = false;
    for (const op of r.ops) {
      if (op.kind === 'decrease') {
        if (op.side === 'both' || op.side === 'L') dx += op.count;
        seenDecrease = true;
      } else if (op.kind === 'bind_off') {
        if (op.side === 'center') skipRow = true; // crown / back neck — not this edge
        else if (!seenDecrease) skipRow = true; // flat underarm cast-off — seams elsewhere
        else if (op.side === 'both' || op.side === 'L') dx += op.count;
      }
    }
    if (skipRow) continue;
    length += Math.hypot(dx * sw, rh);
  }
  return length;
}
