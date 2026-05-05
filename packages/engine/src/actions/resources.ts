import type { GameState, MatchAction, CardInstance } from '@project-v/schemas';
import type { CardCatalog } from '../catalog';
import { collectTriggers } from '../triggers';
import { processQueue } from '../queue';

export function applyPlaceResource(
  state: GameState,
  action: MatchAction,
  catalog: CardCatalog,
): GameState {
  const pi = action.controller_index as 0 | 1;
  const player = state.players[pi];
  const payload = action.payload as { card_instance_id: string };

  if (state.phase !== 'resource') throw new Error('Cannot place resource outside resource phase');
  if (state.active_player_index !== pi) throw new Error('Not your turn');
  if (player.has_placed_resource_this_turn) throw new Error('Already placed a resource this turn');

  // Find the card in hand
  const handIdx = player.zones.hand.cards.findIndex(
    c => c.instance_id === payload.card_instance_id,
  );
  if (handIdx === -1) throw new Error('Card not in hand');

  const s = structuredClone(state);
  const [card] = s.players[pi].zones.hand.cards.splice(handIdx, 1);
  card!.is_face_down = false;
  card!.is_resting = true; // resources enter rested
  s.players[pi].zones.resource_area.cards.push(card!);
  s.players[pi].has_placed_resource_this_turn = true;

  // Collect and enqueue triggers
  const triggers = collectTriggers(s, catalog, { type: 'on_resource_placed', playerIndex: pi });
  s.pending_resolutions.push(...triggers);

  return processQueue(s, catalog);
}

export function applySkipResource(state: GameState, action: MatchAction): GameState {
  const pi = action.controller_index as 0 | 1;
  if (state.phase !== 'resource') throw new Error('Cannot skip resource outside resource phase');
  if (state.active_player_index !== pi) throw new Error('Not your turn');
  // Nothing to do — player explicitly skips placing a resource
  return state;
}
