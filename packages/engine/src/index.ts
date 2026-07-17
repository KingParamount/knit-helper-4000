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
  NeckStyle,
  ShoulderStyle,
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
  SHOULDER_STEP_STS,
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

export { CUFF_EASE_IN, evenRows, sleevePlan, sleeveRows, sleeves } from './pieces/sleeve';
export type { SleevePlan } from './pieces/sleeve';

export { PICKUP_PER_ROW, neckbandPlan, neckbandRows } from './pieces/neckband';
export type { NeckbandPlan } from './pieces/neckband';

export { assembleGarment } from './pieces/garment';
export type { Garment } from './pieces/garment';

export {
  NECK_OPENING_STRETCH,
  NECK_STRETCH_MAX,
  crewSuitable,
  neckOpeningPerimeter,
  backNeckDepthIn,
  neckHeadFit,
  neckFitVerdict,
  fitReport,
  HIP_STRETCH,
  MIN_SHOULDER_IN,
} from './fit';
export type { NeckHeadFit, NeckFitVerdict, FitCheck, FitReport } from './fit';
export { backNeckDepthRows } from './neckopening';

export {
  seamEdgeLength,
  armholeOpening,
  capPerimeter,
  capEase,
  assemblyReport,
} from './pieces/assembly';
export type { Invariant, AssemblyReport } from './pieces/assembly';

export { renderPiece, renderPattern, patternText } from './render/prose';
export type { PieceProse, Pattern, ProseStyle } from './render/prose';

export {
  backSchematic,
  frontSchematic,
  sleeveSchematic,
  neckbandSchematic,
  schematicSvg,
} from './render/schematic';
export type { PieceSchematic, Pt, Measure, SvgOpts } from './render/schematic';
