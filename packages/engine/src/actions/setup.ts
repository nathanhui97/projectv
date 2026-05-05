import type { GameState, MatchAction } from '@project-v/schemas';
import type { CardCatalog } from '../catalog';
import { shuffleArray } from '../rng';

export function applyRedraw(state: GameState, action: MatchAction): GameState {
  const pi = action.controller_index;
  const player = state.players[pi];

  if (state.phase !== 'mulligan') throw new Error('Cannot redraw outside mulligan');
  if (player.has_redrawn) throw new Error('Player has already made a mulligan decision');

  const s = structuredClone(state);

  // Shuffle hand back into deck, then redraw 5
  const hand = s.players[pi].zones.hand.cards;
  const deck = s.players[pi].zones.deck.cards;

  // Return hand to deck
  for (const card of hand) {
    card.is_face_down = true;
    deck.push(card);
  }
  s.players[pi].zones.hand.cards = [];

  // Shuffle deck
  const [shuffled, nc] = shuffleArray(deck, s.rng_seed, s.rng_counter);
  s.rng_counter = nc;
  s.players[pi].zones.deck.cards = shuffled;

  // Draw 5
  for (let i = 0; i < 5; i++) {
    const top = s.players[pi].zones.deck.cards.shift();
    if (!top) break;
    top.is_face_down = false;
    s.players[pi].zones.hand.cards.push(top);
  }

  s.players[pi].has_redrawn = true;
  return advanceMulliganIfDone(s);
}

export function applyKeepHand(state: GameState, action: MatchAction): GameState {
  const pi = action.controller_index;
  const player = state.players[pi];

  if (state.phase !== 'mulligan') throw new Error('Cannot keep hand outside mulligan');
  if (player.has_redrawn) throw new Error('Player has already made a mulligan decision');

  const s = structuredClone(state);
  s.players[pi].has_redrawn = true;
  return advanceMulliganIfDone(s);
}

function advanceMulliganIfDone(state: GameState): GameState {
  if (state.players[0].has_redrawn && state.players[1].has_redrawn) {
    const s = structuredClone(state);
    s.phase = 'start';
    // Reset has_redrawn — it will be reused for "has drawn this turn" tracking if needed
    // Actually keep it as-is; it means "player has made mulligan decision"
    return s;
  }
  return state;
}
