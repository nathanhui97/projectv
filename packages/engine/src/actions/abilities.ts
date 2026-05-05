import type { GameState, MatchAction } from '@project-v/schemas';
import type { CardCatalog } from '../catalog';
import { resolveEffectiveStats, hasKeyword } from '../stats';
import { processQueue } from '../queue';
import { resolveCombatDamage } from './combat';

export function applyActivateAbility(
  state: GameState,
  action: MatchAction,
  catalog: CardCatalog,
): GameState {
  const pi = action.controller_index as 0 | 1;
  const payload = action.payload as {
    source_instance_id: string;
    ability_id: string;
  };

  // Find the source instance and its card
  let sourceInst = null;
  for (const zone of Object.values(state.players[pi].zones)) {
    sourceInst = zone.cards.find(c => c.instance_id === payload.source_instance_id) ?? null;
    if (sourceInst) break;
  }
  if (!sourceInst) throw new Error('Source instance not found');

  const card = catalog.get(sourceInst.card_id);
  if (!card) throw new Error('Card not found in catalog');

  const ability = card.abilities.find(a => a.id === payload.ability_id);
  if (!ability) throw new Error('Ability not found on card');

  // Check trigger type constraints
  const triggerType = ability.trigger.type;
  if (triggerType === 'activated_main') {
    if (state.phase !== 'main' || state.active_player_index !== pi) {
      throw new Error('Activated Main ability can only be used during your Main phase');
    }
  } else if (triggerType === 'activated_action') {
    // Can be used at any time (during attacks etc.) — no phase restriction
  } else if (triggerType === 'activated_main_or_action') {
    // Either main or action timing
  } else {
    throw new Error(`Cannot manually activate trigger type: ${triggerType}`);
  }

  // Check once_per_turn
  if (ability.trigger.qualifiers?.once_per_turn) {
    if (state.players[pi].abilities_used_this_turn.includes(ability.id)) {
      throw new Error('Ability already used this turn');
    }
  }

  // Pay ability cost
  const cost = ability.trigger.cost;
  const s = structuredClone(state);

  if (cost?.rest_self) {
    const inst = findInstInPlayer(s, pi, payload.source_instance_id);
    if (!inst) throw new Error('Source not found');
    if (inst.is_resting) throw new Error('Source is resting (cannot pay rest cost)');
    inst.is_resting = true;
  }

  if (cost?.pay_resources) {
    const resourceCost = cost.pay_resources;
    const activeResources = s.players[pi].zones.resource_area.cards.filter(c => !c.is_resting);
    if (activeResources.length < resourceCost) throw new Error('Not enough resources');
    let paid = 0;
    for (const res of s.players[pi].zones.resource_area.cards) {
      if (!res.is_resting && paid < resourceCost) { res.is_resting = true; paid++; }
    }
  }

  // Track usage
  if (ability.trigger.qualifiers?.once_per_turn) {
    s.players[pi].abilities_used_this_turn = [...s.players[pi].abilities_used_this_turn, ability.id];
  }

  // Push resolution
  s.pending_resolutions.push({
    ability_id: ability.id,
    source_instance_id: payload.source_instance_id,
    controller_index: pi,
    stored_variables: {},
    next_step_index: 0,
  });

  return processQueue(s, catalog);
}

export function applyResolveChoice(
  state: GameState,
  action: MatchAction,
  catalog: CardCatalog,
): GameState {
  const pi = action.controller_index;
  const payload = action.payload as { choice: string | string[] };

  if (state.pending_resolutions.length === 0) throw new Error('No pending resolution');
  const resolution = state.pending_resolutions[0]!;
  if (!resolution.waiting_for) throw new Error('Not waiting for a choice');
  if (resolution.waiting_for.type !== 'choice') throw new Error('Not waiting for a choice');

  const stepRef = resolution.waiting_for.step_ref ?? '__choice__';
  const choiceValue = Array.isArray(payload.choice) ? payload.choice : [payload.choice];

  const s = structuredClone(state);
  s.pending_resolutions[0]!.stored_variables[stepRef] = choiceValue;
  s.pending_resolutions[0]!.waiting_for = undefined;
  s.pending_resolutions[0]!.next_step_index++;

  return processQueue(s, catalog);
}

export function applyResolveManual(
  state: GameState,
  action: MatchAction,
  catalog: CardCatalog,
): GameState {
  if (state.pending_resolutions.length === 0) throw new Error('No pending resolution');
  const resolution = state.pending_resolutions[0]!;
  if (!resolution.waiting_for) throw new Error('Not waiting for manual resolve');
  if (resolution.waiting_for.type !== 'manual_resolve') throw new Error('Not a manual_resolve step');

  const s = structuredClone(state);
  s.pending_resolutions[0]!.waiting_for = undefined;
  s.pending_resolutions[0]!.next_step_index++;

  return processQueue(s, catalog);
}

function findInstInPlayer(state: GameState, pi: 0 | 1, instanceId: string) {
  for (const zone of Object.values(state.players[pi].zones)) {
    const inst = zone.cards.find(c => c.instance_id === instanceId);
    if (inst) return inst;
  }
  return null;
}
