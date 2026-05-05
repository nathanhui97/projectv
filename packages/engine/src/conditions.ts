import type { Condition, GameState, CardInstance, Zone } from '@project-v/schemas';
import type { CardCatalog } from './catalog';
import type { FilterContext } from './filter';
import { evaluateFilter } from './filter';
import { resolveEffectiveStats } from './stats';
import { drawRng } from './rng';

export interface ConditionContext {
  state: GameState;
  catalog: CardCatalog;
  controllerIndex: 0 | 1;
  sourceInstanceId?: string;
  storedVariables?: Record<string, string[]>;
}

function cmp(a: number, op: string, b: number): boolean {
  switch (op) {
    case '=':  return a === b;
    case '!=': return a !== b;
    case '<':  return a < b;
    case '>':  return a > b;
    case '<=': return a <= b;
    case '>=': return a >= b;
    default:   return false;
  }
}

function toFilterCtx(ctx: ConditionContext): FilterContext {
  return {
    state: ctx.state,
    catalog: ctx.catalog,
    perspectivePlayerIndex: ctx.controllerIndex,
    sourceInstanceId: ctx.sourceInstanceId,
  };
}

function resolvePlayerIndex(side: string, controllerIndex: 0 | 1): 0 | 1 {
  return side === 'friendly' ? controllerIndex : ((1 - controllerIndex) as 0 | 1);
}

function countResources(state: GameState, pi: 0 | 1, activeOnly: boolean): number {
  const cards = state.players[pi].zones.resource_area.cards;
  return activeOnly ? cards.filter(c => !c.is_resting).length : cards.length;
}

function findInstance(state: GameState, instanceId: string): CardInstance | null {
  for (const player of state.players) {
    for (const zone of Object.values(player.zones) as Array<{ cards: CardInstance[] }>) {
      for (const inst of zone.cards) {
        if (inst.instance_id === instanceId) return inst;
      }
    }
  }
  return null;
}

function countFormalMatches(filter: Parameters<typeof evaluateFilter>[0], ctx: FilterContext): number {
  let count = 0;
  for (const player of ctx.state.players) {
    for (const zone of Object.values(player.zones) as Array<{ cards: CardInstance[] }>) {
      for (const inst of zone.cards) {
        if (evaluateFilter(filter, inst, ctx)) count++;
      }
    }
  }
  return count;
}

export function evaluateCondition(cond: Condition, ctx: ConditionContext): boolean {
  const { state, catalog, controllerIndex } = ctx;
  const fCtx = toFilterCtx(ctx);

  if ('and' in cond) return (cond as any).and.every((c: Condition) => evaluateCondition(c, ctx));
  if ('or' in cond)  return (cond as any).or.some((c: Condition) => evaluateCondition(c, ctx));
  if ('not' in cond) return !evaluateCondition((cond as any).not, ctx);

  switch (cond.type) {
    case 'count': {
      const n = countFormalMatches(cond.filter, fCtx);
      return cmp(n, cond.op, cond.value);
    }
    case 'has_card':
      return countFormalMatches(cond.filter, fCtx) > 0;
    case 'no_card':
      return countFormalMatches(cond.filter, fCtx) === 0;
    case 'is_my_turn':
      return state.active_player_index === controllerIndex;
    case 'is_opponent_turn':
      return state.active_player_index !== controllerIndex;
    case 'phase_is':
      return state.phase === cond.phase;
    case 'resource_count': {
      const n = countResources(state, controllerIndex, cond.active_only ?? false);
      return cmp(n, cond.op, cond.value);
    }
    case 'hand_size': {
      const pi = resolvePlayerIndex(cond.side, controllerIndex);
      return cmp(state.players[pi].zones.hand.cards.length, cond.op, cond.value);
    }
    case 'deck_size': {
      const pi = resolvePlayerIndex(cond.side, controllerIndex);
      return cmp(state.players[pi].zones.deck.cards.length, cond.op, cond.value);
    }
    case 'shields_remaining': {
      const pi = resolvePlayerIndex(cond.side, controllerIndex);
      return cmp(state.players[pi].zones.shield_area.cards.length, cond.op, cond.value);
    }
    case 'player_level': {
      const pi = resolvePlayerIndex(cond.side, controllerIndex);
      return cmp(countResources(state, pi, false), cond.op, cond.value);
    }
    case 'zone_count': {
      const pi = resolvePlayerIndex(cond.side, controllerIndex);
      const zoneName = cond.zone as Zone;
      let cards = state.players[pi].zones[zoneName].cards;
      if (cond.filter) {
        cards = cards.filter(inst => evaluateFilter(cond.filter!, inst, fCtx));
      }
      return cmp(cards.length, cond.op, cond.value);
    }
    case 'compare_stat': {
      const lhsIds = ctx.storedVariables?.[cond.lhs.target] ?? [];
      if (lhsIds.length === 0) return false;
      const lhsInst = findInstance(state, lhsIds[0]!);
      if (!lhsInst) return false;
      const lhsCard = catalog.get(lhsInst.card_id);
      if (!lhsCard) return false;
      const lhsStats = resolveEffectiveStats(lhsInst, lhsCard);
      const lhsVal = getStatNum(lhsStats, cond.lhs.stat);

      let rhsVal: number;
      if (typeof cond.rhs === 'number') {
        rhsVal = cond.rhs;
      } else {
        const rhsIds = ctx.storedVariables?.[cond.rhs.target] ?? [];
        if (rhsIds.length === 0) return false;
        const rhsInst = findInstance(state, rhsIds[0]!);
        if (!rhsInst) return false;
        const rhsCard = catalog.get(rhsInst.card_id);
        if (!rhsCard) return false;
        rhsVal = getStatNum(resolveEffectiveStats(rhsInst, rhsCard), cond.rhs.stat);
      }
      return cmp(lhsVal, cond.op, rhsVal);
    }
    case 'coin_flip': {
      const [r] = drawRng(state.rng_seed, state.rng_counter);
      return r >= 0.5;
    }
    case 'dice_roll': {
      const [r] = drawRng(state.rng_seed, state.rng_counter);
      const roll = Math.floor(r * cond.sides) + 1;
      return cmp(roll, cond.op, cond.value);
    }
    case 'controller_chose': {
      const stored = ctx.storedVariables?.[cond.step_ref] ?? [];
      return stored.includes(cond.value);
    }
    default:
      return false;
  }
}

function getStatNum(stats: ReturnType<typeof resolveEffectiveStats>, stat: string): number {
  switch (stat) {
    case 'ap':    return stats.ap;
    case 'hp':    return stats.currentHp;
    case 'level': return stats.level;
    case 'cost':  return stats.cost;
    default:      return 0;
  }
}
