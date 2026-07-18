/**
 * Seam geometry — pure readers over a row array, with no piece dependencies (a
 * leaf module, so both the pieces that generate seams and the assembly checker can
 * share it without an import cycle). "How long is this sewn edge?" is a geometric
 * fact independent of any pattern prose.
 */

import type { Row } from '../row';
import type { Gauge } from '../gauge';

/**
 * Stitches consumed by a seam, per edge.
 *
 * A mattress-stitch seam takes up roughly one whole stitch from each of the two edges
 * it joins, so a piece sized to its finished width comes out narrower once sewn. Two
 * side seams cost four stitches around the body — about half an inch at machine gauge:
 * small, but a systematic loss in one direction, which is worse than it is large.
 *
 * There is no convention to defer to. Sources note that patterns "frequently" allow for
 * the seam stitch and no authority requires it, so this is our decision: pieces are cut
 * a stitch wider at each seamed edge and the seam eats the difference, which makes the
 * finished measurement the one the pattern claims.
 *
 * Applied to the VERTICAL seams — body sides and the sleeve underarm — where the loss
 * lands on the chest and upper-arm measurements the fit checks care about. The armhole
 * and shoulder seams run row-wise and cost length rather than width; that allowance is
 * not modelled, and the cap-fits-armhole invariant balances both of those edges against
 * each other anyway, so an allowance there would have to be added to both at once.
 */
export const SEAM_ALLOWANCE_STS = 1;

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
    if (r.side === 'right') continue; // measure one side only: skip the far half of a split piece
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
