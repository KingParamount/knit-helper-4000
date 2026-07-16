/**
 * The row array — the one canonical structure that prose, schematic and the
 * (future) row-by-row device all render from. See CLAUDE.md.
 */

export type Carriage = 'L' | 'R';

export type Piece = 'back' | 'front' | 'sleeve_l' | 'sleeve_r' | 'collar';

/**
 * A shaping event on a row. `both` = the same at each end of the row; `center`
 * (bind-off only) = a block in the middle, e.g. a flat back neck. `hold` puts
 * needles into holding position (short-row shaping) — they stay live on the
 * needles for grafting, so they do not reduce the stitch count.
 */
export type Op =
  | { kind: 'cast_on'; count: number }
  | { kind: 'bind_off'; count: number; side: 'L' | 'R' | 'both' | 'center' }
  | { kind: 'decrease'; count: number; side: 'L' | 'R' | 'both' }
  | { kind: 'increase'; count: number; side: 'L' | 'R' | 'both' }
  | { kind: 'hold'; count: number; side: 'L' | 'R' };

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
