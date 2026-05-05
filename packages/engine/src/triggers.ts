/**
 * Trigger collection — after any state mutation, scan all cards in play
 * and collect abilities whose trigger conditions are satisfied.
 * Returns PendingResolution entries to push onto the queue.
 */
import type { GameState, PendingResolution, CardInstance } from '@project-v/schemas';
import type { CardCatalog } from './catalog';
import type { FilterContext } from './filter';
import { isLinked } from './filter';
import { resolveEffectiveStats, hasKeyword } from './stats';

type TriggerEvent =
  | { type: 'on_deploy'; instanceId: string }
  | { type: 'on_destroyed'; instanceId: string; controllerIndex: 0 | 1 }
  | { type: 'on_burst'; instanceId: string }
  | { type: 'on_pair'; instanceId: string }
  | { type: 'on_attack'; instanceId: string }
  | { type: 'on_attacked'; instanceId: string }
  | { type: 'on_damage_dealt'; instanceId: string }
  | { type: 'on_receives_damage'; instanceId: string }
  | { type: 'on_receives_battle_damage'; instanceId: string }
  | { type: 'on_battle_destroy'; instanceId: string }
  | { type: 'on_card_drawn'; playerIndex: 0 | 1 }
  | { type: 'on_resource_placed'; playerIndex: 0 | 1 }
  | { type: 'on_shield_destroy'; playerIndex: 0 | 1 }
  | { type: 'on_start_phase' | 'on_draw_phase' | 'on_resource_phase' | 'on_main_phase_start' | 'on_end_phase' | 'on_turn_start' | 'on_turn_end' }
  | { type: 'on_opponent_turn_start' | 'on_opponent_turn_end' };

export type { TriggerEvent };

export function collectTriggers(
  state: GameState,
  catalog: CardCatalog,
  event: TriggerEvent,
): PendingResolution[] {
  const resolutions: PendingResolution[] = [];

  for (let pi = 0; pi < 2; pi++) {
    const player = state.players[pi as 0 | 1];
    const fCtx: FilterContext = {
      state,
      catalog,
      perspectivePlayerIndex: pi as 0 | 1,
    };

    for (const inst of player.zones.battle_area.cards) {
      const card = catalog.get(inst.card_id);
      if (!card) continue;

      for (const ability of card.abilities) {
        const trigger = ability.trigger;

        if (!matchesTriggerType(trigger.type, event, inst, pi as 0 | 1)) continue;

        // Check qualifiers
        if (!checkQualifiers(trigger, ability, inst, state, catalog, pi as 0 | 1, event)) continue;

        // Check once_per_turn
        const turnKey = `${inst.instance_id}:${ability.id}`;
        if (trigger.qualifiers?.once_per_turn && state.abilities_triggered_once_per_turn.includes(turnKey)) continue;

        // Check ability already used
        if (player.abilities_used_this_turn.includes(ability.id)) continue;

        resolutions.push({
          ability_id: ability.id,
          source_instance_id: inst.instance_id,
          controller_index: pi as 0 | 1,
          stored_variables: {},
          next_step_index: 0,
        });
      }
    }
  }

  return resolutions;
}

function matchesTriggerType(
  triggerType: string,
  event: TriggerEvent,
  inst: CardInstance,
  pi: 0 | 1,
): boolean {
  switch (triggerType) {
    case 'on_deploy':
      return event.type === 'on_deploy' && event.instanceId === inst.instance_id;
    case 'on_destroyed':
      return event.type === 'on_destroyed' && event.instanceId === inst.instance_id;
    case 'on_burst':
      return event.type === 'on_burst' && event.instanceId === inst.instance_id;
    case 'on_pair':
      return event.type === 'on_pair' && event.instanceId === inst.instance_id;
    case 'on_attack':
      return event.type === 'on_attack' && event.instanceId === inst.instance_id;
    case 'on_attacked':
      return event.type === 'on_attacked' && event.instanceId === inst.instance_id;
    case 'on_damage_dealt':
      return event.type === 'on_damage_dealt' && event.instanceId === inst.instance_id;
    case 'on_receives_damage':
    case 'on_receives_battle_damage':
    case 'on_receives_effect_damage':
      return (event.type === 'on_receives_damage' || event.type === 'on_receives_battle_damage') &&
             event.instanceId === inst.instance_id;
    case 'on_battle_destroy':
      return event.type === 'on_battle_destroy' && event.instanceId === inst.instance_id;
    case 'on_card_drawn':
      return event.type === 'on_card_drawn' && event.playerIndex === pi;
    case 'on_resource_placed':
      return event.type === 'on_resource_placed' && event.playerIndex === pi;
    case 'on_shield_destroy':
      return event.type === 'on_shield_destroy' && event.playerIndex === pi;
    case 'on_start_phase':
    case 'on_draw_phase':
    case 'on_resource_phase':
    case 'on_main_phase_start':
    case 'on_end_phase':
    case 'on_turn_start':
    case 'on_turn_end':
    case 'on_opponent_turn_start':
    case 'on_opponent_turn_end':
      return event.type === triggerType;
    // Activated abilities and static triggers don't fire via collectTriggers
    case 'activated_main':
    case 'activated_action':
    case 'activated_main_or_action':
    case 'during_pair':
    case 'during_link':
    case 'static':
      return false;
    default:
      return false;
  }
}

function checkQualifiers(
  trigger: { qualifiers?: Record<string, unknown> },
  ability: { id: string },
  inst: CardInstance,
  state: GameState,
  catalog: CardCatalog,
  pi: 0 | 1,
  event: TriggerEvent,
): boolean {
  const q = trigger.qualifiers;
  if (!q) return true;

  if (q.your_turn_only && state.active_player_index !== pi) return false;
  if (q.opponent_turn_only && state.active_player_index === pi) return false;
  if (q.requires_pair && !inst.paired_with_instance_id) return false;
  if (q.requires_link) {
    const fCtx: FilterContext = { state, catalog, perspectivePlayerIndex: pi };
    if (!isLinked(inst, fCtx)) return false;
  }

  return true;
}
