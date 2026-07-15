/** Typed access to the canonical size table (`data/sizes_canonical.json`). */

import type { SizeRecord, Category, Units } from './types';
// The data files live at the repo root (shared with the app and future builds).
// This package reaches outside its own src only here and in `options.ts` /
// `constraints.ts`; the imports are bundled at build time — no runtime I/O.
import sizesJson from '../../../../data/sizes_canonical.json';

export const sizes: readonly SizeRecord[] = sizesJson as unknown as SizeRecord[];

/** Find the row for a category + chest measurement in the given unit system. */
export function findSize(
  category: Category,
  chest: number,
  units: Units = 'in',
): SizeRecord | undefined {
  return sizes.find(
    (s) => s.category === category && s.units === units && s.chest === chest,
  );
}

/** Chest measurements available for a category, ascending, in the given units. */
export function availableChests(category: Category, units: Units = 'in'): number[] {
  return sizes
    .filter((s) => s.category === category && s.units === units)
    .map((s) => s.chest)
    .sort((a, b) => a - b);
}
