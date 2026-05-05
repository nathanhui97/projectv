/**
 * Filter evaluation for the GCG rules engine.
 *
 * Two formats are supported:
 *
 * 1. Formal Filter union (used in Card.link_conditions, stored via CardSchema)
 *    e.g. { all_of: [{ type: "unit" }, { side: "enemy" }] }
 *
 * 2. Shorthand filter object (used in ability steps stored in Supabase data.abilities)
 *    e.g. { type: "unit", side: "enemy", max_hp: 2, rested: true }
 *    All keys are AND'd together.
 */

import type { Filter, GameState, CardInstance, Zone } from '@project-v/schemas';
import type { CardCatalog } from './catalog';
import { lookupCard } from './catalog';
import { resolveEffectiveStats, hasKeyword } from './stats';

// ─── Context ─────────────────────────────────────────────────────────────────

export interface FilterContext {
  state: GameState;
  catalog: CardCatalog;
  /** Which player index is "friendly" from the ability controller's perspective */
  perspectivePlayerIndex: 0 | 1;
  /** The source instance triggering this ability (for exclude_self) */
  sourceInstanceId?: string;
}

// ─── Zone helpers ─────────────────────────────────────────────────────────────

const BATTLE_ZONES: Zone[] = ['battle_area'];
const FIELD_ZONES: Zone[] = ['battle_area', 'shield_base_section'];

export interface InstanceLocation {
  playerIndex: number;
  zone: Zone;
  instance: CardInstance;
}

export function findInstanceLocation(
  state: GameState,
  instanceId: string,
): InstanceLocation | null {
  for (let pi = 0; pi < 2; pi++) {
    const player = state.players[pi as 0 | 1];
    for (const [zoneName, zoneState] of Object.entries(player.zones)) {
      for (const instance of zoneState.cards) {
        if (instance.instance_id === instanceId) {
          return { playerIndex: pi, zone: zoneName as Zone, instance };
        }
      }
    }
  }
  return null;
}

/** Returns all instances currently in battle_area for both players */
export function allBattleInstances(state: GameState): InstanceLocation[] {
  const results: InstanceLocation[] = [];
  for (let pi = 0; pi < 2; pi++) {
    const player = state.players[pi as 0 | 1];
    for (const instance of player.zones.battle_area.cards) {
      results.push({ playerIndex: pi, zone: 'battle_area', instance });
    }
  }
  return results;
}

/** Returns all instances in all zones for a given player */
function allInstancesForPlayer(state: GameState, playerIndex: number): InstanceLocation[] {
  const results: InstanceLocation[] = [];
  const player = state.players[playerIndex as 0 | 1];
  for (const [zoneName, zoneState] of Object.entries(player.zones)) {
    for (const instance of zoneState.cards) {
      results.push({ playerIndex, zone: zoneName as Zone, instance });
    }
  }
  return results;
}

// ─── Link resolution ──────────────────────────────────────────────────────────

/**
 * A unit is "linked" when it has a paired pilot that satisfies at least one
 * of the unit card's link_conditions.
 */
export function isLinked(
  instance: CardInstance,
  ctx: FilterContext,
): boolean {
  if (!instance.paired_with_instance_id) return false;

  const pilotLoc = findInstanceLocation(ctx.state, instance.paired_with_instance_id);
  if (!pilotLoc) return false;

  const unitCard = lookupCard(ctx.catalog, instance.card_id);
  if (!unitCard.link_conditions || unitCard.link_conditions.length === 0) return false;

  const pilotInstance = pilotLoc.instance;

  return unitCard.link_conditions.some((condition) =>
    evaluateFilter(condition, pilotInstance, ctx),
  );
}

// ─── Formal Filter evaluator ──────────────────────────────────────────────────

export function evaluateFilter(
  filter: Filter,
  instance: CardInstance,
  ctx: FilterContext,
): boolean {
  const baseCard = lookupCard(ctx.catalog, instance.card_id);
  const stats = resolveEffectiveStats(instance, baseCard);
  const loc = findInstanceLocation(ctx.state, instance.instance_id);
  const isFriendly = loc?.playerIndex === ctx.perspectivePlayerIndex;

  if ('side' in filter) {
    if (filter.side === 'friendly') return isFriendly;
    if (filter.side === 'enemy') return !isFriendly;
    return true; // 'any'
  }
  if ('zone' in filter) {
    const zones = Array.isArray(filter.zone) ? filter.zone : [filter.zone];
    return zones.includes(loc?.zone as Zone);
  }
  if ('type' in filter) {
    const types = Array.isArray(filter.type) ? filter.type : [filter.type];
    return types.includes(stats.type as any);
  }
  if ('color' in filter) {
    const colors = Array.isArray(filter.color) ? filter.color : [filter.color];
    return colors.includes(stats.color as any);
  }
  if ('traits_include' in filter) {
    return filter.traits_include.every((t) => stats.traits.includes(t));
  }
  if ('traits_any' in filter) {
    return filter.traits_any.some((t) => stats.traits.includes(t));
  }
  if ('traits_exclude' in filter) {
    return !filter.traits_exclude.some((t) => stats.traits.includes(t));
  }
  if ('cost' in filter) {
    return compareNum(stats.cost, filter.cost.op, filter.cost.value);
  }
  if ('level' in filter) {
    return compareNum(stats.level, filter.level.op, filter.level.value);
  }
  if ('ap' in filter) {
    return compareNum(stats.ap, filter.ap.op, filter.ap.value);
  }
  if ('hp' in filter) {
    return compareNum(stats.currentHp, filter.hp.op, filter.hp.value);
  }
  if ('has_keyword' in filter) {
    return filter.has_keyword.every((k) => hasKeyword(stats, k));
  }
  if ('has_any_keyword' in filter) {
    return filter.has_any_keyword.some((k) => hasKeyword(stats, k));
  }
  if ('is_paired' in filter) {
    return filter.is_paired === (instance.paired_with_instance_id !== undefined);
  }
  if ('is_linked' in filter) {
    return filter.is_linked === isLinked(instance, ctx);
  }
  if ('is_resting' in filter) {
    return filter.is_resting === instance.is_resting;
  }
  if ('is_active' in filter) {
    return filter.is_active === !instance.is_resting;
  }
  if ('is_damaged' in filter) {
    return filter.is_damaged === (instance.damage > 0);
  }
  if ('name_is' in filter) {
    return baseCard.name === filter.name_is;
  }
  if ('name_includes' in filter) {
    return baseCard.name.includes(filter.name_includes);
  }
  if ('set_code' in filter) {
    const codes = Array.isArray(filter.set_code) ? filter.set_code : [filter.set_code];
    return codes.includes(baseCard.set_code);
  }
  if ('card_id' in filter) {
    const ids = Array.isArray(filter.card_id) ? filter.card_id : [filter.card_id];
    return ids.includes(instance.card_id);
  }
  if ('exclude_self' in filter) {
    return filter.exclude_self ? instance.instance_id !== ctx.sourceInstanceId : true;
  }
  if ('exclude' in filter) {
    return !filter.exclude.includes(instance.instance_id);
  }
  if ('all_of' in filter) {
    return filter.all_of.every((f) => evaluateFilter(f, instance, ctx));
  }
  if ('any_of' in filter) {
    return filter.any_of.some((f) => evaluateFilter(f, instance, ctx));
  }
  if ('not' in filter) {
    return !evaluateFilter(filter.not, instance, ctx);
  }

  return false;
}

// ─── Shorthand filter evaluator ───────────────────────────────────────────────

/**
 * Evaluates the flat shorthand filter objects stored in ability step data.
 *
 * Shorthand keys AND their formal equivalents:
 *   type, side, color        → formal (handled directly)
 *   traits                   → traits_include
 *   max_hp: N                → hp <= N
 *   min_hp: N                → hp >= N
 *   max_level: N             → level <= N
 *   min_level: N             → level >= N
 *   max_ap: N                → ap <= N
 *   min_ap: N                → ap >= N
 *   rested: true/false       → is_resting
 *   is_linked: true/false    → formal is_linked
 *   is_damaged: true/false   → formal is_damaged
 *   is_token: true           → type === "token"
 *   not_linked: true         → !is_linked
 *   not_self: true           → exclude_self
 */
export function evaluateShorthandFilter(
  obj: Record<string, unknown>,
  instance: CardInstance,
  ctx: FilterContext,
): boolean {
  const baseCard = lookupCard(ctx.catalog, instance.card_id);
  const stats = resolveEffectiveStats(instance, baseCard);
  const loc = findInstanceLocation(ctx.state, instance.instance_id);
  const isFriendly = loc?.playerIndex === ctx.perspectivePlayerIndex;

  for (const [key, val] of Object.entries(obj)) {
    switch (key) {
      case 'type': {
        const types = Array.isArray(val) ? val : [val];
        if (!types.includes(stats.type)) return false;
        break;
      }
      case 'side': {
        if (val === 'friendly' && !isFriendly) return false;
        if (val === 'enemy' && isFriendly) return false;
        break;
      }
      case 'color': {
        if (val !== stats.color) return false;
        break;
      }
      case 'traits':
      case 'traits_include': {
        const required = val as string[];
        if (!required.every((t) => stats.traits.includes(t))) return false;
        break;
      }
      case 'traits_any': {
        const any = val as string[];
        if (!any.some((t) => stats.traits.includes(t))) return false;
        break;
      }
      case 'max_hp': {
        if (stats.currentHp > (val as number)) return false;
        break;
      }
      case 'min_hp': {
        if (stats.currentHp < (val as number)) return false;
        break;
      }
      case 'max_level': {
        if (stats.level > (val as number)) return false;
        break;
      }
      case 'min_level': {
        if (stats.level < (val as number)) return false;
        break;
      }
      case 'max_ap': {
        if (stats.ap > (val as number)) return false;
        break;
      }
      case 'min_ap': {
        if (stats.ap < (val as number)) return false;
        break;
      }
      case 'rested': {
        if ((val as boolean) !== instance.is_resting) return false;
        break;
      }
      case 'is_resting': {
        if ((val as boolean) !== instance.is_resting) return false;
        break;
      }
      case 'is_linked': {
        if ((val as boolean) !== isLinked(instance, ctx)) return false;
        break;
      }
      case 'not_linked': {
        if ((val as boolean) === isLinked(instance, ctx)) return false;
        break;
      }
      case 'is_damaged': {
        if ((val as boolean) !== (instance.damage > 0)) return false;
        break;
      }
      case 'is_token': {
        if (val === true && stats.type !== 'token') return false;
        if (val === false && stats.type === 'token') return false;
        break;
      }
      case 'not_self': {
        if (val === true && instance.instance_id === ctx.sourceInstanceId) return false;
        break;
      }
      case 'has_keyword': {
        const kws = Array.isArray(val) ? val : [val];
        if (!kws.every((k) => hasKeyword(stats, k as string))) return false;
        break;
      }
      // Ignore unknown shorthand keys — forward compatibility
    }
  }
  return true;
}

/**
 * Converts a shorthand filter object to the formal Filter union format (all_of).
 * Useful for storing normalized filters or for validation.
 */
export function normalizeShorthandFilter(obj: Record<string, unknown>): Filter {
  const conditions: Filter[] = [];

  for (const [key, val] of Object.entries(obj)) {
    switch (key) {
      case 'type':
        conditions.push({ type: val as any });
        break;
      case 'side':
        conditions.push({ side: val as any });
        break;
      case 'color':
        conditions.push({ color: val as any });
        break;
      case 'traits':
      case 'traits_include':
        conditions.push({ traits_include: val as string[] });
        break;
      case 'traits_any':
        conditions.push({ traits_any: val as string[] });
        break;
      case 'max_hp':
        conditions.push({ hp: { op: '<=', value: val as number } });
        break;
      case 'min_hp':
        conditions.push({ hp: { op: '>=', value: val as number } });
        break;
      case 'max_level':
        conditions.push({ level: { op: '<=', value: val as number } });
        break;
      case 'min_level':
        conditions.push({ level: { op: '>=', value: val as number } });
        break;
      case 'max_ap':
        conditions.push({ ap: { op: '<=', value: val as number } });
        break;
      case 'min_ap':
        conditions.push({ ap: { op: '>=', value: val as number } });
        break;
      case 'rested':
      case 'is_resting':
        conditions.push({ is_resting: val as boolean });
        break;
      case 'is_linked':
        conditions.push({ is_linked: val as boolean });
        break;
      case 'not_linked':
        conditions.push({ not: { is_linked: true } });
        break;
      case 'is_damaged':
        conditions.push({ is_damaged: val as boolean });
        break;
      case 'is_token':
        conditions.push(val ? { type: 'token' } : { not: { type: 'token' } });
        break;
      case 'not_self':
        if (val) conditions.push({ exclude_self: true });
        break;
      case 'has_keyword':
        conditions.push({ has_keyword: (Array.isArray(val) ? val : [val]) as any });
        break;
    }
  }

  if (conditions.length === 0) return { all_of: [] };
  if (conditions.length === 1) return conditions[0]!;
  return { all_of: conditions };
}

/**
 * Returns all instances on the field that match a shorthand filter.
 * "Field" = battle_area for units, shield_base_section for bases.
 */
export function findMatchingInstances(
  obj: Record<string, unknown>,
  ctx: FilterContext,
): InstanceLocation[] {
  const results: InstanceLocation[] = [];
  for (let pi = 0; pi < 2; pi++) {
    const player = ctx.state.players[pi as 0 | 1];
    for (const [zoneName, zoneState] of Object.entries(player.zones)) {
      for (const instance of zoneState.cards) {
        if (evaluateShorthandFilter(obj, instance, ctx)) {
          results.push({ playerIndex: pi, zone: zoneName as Zone, instance });
        }
      }
    }
  }
  return results;
}

// ─── Numeric comparison helper ────────────────────────────────────────────────

function compareNum(actual: number, op: string, value: number): boolean {
  switch (op) {
    case '=':  return actual === value;
    case '!=': return actual !== value;
    case '<':  return actual < value;
    case '>':  return actual > value;
    case '<=': return actual <= value;
    case '>=': return actual >= value;
    default:   return false;
  }
}
