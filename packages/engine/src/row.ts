/**
 * The row array — the one canonical structure that prose, schematic and the
 * (future) row-by-row device all render from. See CLAUDE.md.
 */

export type Carriage = 'L' | 'R';

export type Piece = 'back' | 'front' | 'sleeve_l' | 'sleeve_r' | 'collar';

/** A shaping event on a row. `both` = the same at each end of the row. */
export type Op =
  | { kind: 'cast_on'; count: number }
  | { kind: 'bind_off'; count: number; side: 'L' | 'R' | 'both' }
  | { kind: 'decrease'; count: number; side: 'L' | 'R' | 'both' }
  | { kind: 'increase'; count: number; side: 'L' | 'R' | 'both' };

export interface Row {
  /** 1-based, per piece. */
  index: number;
  piece: Piece;
  /** Stitch count AFTER this row's ops. */
  stitches: number;
  /** Side the carriage ends on (matters for machine shaping). */
  carriage: Carriage;
  ops: Op[];
  section?: string;
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
