import type { GameState, MatchAction } from '@project-v/schemas';
import type { CardCatalog } from '../catalog';
import { advancePhase, applyPhaseEntry } from '../phases';
import { collectTriggers } from '../triggers';
import { processQueue } from '../queue';
import { setWinner } from '../win';

export function applyPassPriority(
  state: GameState,
  action: MatchAction,
  catalog: CardCatalog,
): GameState {
  const pi = action.controller_index as 0 | 1;
  if (state.priority_player_index !== pi) throw new Error('Not your priority');

  // During attack: advance attack substate step
  if (state.attack_substate) {
    const s = structuredClone(state);
    const step = s.attack_substate!.step;

    if (step === 'defender_action') {
      s.attack_substate!.step = 'attacker_action';
      s.priority_player_index = state.active_player_index;
      return s;
    }
    if (step === 'attacker_action') {
      // Proceed to damage resolution
      const { resolveCombatDamage } = require('./combat') as typeof import('./combat');
      return resolveCombatDamage(s, catalog);
    }
    return s;
  }

  // Outside attack: just pass priority back
  const s = structuredClone(state);
  s.priority_player_index = (1 - pi) as 0 | 1;
  return s;
}

export function applyEndPhase(
  state: GameState,
  action: MatchAction,
  catalog: CardCatalog,
): GameState {
  const pi = action.controller_index as 0 | 1;
  if (state.active_player_index !== pi) throw new Error('Not your turn');
  if (state.attack_substate) throw new Error('Cannot end phase during attack');

  // Phase-specific validation
  if (state.phase === 'draw') {
    // Skip draw on P1 turn 1
    const shouldSkipDraw = state.active_player_index === 0 && state.turn_number === 1;
    if (!shouldSkipDraw) {
      // Draw was supposed to happen automatically — allow ending anyway
    }
  }

  if (state.phase === 'end') {
    // Enforce hand size limit (10 cards max)
    const hand = state.players[pi].zones.hand.cards;
    if (hand.length > 10) throw new Error('Must discard to 10 cards before ending turn');
  }

  let s = advancePhase(state);

  // Apply phase-entry effects
  s = applyPhaseEntry(s);

  // Auto-execute draw phase
  if (s.phase === 'draw') {
    const shouldSkipDraw = s.active_player_index === 0 && s.turn_number === 1;
    if (!shouldSkipDraw) {
      const deck = s.players[s.active_player_index].zones.deck.cards;
      if (deck.length > 0) {
        const s2 = structuredClone(s);
        const [drawn] = s2.players[s2.active_player_index].zones.deck.cards.splice(0, 1);
        drawn!.is_face_down = false;
        s2.players[s2.active_player_index].zones.hand.cards.push(drawn!);
        // Trigger on_card_drawn
        const triggers = collectTriggers(s2, catalog, {
          type: 'on_card_drawn',
          playerIndex: s2.active_player_index as 0 | 1,
        });
        s2.pending_resolutions.push(...triggers);
        s = processQueue(s2, catalog);
      }
      // Auto-advance from draw to resource
      s = advancePhase(s);
    } else {
      // Skip draw on turn 1 for P1: advance to resource
      s = advancePhase(s);
    }
  }

  // Collect phase triggers
  const phaseMap: Record<string, string> = {
    start: 'on_start_phase',
    resource: 'on_resource_phase',
    main: 'on_main_phase_start',
    end: 'on_end_phase',
  };
  const phaseEvent = phaseMap[s.phase];
  if (phaseEvent) {
    const triggers = collectTriggers(s, catalog, { type: phaseEvent as any });
    const s2 = structuredClone(s);
    s2.pending_resolutions.push(...triggers);
    s = processQueue(s2, catalog);
  }

  return s;
}

export function applyEndTurn(
  state: GameState,
  action: MatchAction,
  catalog: CardCatalog,
): GameState {
  const pi = action.controller_index as 0 | 1;
  if (state.active_player_index !== pi) throw new Error('Not your turn');
  if (state.phase !== 'end') throw new Error('Not in end phase');

  // Enforce hand size limit
  const hand = state.players[pi].zones.hand.cards;
  if (hand.length > 10) throw new Error('Must discard to 10 cards before ending turn');

  // Trigger on_turn_end
  let s = structuredClone(state);
  const endTriggers = collectTriggers(s, catalog, { type: 'on_turn_end' });
  s.pending_resolutions.push(...endTriggers);
  s = processQueue(s, catalog);

  // Advance phase (end → start of next player's turn)
  s = advancePhase(s);
  s = applyPhaseEntry(s);

  // Trigger on_turn_start for new active player
  const startTriggers = collectTriggers(s, catalog, { type: 'on_turn_start' });
  const s2 = structuredClone(s);
  s2.pending_resolutions.push(...startTriggers);
  s = processQueue(s2, catalog);

  // Trigger on_start_phase
  const phaseTriggers = collectTriggers(s, catalog, { type: 'on_start_phase' });
  const s3 = structuredClone(s);
  s3.pending_resolutions.push(...phaseTriggers);
  s = processQueue(s3, catalog);

  // Auto-advance through start phase to draw phase
  s = advancePhase(s);  // start → draw

  // Draw a card (skip if P1 turn 1)
  const shouldSkipDraw = s.active_player_index === 0 && s.turn_number === 1;
  if (!shouldSkipDraw) {
    const deck = s.players[s.active_player_index].zones.deck.cards;
    if (deck.length > 0) {
      const s4 = structuredClone(s);
      const [drawn] = s4.players[s4.active_player_index].zones.deck.cards.splice(0, 1);
      drawn!.is_face_down = false;
      s4.players[s4.active_player_index].zones.hand.cards.push(drawn!);
      const drawTriggers = collectTriggers(s4, catalog, {
        type: 'on_card_drawn',
        playerIndex: s4.active_player_index as 0 | 1,
      });
      s4.pending_resolutions.push(...drawTriggers);
      s = processQueue(s4, catalog);
    }
  }

  // Auto-advance to resource phase
  s = advancePhase(s);  // draw → resource

  return s;
}

export function applyConcede(
  state: GameState,
  action: MatchAction,
): GameState {
  const pi = action.controller_index as 0 | 1;
  const winner = (1 - pi) as 0 | 1;
  return setWinner(state, winner, 'concede');
}
