/** Typed access to the option vocabulary (`data/options.json`). */

import type { Option, EaseOption, EaseStyleId } from './types';
import optionsJson from '../../../../data/options.json';

const opts = optionsJson as unknown as Record<string, unknown>;

/**
 * The option list for a field. Most fields are a plain array; a few (`hem`,
 * `method`, `button_band`) wrap their entries under a `values` key alongside
 * metadata such as `_applies_to`. Both shapes are handled.
 */
export function optionList(field: string): Option[] {
  const v = opts[field];
  if (Array.isArray(v)) return v as Option[];
  if (v && typeof v === 'object') {
    const values = (v as { values?: unknown }).values;
    if (Array.isArray(values)) return values as Option[];
  }
  return [];
}

/** The set of valid ids for a field. */
export function optionIds(field: string): string[] {
  return optionList(field).map((o) => o.id);
}

export const easeStyles: readonly EaseOption[] = optionList('ease') as EaseOption[];

/** The multiplicative ease base for a style (see `ease_model.md`). */
export function easeBase(id: EaseStyleId): number {
  const e = easeStyles.find((o) => o.id === id);
  if (!e) throw new Error(`Unknown ease style: ${id}`);
  return e.base;
}
