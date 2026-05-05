import type { GameState, MatchAction } from '@project-v/schemas';
import type { CardCatalog } from './catalog';
import { resolveEffectiveStats, hasKeyword } from './stats';

/**
 * Returns all legal actions for a given player in the current state.
 * Used by the UI to highlight what's clickable.
 */
export function listLegalActions(
  state: GameState,
  catalog: CardCatalog,
  playerIndex: 0 | 1,
): MatchAction[] {
  if (state.winner_index !== undefined) return [];

  const pi = playerIndex;
  const now = new Date().toISOString();
  const base = (type: MatchAction['type'], payload: Record<string, unknown> = {}): MatchAction => ({
    match_id: state.match_id,
    sequence_number: state.action_sequence_number + 1,
    controller_index: pi,
    type,
    payload,
    client_timestamp: now,
  });

  const actions: MatchAction[] = [];

  // Always allow concede
  actions.push(base('concede'));

  // Pending resolution waiting for input
  if (state.pending_resolutions.length > 0) {
    const res = state.pending_resolutions[0]!;
    if (res.waiting_for) {
      if (res.waiting_for.type === 'choice' && res.controller_index === pi) {
        actions.push(base('resolve_choice', { choice: [] }));
      }
      if (res.waiting_for.type === 'manual_resolve' && res.controller_index === pi) {
        actions.push(base('resolve_manual'));
      }
      return actions;
    }
  }

  // Mulligan phase
  if (state.phase === 'mulligan') {
    if (!state.players[pi].has_redrawn) {
      actions.push(base('redraw'));
      actions.push(base('keep_hand'));
    }
    return actions;
  }

  // Only active player can take most actions
  const isActive = state.active_player_index === pi;
  const oppi = (1 - pi) as 0 | 1;

  // Pass priority (during attack substates)
  if (state.attack_substate) {
    const sub = state.attack_substate;
    if (sub.step === 'declared' && pi === oppi) {
      // Defender can declare blocker or skip
      const blockers = state.players[pi].zones.battle_area.cards.filter(inst => {
        if (inst.is_resting) return false;
        const card = catalog.get(inst.card_id);
        if (!card) return false;
        return hasKeyword(resolveEffectiveStats(inst, card), 'blocker');
      });
      for (const blocker of blockers) {
        actions.push(base('use_blocker', { blocker_instance_id: blocker.instance_id }));
      }
      actions.push(base('skip_blocker'));
    }
    if ((sub.step === 'defender_action' && pi === oppi) ||
        (sub.step === 'attacker_action' && pi === state.active_player_index)) {
      actions.push(base('pass_priority'));
      // Could also activate action abilities here (activated_action / activated_main_or_action)
      for (const inst of state.players[pi].zones.battle_area.cards) {
        const card = catalog.get(inst.card_id);
        if (!card) continue;
        for (const ability of card.abilities) {
          if (['activated_action', 'activated_main_or_action'].includes(ability.trigger.type)) {
            if (!ability.trigger.qualifiers?.once_per_turn || !state.players[pi].abilities_used_this_turn.includes(ability.id)) {
              actions.push(base('activate_ability', {
                source_instance_id: inst.instance_id,
                ability_id: ability.id,
              }));
            }
          }
        }
      }
    }
    return actions;
  }

  if (!isActive) return actions;

  // Resource phase
  if (state.phase === 'resource') {
    if (!state.players[pi].has_placed_resource_this_turn) {
      for (const inst of state.players[pi].zones.hand.cards) {
        actions.push(base('place_resource', { card_instance_id: inst.instance_id }));
      }
      actions.push(base('skip_resource'));
    } else {
      actions.push(base('end_phase'));
    }
    return actions;
  }

  // Main phase
  if (state.phase === 'main') {
    const activeResources = state.players[pi].zones.resource_area.cards.filter(c => !c.is_resting).length;

    // Deploy cards from hand
    for (const inst of state.players[pi].zones.hand.cards) {
      const card = catalog.get(inst.card_id);
      if (!card) continue;
      const stats = resolveEffectiveStats(inst, card);
      if (stats.cost > activeResources) continue;
      if (card.type !== 'command' && card.type !== 'base' && card.type !== 'pilot') {
        if (state.players[pi].zones.battle_area.cards.length >= 6) continue;
      }
      if (card.type === 'command') {
        actions.push(base('play_command', { card_instance_id: inst.instance_id }));
      } else {
        actions.push(base('deploy_card', { card_instance_id: inst.instance_id }));
      }
    }

    // Attack with each non-rested unit that hasn't attacked
    for (const inst of state.players[pi].zones.battle_area.cards) {
      if (inst.is_resting) continue;
      if (state.units_attacked_this_turn.includes(inst.instance_id)) continue;
      const card = catalog.get(inst.card_id);
      if (!card || card.type !== 'unit') continue;

      const attackerStats = resolveEffectiveStats(inst, card);
      const opponentUnits = state.players[oppi].zones.battle_area.cards;
      const hasHighManeuver = hasKeyword(attackerStats, 'high_maneuver');

      const blockerUnits = opponentUnits.filter(u => {
        const c = catalog.get(u.card_id);
        if (!c) return false;
        return hasKeyword(resolveEffectiveStats(u, c), 'blocker');
      });

      if (blockerUnits.length > 0 && !hasHighManeuver) {
        // Must attack a blocker
        for (const blocker of blockerUnits) {
          actions.push(base('attack_unit', {
            attacker_instance_id: inst.instance_id,
            target_instance_id: blocker.instance_id,
          }));
        }
      } else {
        // Can attack any unit, the player, or the base
        for (const target of opponentUnits) {
          actions.push(base('attack_unit', {
            attacker_instance_id: inst.instance_id,
            target_instance_id: target.instance_id,
          }));
        }
        actions.push(base('attack_player', { attacker_instance_id: inst.instance_id }));
        if (state.players[oppi].zones.shield_base_section.cards.length > 0) {
          actions.push(base('attack_base', { attacker_instance_id: inst.instance_id }));
        }
      }
    }

    // Activate main-phase abilities
    for (const inst of state.players[pi].zones.battle_area.cards) {
      const card = catalog.get(inst.card_id);
      if (!card) continue;
      for (const ability of card.abilities) {
        if (['activated_main', 'activated_main_or_action'].includes(ability.trigger.type)) {
          if (ability.trigger.qualifiers?.once_per_turn && state.players[pi].abilities_used_this_turn.includes(ability.id)) continue;
          actions.push(base('activate_ability', {
            source_instance_id: inst.instance_id,
            ability_id: ability.id,
          }));
        }
      }
    }

    // Can always end the phase
    actions.push(base('end_phase'));
    return actions;
  }

  // End phase
  if (state.phase === 'end') {
    const hand = state.players[pi].zones.hand.cards;
    if (hand.length <= 10) {
      actions.push(base('end_turn'));
    }
    // Discard options when over 10
    for (const inst of hand) {
      if (hand.length > 10) {
        // Player needs to discard — but this is done via activate_ability or discard action
        // For now just list end_turn when at limit
      }
    }
    return actions;
  }

  // Start phase — auto-advanced, just end it
  if (state.phase === 'start') {
    actions.push(base('end_phase'));
    return actions;
  }

  return actions;
}
