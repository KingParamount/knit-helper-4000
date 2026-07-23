/**
 * The row array — the one canonical structure that prose, schematic and the
 * (future) row-by-row device all render from. See CLAUDE.md.
 */

export type Carriage = 'L' | 'R';

export type Piece = 'back' | 'front' | 'sleeve_l' | 'sleeve_r' | 'collar';

/**
 * A shaping event on a row. `both` = the same at each end of the row; `center`
 * on a bind-off = a block in the middle, e.g. a flat back neck. `hold` puts needles
 * into holding position (short-row shaping) — they stay live on the needles for
 * grafting, so they do not reduce the stitch count. `take_off` runs the piece off
 * the machine on several rows of waste yarn: the stitches stay live (not cast off),
 * ready to be blocked then seamed. `mark` hangs contrast markers at the given stitch
 * positions (neckband waypoints, to ease the band onto the neckline).
 */
export type Op =
  | { kind: 'cast_on'; count: number }
  | { kind: 'pick_up'; count: number } // pick up and knit along an edge (e.g. a neckband)
  | { kind: 'bind_off'; count: number; side: 'L' | 'R' | 'both' | 'center' }
  /**
   * `side: 'center'` is a centred double decrease worked at a marked centre stitch —
   * the hand convention for a V-neckband mitre. `count` is the stitches removed (2 for
   * a CDD), so the running total arithmetic is the same as a single-sided decrease.
   * A machine cannot work one: you cannot decrease mid-bed without shifting every
   * needle, which is why the machine band mitres at its two ends instead.
   *
   * `side: 'across'` gathers the whole row — knit two together all the way across
   * (a frill hem halving back to the body width). `count` is the stitches removed,
   * so the running-total arithmetic is unchanged. Hand: k2tog across; on a machine
   * this needs every second stitch transferred, which is why a machine frill is
   * blocked in the UI (a future machine feature — the bed is also too narrow for
   * the doubled cast-on at most adult sizes).
   */
  | { kind: 'decrease'; count: number; side: 'L' | 'R' | 'both' | 'center' | 'across' }
  | { kind: 'increase'; count: number; side: 'L' | 'R' | 'both' }
  | { kind: 'hold'; count: number; side: 'L' | 'R' }
  | { kind: 'take_off'; count: number } // off the machine on waste yarn; stitches stay live
  | { kind: 'mark'; positions: number[] }; // hang contrast markers at these stitches

export interface Row {
  /** 1-based, per piece (continues across a divided piece's two halves). */
  index: number;
  piece: Piece;
  /**
   * Live stitches AFTER this row's ops. For a divided piece (e.g. a front neck),
   * this is the count in the half currently being worked; the other half is on
   * hold and not counted on these rows.
   */
  stitches: number;
  /** Side the carriage ends on (matters for machine shaping). */
  carriage: Carriage;
  ops: Op[];
  section?: string;
  /** Which half of a divided piece this row belongs to (front neck split). */
  side?: 'left' | 'right';
}

function other(c: Carriage): Carriage {
  return c === 'L' ? 'R' : 'L';
}

/**
 * Carriage side after row `index`, alternating deterministically from a known
 * start. Cast-on (row 1) rests at the start side; each subsequent pass flips it.
 * Default start 'L' → rows end L, R, L, R, … The start side is a convention and
 * can be changed without affecting the alternation.
 */
export function carriageForRow(index: number, start: Carriage = 'L'): Carriage {
  return (index - 1) % 2 === 0 ? start : other(start);
}
