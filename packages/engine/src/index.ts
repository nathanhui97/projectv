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

// ─── Engine actions (to be implemented in Weeks 3-4) ─────────────────────────

export function getInitialState(): never {
  throw new Error('Not implemented');
}

export function validateAction(): never {
  throw new Error('Not implemented');
}

export function applyAction(): never {
  throw new Error('Not implemented');
}

export function resolveChoice(): never {
  throw new Error('Not implemented');
}

export function processQueue(): never {
  throw new Error('Not implemented');
}

export function checkWinCondition(): never {
  throw new Error('Not implemented');
}

export function listLegalActions(): never {
  throw new Error('Not implemented');
}
