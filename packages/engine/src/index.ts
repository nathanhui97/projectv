// Rules engine public API

export type { CardCatalog } from './catalog';
export { lookupCard, buildCatalog } from './catalog';

export type { EffectiveStats } from './stats';
export { resolveEffectiveStats, hasKeyword } from './stats';

export type { FilterContext, InstanceLocation } from './filter';
export {
  evaluateFilter,
  evaluateShorthandFilter,
  normalizeShorthandFilter,
  findMatchingInstances,
  findInstanceLocation,
  allBattleInstances,
  isLinked,
} from './filter';

export { mulberry32, drawRng, shuffleArray } from './rng';

export type { InitConfig, PlayerSetup } from './state';
export { getInitialState } from './state';

export { checkWinCondition, setWinner } from './win';

export { advancePhase, applyPhaseEntry } from './phases';

export type { ConditionContext } from './conditions';
export { evaluateCondition } from './conditions';

export type { StepResult, StepContext } from './steps';
export { resolveStep, destroyInstance } from './steps';

export type { TriggerEvent } from './triggers';
export { collectTriggers } from './triggers';

export { processQueue } from './queue';

export { validateAction } from './validate';
export { applyAction } from './apply';
export { listLegalActions } from './legal';
