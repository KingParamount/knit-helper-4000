/**
 * @knit-helper-4000/engine — pure pattern-generation core.
 *
 * Zero I/O, no DOM, no React — testable in Node, reusable in a desktop build.
 * Data (`data/*.json`) is imported and bundled at build time, not read at runtime.
 */

export const ENGINE_NAME = 'Knit-Helper 4000 engine';
export const ENGINE_VERSION = '0.0.0';

export type {
  Units,
  Category,
  SizeRecord,
  Option,
  EaseOption,
  EaseStyleId,
} from './data/types';

export { sizes, findSize, availableChests } from './data/sizes';
export { optionList, optionIds, easeStyles, easeBase } from './data/options';
