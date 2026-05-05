import { describe, it, expect } from 'vitest';
import { getInitialState } from './state';
import { buildCatalog } from './catalog';
import { applyAction } from './apply';
import { validateAction } from './validate';
import { listLegalActions } from './legal';
import { checkWinCondition } from './win';
import type { Card } from '@project-v/schemas';

// ─── Fixtures ──────────────────────────────────────────────────────────────────

function makeCard(overrides: Partial<Card> = {}): Card {
  return {
    id: 'TEST-001',
    set_code: 'TEST',
    card_number: '001',
    name: 'Test Unit',
    type: 'unit',
    color: 'blue',
    rarity: 'common',
    cost: 2,
    level: 3,
    ap: 3,
    hp: 5,
    traits: ['Earth Federation'],
    keywords: [],
    abilities: [],
    rules_text: '-',
    status: 'published',
    format_legality: {},
    manual_mode: false,
    version: 1,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    authored_by: 'test',
    ...overrides,
  };
}

const UNIT = makeCard({ id: 'TEST-001', cost: 2 });
const CHEAP = makeCard({ id: 'TEST-002', cost: 0 });
const RESOURCE = makeCard({ id: 'RES-001', type: 'resource', cost: 0, level: undefined, ap: undefined, hp: undefined });

const mainDeck = Array(50).fill('TEST-001');
const resourceDeck = Array(10).fill('RES-001');

const catalog = buildCatalog([UNIT, CHEAP, RESOURCE]);

function makeInitialState() {
  return getInitialState({
    matchId: 'test-match',
    seed: 42,
    player0: { userId: 'p0', displayName: 'Player 0', mainDeckIds: mainDeck, resourceDeckIds: resourceDeck },
    player1: { userId: 'p1', displayName: 'Player 1', mainDeckIds: mainDeck, resourceDeckIds: resourceDeck },
  });
}

function makeAction(type: Parameters<typeof applyAction>[1]['type'], pi: 0 | 1, payload = {}): Parameters<typeof applyAction>[1] {
  return {
    match_id: 'test-match',
    sequence_number: 1,
    controller_index: pi,
    type,
    payload,
    client_timestamp: new Date().toISOString(),
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('getInitialState', () => {
  it('creates correct initial state', () => {
    const state = makeInitialState();
    expect(state.phase).toBe('mulligan');
    expect(state.turn_number).toBe(1);
    expect(state.active_player_index).toBe(0);
    expect(state.players[0].zones.hand.cards).toHaveLength(5);
    expect(state.players[1].zones.hand.cards).toHaveLength(5);
    expect(state.players[0].zones.shield_area.cards).toHaveLength(5);
    expect(state.players[1].zones.shield_area.cards).toHaveLength(5);
    // Deck = 50 - 5 hand - 5 shields = 40
    expect(state.players[0].zones.deck.cards).toHaveLength(40);
  });

  it('gives P2 an EX Resource token', () => {
    const state = makeInitialState();
    expect(state.players[1].zones.resource_area.cards).toHaveLength(1);
    expect(state.players[1].zones.resource_area.cards[0]!.card_id).toBe('__ex_resource__');
    expect(state.players[0].zones.resource_area.cards).toHaveLength(0);
  });

  it('all shield cards are face-down', () => {
    const state = makeInitialState();
    for (const shield of state.players[0].zones.shield_area.cards) {
      expect(shield.is_face_down).toBe(true);
    }
  });
});

describe('mulligan', () => {
  it('keep_hand marks player as decided', () => {
    const state = makeInitialState();
    const s1 = applyAction(state, makeAction('keep_hand', 0), catalog);
    expect(s1.players[0].has_redrawn).toBe(true);
    expect(s1.phase).toBe('mulligan'); // still mulligan until both decide
  });

  it('both keep_hand advances to start phase', () => {
    let state = makeInitialState();
    state = applyAction(state, makeAction('keep_hand', 0), catalog);
    state = applyAction(state, makeAction('keep_hand', 1), catalog);
    expect(state.phase).toBe('start');
  });

  it('redraw shuffles hand and redraws 5', () => {
    const state = makeInitialState();
    const oldHand = state.players[0].zones.hand.cards.map(c => c.instance_id);
    const s1 = applyAction(state, makeAction('redraw', 0), catalog);
    const newHand = s1.players[0].zones.hand.cards.map(c => c.instance_id);
    expect(newHand).toHaveLength(5);
    // Hands should differ (different instance IDs after reshuffle)
    expect(newHand).not.toEqual(oldHand);
  });

  it('cannot redraw twice', () => {
    let state = makeInitialState();
    state = applyAction(state, makeAction('redraw', 0), catalog);
    expect(() => applyAction(state, makeAction('redraw', 0), catalog)).toThrow();
  });
});

describe('validateAction', () => {
  it('rejects unknown phase actions during mulligan', () => {
    const state = makeInitialState();
    const result = validateAction(state, makeAction('end_phase', 0), catalog);
    expect(result.valid).toBe(false);
  });

  it('rejects concede as valid always', () => {
    const state = makeInitialState();
    const result = validateAction(state, makeAction('concede', 0), catalog);
    expect(result.valid).toBe(true);
  });
});

describe('checkWinCondition', () => {
  it('returns null for ongoing game', () => {
    const state = makeInitialState();
    expect(checkWinCondition(state)).toBeNull();
  });

  it('returns winner when set', () => {
    const state = { ...makeInitialState(), winner_index: 1, end_reason: 'concede' };
    const result = checkWinCondition(state);
    expect(result?.winner).toBe(1);
    expect(result?.reason).toBe('concede');
  });
});

describe('listLegalActions', () => {
  it('returns redraw and keep_hand during mulligan', () => {
    const state = makeInitialState();
    const actions = listLegalActions(state, catalog, 0);
    const types = actions.map(a => a.type);
    expect(types).toContain('redraw');
    expect(types).toContain('keep_hand');
    expect(types).toContain('concede');
  });

  it('returns no redraw after deciding', () => {
    let state = makeInitialState();
    state = applyAction(state, makeAction('keep_hand', 0), catalog);
    const actions = listLegalActions(state, catalog, 0);
    const types = actions.map(a => a.type);
    expect(types).not.toContain('redraw');
    expect(types).not.toContain('keep_hand');
  });
});
