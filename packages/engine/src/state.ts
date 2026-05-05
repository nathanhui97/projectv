import type { GameState, CardInstance, PlayerState } from '@project-v/schemas';
import { shuffleArray } from './rng';

export interface PlayerSetup {
  userId: string;
  displayName: string;
  mainDeckIds: string[];      // exactly 50
  resourceDeckIds: string[];  // exactly 10
}

export interface InitConfig {
  matchId: string;
  seed: number;
  player0: PlayerSetup;
  player1: PlayerSetup;
}

function mkInstance(
  matchId: string,
  ctr: { n: number },
  cardId: string,
  overrides: Partial<CardInstance> = {},
): CardInstance {
  return {
    instance_id: `${matchId}-${++ctr.n}`,
    card_id: cardId,
    is_resting: false,
    is_face_down: false,
    damage: 0,
    counters: {},
    temporary_modifiers: [],
    ...overrides,
  };
}

function buildPlayer(
  setup: PlayerSetup,
  playerIndex: 0 | 1,
  matchId: string,
  ctr: { n: number },
  seed: number,
  rngCounter: { c: number },
): PlayerState {
  const [deck, c1] = shuffleArray(setup.mainDeckIds, seed, rngCounter.c);
  rngCounter.c = c1;
  const [resDeck, c2] = shuffleArray(setup.resourceDeckIds, seed, rngCounter.c);
  rngCounter.c = c2;

  // Deal 5 to hand, 5 face-down shields, rest stays in deck
  const handIds = deck.slice(0, 5);
  const shieldIds = deck.slice(5, 10);
  const deckIds = deck.slice(10);

  const mk = (id: string, ov: Partial<CardInstance> = {}) => mkInstance(matchId, ctr, id, ov);
  const faceDown = { is_face_down: true };

  // Player 2 (index 1) starts with one EX Resource token
  const resourceArea = playerIndex === 1
    ? [mk('__ex_resource__')]
    : [];

  return {
    user_id: setup.userId,
    display_name: setup.displayName,
    zones: {
      deck:                { cards: deckIds.map(id => mk(id, faceDown)) },
      resource_deck:       { cards: resDeck.map(id => mk(id, faceDown)) },
      hand:                { cards: handIds.map(id => mk(id)) },
      resource_area:       { cards: resourceArea },
      battle_area:         { cards: [] },
      shield_area:         { cards: shieldIds.map(id => mk(id, faceDown)) },
      shield_base_section: { cards: [] },
      trash:               { cards: [] },
      removed_from_game:   { cards: [] },
    },
    has_redrawn: false,
    has_placed_resource_this_turn: false,
    abilities_used_this_turn: [],
  };
}

export function getInitialState(cfg: InitConfig): GameState {
  const ctr = { n: 0 };
  const rngCounter = { c: 0 };

  return {
    match_id: cfg.matchId,
    rng_seed: cfg.seed,
    rng_counter: rngCounter.c,
    players: [
      buildPlayer(cfg.player0, 0, cfg.matchId, ctr, cfg.seed, rngCounter),
      buildPlayer(cfg.player1, 1, cfg.matchId, ctr, cfg.seed, rngCounter),
    ],
    active_player_index: 0,
    turn_number: 1,
    phase: 'mulligan',
    attack_substate: null,
    priority_player_index: 0,
    pending_resolutions: [],
    units_attacked_this_turn: [],
    abilities_triggered_once_per_turn: [],
    log: [],
    action_sequence_number: 0,
  };
}
