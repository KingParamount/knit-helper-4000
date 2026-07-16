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
export { rules, engineLimits } from './data/constraints';
export type { RawRule, EngineLimit } from './data/constraints';

export { validate } from './validate';
export type { Selection, Violation, ValidationResult } from './validate';

export { garmentWidths, chestEase, SETIN_ALLOWANCE_IN } from './dimensions';
export type { GarmentWidths } from './dimensions';

export {
  DEFAULT_GAUGE,
  ribGauge,
  stitchesFor,
  rowsFor,
  ribRowsFor,
} from './gauge';
export type { Gauge } from './gauge';

export { carriageForRow } from './row';
export type { Row, Op, Carriage, Piece } from './row';

export {
  backPlan,
  lowerBackRows,
  lowerPanelRows,
  armholeShaping,
  backThroughArmhole,
  panelThroughArmhole,
  splitIntoSteps,
  backRows,
} from './pieces/back';
export type { BackPlan, PlanSection, ArmholeShaping, DecPhase } from './pieces/back';

export {
  frontNeckDepthRows,
  frontNeckPlan,
  frontToNeck,
  frontNeckShaping,
  frontRows,
} from './pieces/front';
export type { FrontNeckPlan } from './pieces/front';
