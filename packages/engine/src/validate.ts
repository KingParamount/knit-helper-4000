/**
 * The constraint validator. Table-driven from `data/constraints.json` — every
 * rule is evaluated by the same three primitives (forbid / require / symmetric),
 * so there are no per-rule branches to keep in sync with the data.
 *
 * Runs before generation. Errors block; warnings do not (e.g. BOAT_OVERLAP_WARNING).
 *
 * Partial selections are safe: a rule only fires when the fields it names are
 * actually chosen. A not-yet-made choice is never reported as a violation, so the
 * same validator serves both progressive UI validation and the final pre-generation
 * check (where every field is present).
 */

import { rules, type Clause, type RawRule } from './data/constraints';

/** A garment specification: field id → chosen option id. */
export type Selection = Record<string, string>;

export interface Violation {
  id: string;
  severity: 'error' | 'warning';
  message: string;
  source?: string;
  sourceRef?: string;
}

export interface ValidationResult {
  ok: boolean;
  errors: Violation[];
  warnings: Violation[];
}

/** True when every field named in the clause is chosen and within its value set. */
function clauseMatches(clause: Clause, sel: Selection): boolean {
  return Object.entries(clause).every(([field, values]) => {
    const chosen = sel[field];
    return chosen !== undefined && values.includes(chosen);
  });
}

/** A forbid fires when all its clauses match at once. */
function forbidFires(clauses: Clause[], sel: Selection): boolean {
  return clauses.length > 0 && clauses.every((c) => clauseMatches(c, sel));
}

/** A require fires when `when` matches but a chosen `then` field is out of range. */
function requireFires(when: Clause, then: Clause, sel: Selection): boolean {
  if (!clauseMatches(when, sel)) return false;
  return Object.entries(then).some(([field, allowed]) => {
    const chosen = sel[field];
    return chosen !== undefined && !allowed.includes(chosen);
  });
}

function ruleFires(rule: RawRule, sel: Selection): boolean {
  if (rule.forbid && forbidFires(rule.forbid, sel)) return true;
  if (rule.also_forbid && forbidFires(rule.also_forbid, sel)) return true;
  if (rule.require) {
    const { when, then } = rule.require;
    if (requireFires(when, then, sel)) return true;
    if (rule.symmetric && requireFires(then, when, sel)) return true;
  }
  return false;
}

function toViolation(rule: RawRule): Violation {
  return {
    id: rule.id,
    severity: rule.severity === 'warning' ? 'warning' : 'error',
    // verbatim text where we have it; the sourced quote for prose-derived rules
    message: rule.text ?? rule.quote ?? rule.id,
    source: rule.source,
    sourceRef: rule.source_ref,
  };
}

/** Validate a selection against every rule. */
export function validate(sel: Selection): ValidationResult {
  const fired = rules.filter((r) => ruleFires(r, sel)).map(toViolation);
  const errors = fired.filter((v) => v.severity === 'error');
  const warnings = fired.filter((v) => v.severity === 'warning');
  return { ok: errors.length === 0, errors, warnings };
}
