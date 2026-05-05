/**
 * Step resolver — executes one ability step against the game state.
 * Returns either a completed state or a "waiting" signal for player input.
 */
import type { GameState, CardInstance, Zone, PendingResolution } from '@project-v/schemas';
import type { CardCatalog } from './catalog';
import type { FilterContext, InstanceLocation } from './filter';
import { evaluateFilter, findInstanceLocation, allBattleInstances } from './filter';
import { resolveEffectiveStats, hasKeyword } from './stats';
import { evaluateCondition, type ConditionContext } from './conditions';
import { drawRng, shuffleArray } from './rng';
import { setWinner } from './win';

// ─── Types ────────────────────────────────────────────────────────────────────

export type StepDone = { kind: 'done'; state: GameState };
export type StepWaiting = {
  kind: 'waiting';
  state: GameState;
  waitingFor: PendingResolution['waiting_for'];
};
export type StepResult = StepDone | StepWaiting;

export interface StepContext {
  state: GameState;
  catalog: CardCatalog;
  resolution: PendingResolution;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function filterCtx(
  state: GameState,
  catalog: CardCatalog,
  controllerIndex: 0 | 1,
  sourceInstanceId?: string,
): FilterContext {
  return { state, catalog, perspectivePlayerIndex: controllerIndex, sourceInstanceId };
}

function condCtx(ctx: StepContext): ConditionContext {
  const ci = ctx.resolution.controller_index as 0 | 1;
  return {
    state: ctx.state,
    catalog: ctx.catalog,
    controllerIndex: ci,
    sourceInstanceId: ctx.resolution.source_instance_id,
    storedVariables: ctx.resolution.stored_variables,
  };
}

function resolvePlayerIndex(side: string, ci: 0 | 1): 0 | 1 {
  return side === 'friendly' ? ci : ((1 - ci) as 0 | 1);
}

// Find an instance anywhere in the state
function findInState(state: GameState, instanceId: string): { inst: CardInstance; pi: 0 | 1; zone: Zone } | null {
  for (let pi = 0; pi < 2; pi++) {
    const player = state.players[pi as 0 | 1];
    for (const [zoneName, zoneState] of Object.entries(player.zones)) {
      for (const inst of zoneState.cards) {
        if (inst.instance_id === instanceId) {
          return { inst, pi: pi as 0 | 1, zone: zoneName as Zone };
        }
      }
    }
  }
  return null;
}

// Remove an instance from its current zone; returns [newState, removed instance or null]
function removeFromZone(state: GameState, instanceId: string): [GameState, CardInstance | null] {
  const s = structuredClone(state);
  for (let pi = 0; pi < 2; pi++) {
    const player = s.players[pi as 0 | 1];
    for (const [zoneName, zoneState] of Object.entries(player.zones)) {
      const idx = zoneState.cards.findIndex(c => c.instance_id === instanceId);
      if (idx !== -1) {
        const [removed] = zoneState.cards.splice(idx, 1);
        return [s, removed!];
      }
    }
  }
  return [s, null];
}

// Move an instance to a specific zone for a player
function placeInZone(state: GameState, inst: CardInstance, pi: 0 | 1, zone: Zone): GameState {
  const s = structuredClone(state);
  s.players[pi].zones[zone].cards.push(inst);
  return s;
}

// Move an instance to the specified zone (same owner)
function moveInstanceToZone(state: GameState, instanceId: string, destZone: Zone, destPi?: 0 | 1): GameState {
  const found = findInState(state, instanceId);
  if (!found) return state;
  const [s2, removed] = removeFromZone(state, instanceId);
  if (!removed) return state;
  const pi = destPi ?? (found.pi as 0 | 1);
  removed.is_face_down = false; // cards become face-up when moved unless overridden
  return placeInZone(s2, removed, pi, destZone);
}

// Resolve a TargetRef to a list of instance IDs
function resolveTargetRef(
  target: string | { filter: unknown },
  ctx: StepContext,
): string[] {
  if (typeof target === 'string') {
    // Variable reference like "$target" or literal instance ID
    if (target.startsWith('$')) {
      return ctx.resolution.stored_variables[target.slice(1)] ?? [];
    }
    return [target];
  }
  // { filter: FilterSchema } — find all matching right now
  const ci = ctx.resolution.controller_index as 0 | 1;
  const fCtx = filterCtx(ctx.state, ctx.catalog, ci, ctx.resolution.source_instance_id);
  const results: string[] = [];
  for (let pi = 0; pi < 2; pi++) {
    const player = ctx.state.players[pi as 0 | 1];
    for (const zone of Object.values(player.zones) as Array<{ cards: CardInstance[] }>) {
      for (const inst of zone.cards) {
        if (evaluateFilter(target.filter as Parameters<typeof evaluateFilter>[0], inst, fCtx)) {
          results.push(inst.instance_id);
        }
      }
    }
  }
  return results;
}

// Generate the next unique instance ID
function nextIid(state: GameState): string {
  return `${state.match_id}-auto-${state.action_sequence_number}-${Date.now()}`;
}

// ─── Step resolver ────────────────────────────────────────────────────────────

export function resolveStep(step: Record<string, unknown>, ctx: StepContext): StepResult {
  const ci = ctx.resolution.controller_index as 0 | 1;
  const oppi = (1 - ci) as 0 | 1;
  let state = ctx.state;

  // Check step-level condition
  if (step.condition) {
    const passes = evaluateCondition(step.condition as any, condCtx(ctx));
    if (!passes) return { kind: 'done', state };
  }

  const action = step.action as string;

  switch (action) {

    // ── Targeting ─────────────────────────────────────────────────────────────

    case 'choose_target': {
      const filter = step.filter as Parameters<typeof evaluateFilter>[0];
      const selector = step.selector as string;
      const storeAs = step.store_as as string;
      const fCtx = filterCtx(state, ctx.catalog, ci, ctx.resolution.source_instance_id);

      const candidates: string[] = [];
      for (let pi = 0; pi < 2; pi++) {
        for (const zone of Object.values(state.players[pi as 0 | 1].zones) as Array<{ cards: CardInstance[] }>) {
          for (const inst of zone.cards) {
            if (evaluateFilter(filter, inst, fCtx)) candidates.push(inst.instance_id);
          }
        }
      }

      if (candidates.length === 0) return { kind: 'done', state };

      if (selector === 'random') {
        const [r, nc] = drawRng(state.rng_seed, state.rng_counter);
        state = structuredClone(state);
        state.rng_counter = nc;
        const idx = Math.floor(r * candidates.length);
        const stored = structuredClone(ctx.resolution.stored_variables);
        stored[storeAs] = [candidates[idx]!];
        // Update resolution stored_variables in state
        state = updateResolutionVars(state, ctx.resolution, stored);
        return { kind: 'done', state };
      }

      // Needs player input
      const chooserType = selector === 'controller_chooses' ? 'choice' : 'choice';
      return {
        kind: 'waiting',
        state,
        waitingFor: {
          type: chooserType,
          prompt: (step.prompt as string | undefined) ?? 'Choose a target',
          step_ref: storeAs,
        },
      };
    }

    case 'all_matching': {
      const filter = step.filter as Parameters<typeof evaluateFilter>[0];
      const storeAs = step.store_as as string;
      const fCtx = filterCtx(state, ctx.catalog, ci, ctx.resolution.source_instance_id);
      const ids: string[] = [];
      for (let pi = 0; pi < 2; pi++) {
        for (const zone of Object.values(state.players[pi as 0 | 1].zones) as Array<{ cards: CardInstance[] }>) {
          for (const inst of zone.cards) {
            if (evaluateFilter(filter, inst, fCtx)) ids.push(inst.instance_id);
          }
        }
      }
      const stored = { ...ctx.resolution.stored_variables, [storeAs]: ids };
      state = updateResolutionVars(state, ctx.resolution, stored);
      return { kind: 'done', state };
    }

    case 'search_deck': {
      // For now, treat as a waiting-for-player-choice step
      const storeAs = step.store_as as string | undefined;
      return {
        kind: 'waiting',
        state,
        waitingFor: {
          type: 'choice',
          prompt: 'Search your deck and choose a card',
          step_ref: storeAs ?? '__search__',
        },
      };
    }

    case 'count_zone': {
      const side = step.side as string;
      const zoneName = step.zone as Zone;
      const storeAs = step.store_as as string;
      const pi = resolvePlayerIndex(side, ci);
      let cards = state.players[pi].zones[zoneName].cards;
      if (step.filter) {
        const fCtx = filterCtx(state, ctx.catalog, ci);
        cards = cards.filter(inst => evaluateFilter(step.filter as any, inst, fCtx));
      }
      const stored = { ...ctx.resolution.stored_variables, [storeAs]: [String(cards.length)] };
      state = updateResolutionVars(state, ctx.resolution, stored);
      return { kind: 'done', state };
    }

    // ── Card movement ─────────────────────────────────────────────────────────

    case 'move_to_hand': {
      const ids = resolveTargetRef(step.target as any, ctx);
      for (const id of ids) state = moveInstanceToZone(state, id, 'hand');
      return { kind: 'done', state };
    }
    case 'move_to_deck_top': {
      const ids = resolveTargetRef(step.target as any, ctx);
      for (const id of ids) {
        const found = findInState(state, id);
        if (!found) continue;
        const [s2, removed] = removeFromZone(state, id);
        if (!removed) continue;
        removed.is_face_down = true;
        const s3 = structuredClone(s2);
        s3.players[found.pi as 0 | 1].zones.deck.cards.unshift(removed);
        state = s3;
      }
      return { kind: 'done', state };
    }
    case 'move_to_deck_bottom': {
      const ids = resolveTargetRef(step.target as any, ctx);
      for (const id of ids) {
        const found = findInState(state, id);
        if (!found) continue;
        const [s2, removed] = removeFromZone(state, id);
        if (!removed) continue;
        removed.is_face_down = true;
        const s3 = structuredClone(s2);
        s3.players[found.pi as 0 | 1].zones.deck.cards.push(removed);
        state = s3;
      }
      return { kind: 'done', state };
    }
    case 'move_to_trash':
    case 'discard': {
      const ids = resolveTargetRef(step.target as any, ctx);
      for (const id of ids) {
        const found = findInState(state, id);
        if (!found) continue;
        state = moveInstanceToZone(state, id, 'trash', found.pi as 0 | 1);
      }
      return { kind: 'done', state };
    }
    case 'move_to_resource': {
      const ids = resolveTargetRef(step.target as any, ctx);
      for (const id of ids) {
        const found = findInState(state, id);
        if (!found) continue;
        const s2 = moveInstanceToZone(state, id, 'resource_area', found.pi as 0 | 1);
        // Mark as rested (resources placed face-down / rested)
        const s3 = structuredClone(s2);
        const arr = s3.players[found.pi].zones.resource_area.cards;
        const inst = arr.find(c => c.instance_id === id);
        if (inst) inst.is_resting = true;
        state = s3;
      }
      return { kind: 'done', state };
    }
    case 'move_to_shield': {
      const ids = resolveTargetRef(step.target as any, ctx);
      for (const id of ids) {
        const found = findInState(state, id);
        if (!found) continue;
        const [s2, removed] = removeFromZone(state, id);
        if (!removed) continue;
        removed.is_face_down = true;
        const s3 = structuredClone(s2);
        s3.players[found.pi as 0 | 1].zones.shield_area.cards.push(removed);
        state = s3;
      }
      return { kind: 'done', state };
    }
    case 'exile': {
      const ids = resolveTargetRef(step.target as any, ctx);
      for (const id of ids) {
        const found = findInState(state, id);
        if (!found) continue;
        state = moveInstanceToZone(state, id, 'removed_from_game', found.pi as 0 | 1);
      }
      return { kind: 'done', state };
    }
    case 'mill': {
      // Mill = discard from top of deck
      const ids = resolveTargetRef(step.target as any, ctx);
      for (const id of ids) {
        const found = findInState(state, id);
        if (!found) continue;
        state = moveInstanceToZone(state, id, 'trash', found.pi as 0 | 1);
      }
      return { kind: 'done', state };
    }
    case 'discard_from_hand': {
      const side = step.side as string;
      const pi = resolvePlayerIndex(side, ci);
      const amount = step.amount as number | 'all';

      if (amount === 'all') {
        const s = structuredClone(state);
        const cards = [...s.players[pi].zones.hand.cards];
        s.players[pi].zones.hand.cards = [];
        s.players[pi].zones.trash.cards.push(...cards);
        state = s;
        return { kind: 'done', state };
      }

      const chooser = step.selector ?? 'controller_chooses';
      if (chooser === 'random') {
        let s = structuredClone(state);
        for (let i = 0; i < amount; i++) {
          const handLen = s.players[pi].zones.hand.cards.length;
          if (handLen === 0) break;
          const [r, nc] = drawRng(s.rng_seed, s.rng_counter);
          s.rng_counter = nc;
          const idx = Math.floor(r * handLen);
          const [discarded] = s.players[pi].zones.hand.cards.splice(idx, 1);
          s.players[pi].zones.trash.cards.push(discarded!);
        }
        state = s;
        return { kind: 'done', state };
      }

      // Needs player choice
      return {
        kind: 'waiting',
        state,
        waitingFor: { type: 'choice', prompt: `Discard ${amount} card(s) from hand` },
      };
    }

    case 'deploy_card': {
      const ids = resolveTargetRef(step.target as any, ctx);
      for (const id of ids) {
        const found = findInState(state, id);
        if (!found) continue;
        const card = ctx.catalog.get(found.inst.card_id);
        if (!card) continue;
        const destZone: Zone = card.type === 'base' ? 'shield_base_section' : 'battle_area';
        const [s2, removed] = removeFromZone(state, id);
        if (!removed) continue;
        removed.is_face_down = false;
        removed.is_resting = false;
        state = placeInZone(s2, removed, found.pi as 0 | 1, destZone);
      }
      return { kind: 'done', state };
    }

    case 'pair_pilot': {
      const pilotIds = resolveTargetRef(step.pilot as any, ctx);
      const unitIds = resolveTargetRef(step.unit as any, ctx);
      if (pilotIds.length === 0 || unitIds.length === 0) return { kind: 'done', state };

      const pilotId = pilotIds[0]!;
      const unitId = unitIds[0]!;
      const pilotLoc = findInState(state, pilotId);
      const unitLoc = findInState(state, unitId);
      if (!pilotLoc || !unitLoc) return { kind: 'done', state };

      // Move pilot to battle_area alongside the unit, paired
      const [s2, pilotInst] = removeFromZone(state, pilotId);
      if (!pilotInst) return { kind: 'done', state };
      pilotInst.is_face_down = false;

      const s3 = structuredClone(s2);
      // Set pairing on unit
      const unitInState = findInState(s3, unitId);
      if (unitInState) unitInState.inst.paired_with_instance_id = pilotId;
      pilotInst.paired_with_instance_id = unitId;
      s3.players[pilotLoc.pi as 0 | 1].zones.battle_area.cards.push(pilotInst);
      state = s3;
      return { kind: 'done', state };
    }

    // ── Damage and combat ─────────────────────────────────────────────────────

    case 'deal_damage': {
      const ids = resolveTargetRef(step.target as any, ctx);
      const amount = step.amount as number;
      let s = structuredClone(state);
      for (const id of ids) {
        const found = findInState(s, id);
        if (!found) continue;
        found.inst.damage += amount;
        // Check for destruction
        const card = ctx.catalog.get(found.inst.card_id);
        if (card) {
          const stats = resolveEffectiveStats(found.inst, card);
          if (found.inst.damage >= stats.hp) {
            // Destroy the card
            s = destroyInstance(s, id);
          }
        }
      }
      state = s;
      return { kind: 'done', state };
    }

    case 'destroy': {
      const ids = resolveTargetRef(step.target as any, ctx);
      let s = state;
      for (const id of ids) s = destroyInstance(s, id);
      state = s;
      return { kind: 'done', state };
    }

    case 'heal': {
      const ids = resolveTargetRef(step.target as any, ctx);
      const amount = step.amount as number | 'all';
      const s = structuredClone(state);
      for (const id of ids) {
        const found = findInState(s, id);
        if (!found) continue;
        if (amount === 'all') {
          found.inst.damage = 0;
        } else {
          found.inst.damage = Math.max(0, found.inst.damage - amount);
        }
      }
      state = s;
      return { kind: 'done', state };
    }

    // ── Stat modification ─────────────────────────────────────────────────────

    case 'modify_stat': {
      const ids = resolveTargetRef(step.target as any, ctx);
      const stat = step.stat as string;
      const amount = step.amount as number;
      const duration = step.duration as string;
      const s = structuredClone(state);
      for (const id of ids) {
        const found = findInState(s, id);
        if (!found) continue;
        found.inst.temporary_modifiers.push({
          source_ability_id: ctx.resolution.ability_id,
          stat,
          amount,
          duration,
        });
      }
      state = s;
      return { kind: 'done', state };
    }

    case 'set_stat': {
      // Compute delta from base and apply as a modifier
      const ids = resolveTargetRef(step.target as any, ctx);
      const stat = step.stat as string;
      const value = step.value as number;
      const duration = step.duration as string;
      const s = structuredClone(state);
      for (const id of ids) {
        const found = findInState(s, id);
        if (!found) continue;
        const card = ctx.catalog.get(found.inst.card_id);
        if (!card) continue;
        const base = stat === 'ap' ? (card.ap ?? 0) : (card.hp ?? 0);
        const delta = value - base;
        found.inst.temporary_modifiers.push({
          source_ability_id: ctx.resolution.ability_id,
          stat,
          amount: delta,
          duration,
        });
      }
      state = s;
      return { kind: 'done', state };
    }

    case 'gain_keyword': {
      const ids = resolveTargetRef(step.target as any, ctx);
      const keywords = step.keywords as Array<{ keyword: string; amount?: number }>;
      const duration = step.duration as string;
      const s = structuredClone(state);
      for (const id of ids) {
        const found = findInState(s, id);
        if (!found) continue;
        for (const kw of keywords) {
          found.inst.temporary_modifiers.push({
            source_ability_id: ctx.resolution.ability_id,
            keyword: kw.keyword,
            amount: kw.amount,
            duration,
          });
        }
      }
      state = s;
      return { kind: 'done', state };
    }

    case 'lose_keyword': {
      // Add a negative modifier to suppress the keyword
      // For now, mark it as a removal in temporary_modifiers with amount=-1
      const ids = resolveTargetRef(step.target as any, ctx);
      const keywords = step.keywords as string[];
      const duration = step.duration as string;
      const s = structuredClone(state);
      for (const id of ids) {
        const found = findInState(s, id);
        if (!found) continue;
        for (const kw of keywords) {
          found.inst.temporary_modifiers.push({
            source_ability_id: ctx.resolution.ability_id,
            keyword: `remove:${kw}`,
            duration,
          });
        }
      }
      state = s;
      return { kind: 'done', state };
    }

    case 'gain_traits': {
      const ids = resolveTargetRef(step.target as any, ctx);
      const traits = step.traits as string[];
      const duration = step.duration as string;
      const s = structuredClone(state);
      for (const id of ids) {
        const found = findInState(s, id);
        if (!found) continue;
        for (const trait of traits) {
          found.inst.temporary_modifiers.push({
            source_ability_id: ctx.resolution.ability_id,
            trait,
            duration,
          });
        }
      }
      state = s;
      return { kind: 'done', state };
    }

    // ── State changes ─────────────────────────────────────────────────────────

    case 'rest': {
      const ids = resolveTargetRef(step.target as any, ctx);
      const s = structuredClone(state);
      for (const id of ids) {
        const found = findInState(s, id);
        if (found) found.inst.is_resting = true;
      }
      state = s;
      return { kind: 'done', state };
    }

    case 'ready': {
      const ids = resolveTargetRef(step.target as any, ctx);
      const s = structuredClone(state);
      for (const id of ids) {
        const found = findInState(s, id);
        if (found) found.inst.is_resting = false;
      }
      state = s;
      return { kind: 'done', state };
    }

    case 'prevent_ready': {
      const ids = resolveTargetRef(step.target as any, ctx);
      const duration = step.duration as string;
      const s = structuredClone(state);
      for (const id of ids) {
        const found = findInState(s, id);
        if (!found) continue;
        found.inst.temporary_modifiers.push({
          source_ability_id: ctx.resolution.ability_id,
          stat: 'prevent_ready',
          duration,
        });
      }
      state = s;
      return { kind: 'done', state };
    }

    case 'grant_taunt': {
      const ids = resolveTargetRef(step.target as any, ctx);
      const duration = step.duration as string;
      const s = structuredClone(state);
      for (const id of ids) {
        const found = findInState(s, id);
        if (!found) continue;
        found.inst.temporary_modifiers.push({
          source_ability_id: ctx.resolution.ability_id,
          keyword: 'blocker',
          duration,
        });
      }
      state = s;
      return { kind: 'done', state };
    }

    case 'add_counter': {
      const ids = resolveTargetRef(step.target as any, ctx);
      const counterName = step.counter_name as string;
      const amount = step.amount as number;
      const s = structuredClone(state);
      for (const id of ids) {
        const found = findInState(s, id);
        if (!found) continue;
        found.inst.counters[counterName] = (found.inst.counters[counterName] ?? 0) + amount;
      }
      state = s;
      return { kind: 'done', state };
    }

    case 'remove_counter': {
      const ids = resolveTargetRef(step.target as any, ctx);
      const counterName = step.counter_name as string;
      const amount = step.amount as number | 'all';
      const s = structuredClone(state);
      for (const id of ids) {
        const found = findInState(s, id);
        if (!found) continue;
        if (amount === 'all') {
          found.inst.counters[counterName] = 0;
        } else {
          found.inst.counters[counterName] = Math.max(0, (found.inst.counters[counterName] ?? 0) - amount);
        }
      }
      state = s;
      return { kind: 'done', state };
    }

    // ── Resources ─────────────────────────────────────────────────────────────

    case 'add_ex_resource': {
      const side = step.side as string;
      const amount = step.amount as number;
      const pi = resolvePlayerIndex(side, ci);
      let s = structuredClone(state);
      for (let i = 0; i < amount; i++) {
        const inst: CardInstance = {
          instance_id: `${state.match_id}-ex-${Date.now()}-${i}`,
          card_id: '__ex_resource__',
          is_resting: false,
          is_face_down: false,
          damage: 0,
          counters: {},
          temporary_modifiers: [],
        };
        s.players[pi].zones.resource_area.cards.push(inst);
      }
      state = s;
      return { kind: 'done', state };
    }

    case 'modify_cost': {
      // No direct instance — applies to card costs. Complex static effect. Skip for now.
      return { kind: 'done', state };
    }

    // ── Draw / deck ───────────────────────────────────────────────────────────

    case 'draw': {
      const side = step.side as string;
      const amount = step.amount as number;
      const pi = resolvePlayerIndex(side, ci);
      let s = structuredClone(state);
      for (let i = 0; i < amount; i++) {
        const deck = s.players[pi].zones.deck.cards;
        if (deck.length === 0) break; // deck out — handled elsewhere
        const [drawn] = deck.splice(0, 1);
        drawn!.is_face_down = false;
        s.players[pi].zones.hand.cards.push(drawn!);
      }
      state = s;
      return { kind: 'done', state };
    }

    case 'shuffle': {
      const side = step.side as string;
      const zoneName = step.zone as Zone;
      const pi = resolvePlayerIndex(side, ci);
      const s = structuredClone(state);
      const [shuffled, nc] = shuffleArray(
        s.players[pi].zones[zoneName].cards,
        s.rng_seed,
        s.rng_counter,
      );
      s.players[pi].zones[zoneName].cards = shuffled;
      s.rng_counter = nc;
      state = s;
      return { kind: 'done', state };
    }

    case 'reveal': {
      // In hotseat all cards are visible anyway — no-op for now
      return { kind: 'done', state };
    }

    case 'look_at':
    case 'peek_top': {
      return { kind: 'done', state };
    }

    // ── Tokens ────────────────────────────────────────────────────────────────

    case 'create_token': {
      const side = step.side as string;
      const count = (step.count as number | undefined) ?? 1;
      const zoneName = (step.zone as Zone | undefined) ?? 'battle_area';
      const pi = resolvePlayerIndex(side, ci);
      const s = structuredClone(state);
      const tokenCardId = (step.token_id as string | undefined) ?? '__inline_token__';
      for (let i = 0; i < count; i++) {
        const inst: CardInstance = {
          instance_id: `${state.match_id}-token-${state.action_sequence_number}-${i}`,
          card_id: tokenCardId,
          is_resting: (step.rest_state as string | undefined) === 'rested',
          is_face_down: false,
          damage: 0,
          counters: {},
          temporary_modifiers: [],
        };
        s.players[pi].zones[zoneName].cards.push(inst);
      }
      state = s;
      return { kind: 'done', state };
    }

    // ── Player choices ────────────────────────────────────────────────────────

    case 'prompt_yes_no': {
      return {
        kind: 'waiting',
        state,
        waitingFor: {
          type: 'choice',
          prompt: step.prompt as string,
          step_ref: step.store_as as string,
        },
      };
    }

    case 'prompt_choice': {
      return {
        kind: 'waiting',
        state,
        waitingFor: {
          type: 'choice',
          prompt: step.prompt as string,
          step_ref: step.store_as as string,
        },
      };
    }

    case 'prompt_number': {
      return {
        kind: 'waiting',
        state,
        waitingFor: {
          type: 'choice',
          prompt: step.prompt as string,
          step_ref: step.store_as as string,
        },
      };
    }

    case 'manual_resolve': {
      return {
        kind: 'waiting',
        state,
        waitingFor: {
          type: 'manual_resolve',
          prompt: step.prompt_text as string,
        },
      };
    }

    case 'change_attack_target': {
      // Redirect the current attack to a new target
      if (!state.attack_substate) return { kind: 'done', state };
      const newTargetIds = resolveTargetRef(step.new_target as any, ctx);
      if (newTargetIds.length === 0) return { kind: 'done', state };
      const s = structuredClone(state);
      s.attack_substate!.target = { kind: 'unit', instance_id: newTargetIds[0]! };
      state = s;
      return { kind: 'done', state };
    }

    case 'copy_abilities':
    case 'noop':
    default:
      return { kind: 'done', state };
  }
}

// ─── Destruction helper ───────────────────────────────────────────────────────

export function destroyInstance(state: GameState, instanceId: string): GameState {
  const found = findInState(state, instanceId);
  if (!found) return state;

  const [s2, removed] = removeFromZone(state, instanceId);
  if (!removed) return state;

  // Unpair partner if any
  let s3 = structuredClone(s2);
  if (removed.paired_with_instance_id) {
    const partnerLoc = findInState(s3, removed.paired_with_instance_id);
    if (partnerLoc) {
      partnerLoc.inst.paired_with_instance_id = undefined;
    }
  }

  // Move to trash
  removed.is_face_down = false;
  removed.damage = 0;
  removed.temporary_modifiers = [];
  s3.players[found.pi as 0 | 1].zones.trash.cards.push(removed);

  return s3;
}

// ─── Resolution variable update helper ───────────────────────────────────────

function updateResolutionVars(
  state: GameState,
  resolution: PendingResolution,
  stored_variables: Record<string, string[]>,
): GameState {
  const s = structuredClone(state);
  const idx = s.pending_resolutions.findIndex(
    r => r.ability_id === resolution.ability_id && r.source_instance_id === resolution.source_instance_id,
  );
  if (idx !== -1) {
    s.pending_resolutions[idx]!.stored_variables = stored_variables;
  }
  return s;
}
