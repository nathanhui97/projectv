import type { GameState } from '@project-v/schemas';

// Applies per-phase entry effects (called AFTER phase is set).
export function applyPhaseEntry(state: GameState): GameState {
  const s = structuredClone(state);
  const ap = s.active_player_index;

  if (s.phase === 'start') {
    // Ready all rested units and resources for the active player
    for (const inst of s.players[ap].zones.battle_area.cards) inst.is_resting = false;
    for (const inst of s.players[ap].zones.resource_area.cards) inst.is_resting = false;
  }

  return s;
}

// Advance to the next phase (or next turn).
// Does NOT apply phase-entry effects — call applyPhaseEntry separately.
export function advancePhase(state: GameState): GameState {
  const s = structuredClone(state);

  switch (s.phase) {
    case 'mulligan': s.phase = 'start';    break;
    case 'start':    s.phase = 'draw';     break;
    case 'draw':     s.phase = 'resource'; break;
    case 'resource': s.phase = 'main';     break;
    case 'main':     s.phase = 'end';      break;
    case 'end':
      // Rotate to next player's turn
      s.turn_number += 1;
      s.active_player_index = s.active_player_index === 0 ? 1 : 0;
      s.priority_player_index = s.active_player_index;
      s.attack_substate = null;
      s.units_attacked_this_turn = [];
      s.abilities_triggered_once_per_turn = [];
      s.players[0].has_placed_resource_this_turn = false;
      s.players[1].has_placed_resource_this_turn = false;
      s.players[0].abilities_used_this_turn = [];
      s.players[1].abilities_used_this_turn = [];
      // Remove end-of-turn temporary modifiers
      for (const player of s.players) {
        for (const zone of Object.values(player.zones)) {
          for (const inst of zone.cards) {
            inst.temporary_modifiers = inst.temporary_modifiers.filter(
              m => m.duration !== 'end_of_turn',
            );
          }
        }
      }
      s.phase = 'start';
      break;
  }

  return s;
}

// Applies end-phase discard-to-hand-limit (max 10 cards).
export function applyEndPhaseCleanup(state: GameState): GameState {
  // Discard is triggered by the player via action — just enforce cap here for AI/automation.
  // In hotseat, player will choose what to discard via resolve_choice actions.
  // No automatic discard — return unchanged.
  return state;
}
