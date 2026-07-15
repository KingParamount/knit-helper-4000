/** Typed access to the constraint rules (`data/constraints.json`). */

import constraintsJson from '../../../../data/constraints.json';

/**
 * A clause maps each named field to the set of values that make it match.
 * A clause matches a selection when *every* field in it is chosen and in range.
 * In the data every clause has a single field, but multi-field clauses (AND)
 * are handled generically.
 */
export type Clause = Record<string, string[]>;

export interface RawRule {
  id: string;
  /** Verbatim original message — the provenance record. Absent on sourced rules. */
  text?: string;
  confidence?: 'high' | 'medium' | 'low';
  severity?: 'warning' | 'error';
  /** Invalid when ALL clauses match. */
  forbid?: Clause[];
  /** A second, independent forbid within the same rule. */
  also_forbid?: Clause[];
  /** When `when` matches, `then` must hold. */
  require?: { when: Clause; then: Clause };
  /** A require that also applies with `when`/`then` swapped. */
  symmetric?: boolean;
  // Prose-derived rules carry a source instead of a verbatim `text`:
  source?: string;
  quote?: string;
  source_ref?: string;
  note?: string;
}

export interface EngineLimit {
  id: string;
  text: string;
  value: number;
  note?: string;
}

interface ConstraintsFile {
  rules: RawRule[];
  engine_limits?: EngineLimit[];
}

const file = constraintsJson as unknown as ConstraintsFile;

export const rules: readonly RawRule[] = file.rules;
export const engineLimits: readonly EngineLimit[] = file.engine_limits ?? [];
