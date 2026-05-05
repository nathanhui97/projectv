import { describe, it, expect } from 'vitest';
import { evaluateFilter, evaluateShorthandFilter, isLinked } from './filter';
import type { FilterContext } from './filter';
import type { GameState, CardInstance } from '@project-v/schemas';
import type { Card } from '@project-v/schemas';
import { buildCatalog } from './catalog';

// ─── Test fixtures ────────────────────────────────────────────────────────────

function makeCard(overrides: Partial<Card> = {}): Card {
  return {
    id: 'TEST-001',
    set_code: 'TEST',
    card_number: '001',
    name: 'Test Unit',
    type: 'unit',
    color: 'blue',
    rarity: 'common',
    cost: 3,
    level: 4,
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

function makeInstance(overrides: Partial<CardInstance> = {}): CardInstance {
  return {
    instance_id: 'iid-001',
    card_id: 'TEST-001',
    is_resting: false,
    is_face_down: false,
    damage: 0,
    counters: {},
    temporary_modifiers: [],
    ...overrides,
  };
}

function makeState(p0Units: CardInstance[], p1Units: CardInstance[] = []): GameState {
  const emptyZone = { cards: [] };
  const player = (units: CardInstance[]) => ({
    user_id: 'u1',
    display_name: 'Player',
    zones: {
      deck: emptyZone,
      resource_deck: emptyZone,
      hand: emptyZone,
      resource_area: emptyZone,
      battle_area: { cards: units },
      shield_area: emptyZone,
      shield_base_section: emptyZone,
      trash: emptyZone,
      removed_from_game: emptyZone,
    },
    has_redrawn: false,
    has_placed_resource_this_turn: false,
    abilities_used_this_turn: [],
  });
  return {
    match_id: 'test',
    rng_seed: 0,
    rng_counter: 0,
    players: [player(p0Units), player(p1Units)],
    active_player_index: 0,
    turn_number: 1,
    phase: 'main',
    attack_substate: null,
    priority_player_index: 0,
    pending_resolutions: [],
    units_attacked_this_turn: [],
    abilities_triggered_once_per_turn: [],
    log: [],
    action_sequence_number: 0,
  } as GameState;
}

function makeCtx(state: GameState, catalog = buildCatalog([makeCard()])): FilterContext {
  return { state, catalog, perspectivePlayerIndex: 0 };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('evaluateShorthandFilter', () => {
  it('matches by type', () => {
    const unit = makeInstance();
    const state = makeState([unit]);
    const ctx = makeCtx(state);
    expect(evaluateShorthandFilter({ type: 'unit' }, unit, ctx)).toBe(true);
    expect(evaluateShorthandFilter({ type: 'pilot' }, unit, ctx)).toBe(false);
  });

  it('matches friendly vs enemy', () => {
    const p0unit = makeInstance({ instance_id: 'p0' });
    const p1unit = makeInstance({ instance_id: 'p1' });
    const state = makeState([p0unit], [p1unit]);
    const catalog = buildCatalog([makeCard()]);
    const ctx: FilterContext = { state, catalog, perspectivePlayerIndex: 0 };

    expect(evaluateShorthandFilter({ side: 'friendly' }, p0unit, ctx)).toBe(true);
    expect(evaluateShorthandFilter({ side: 'enemy' }, p0unit, ctx)).toBe(false);
    expect(evaluateShorthandFilter({ side: 'friendly' }, p1unit, ctx)).toBe(false);
    expect(evaluateShorthandFilter({ side: 'enemy' }, p1unit, ctx)).toBe(true);
  });

  it('matches max_hp', () => {
    const unit = makeInstance({ damage: 3 }); // hp=5, damage=3 → currentHp=2
    const state = makeState([unit]);
    const ctx = makeCtx(state);
    expect(evaluateShorthandFilter({ max_hp: 2 }, unit, ctx)).toBe(true);
    expect(evaluateShorthandFilter({ max_hp: 1 }, unit, ctx)).toBe(false);
  });

  it('matches max_level', () => {
    const unit = makeInstance(); // level=4
    const state = makeState([unit]);
    const ctx = makeCtx(state);
    expect(evaluateShorthandFilter({ max_level: 5 }, unit, ctx)).toBe(true);
    expect(evaluateShorthandFilter({ max_level: 3 }, unit, ctx)).toBe(false);
  });

  it('matches min_level', () => {
    const unit = makeInstance(); // level=4
    const state = makeState([unit]);
    const ctx = makeCtx(state);
    expect(evaluateShorthandFilter({ min_level: 5 }, unit, ctx)).toBe(false);
    expect(evaluateShorthandFilter({ min_level: 4 }, unit, ctx)).toBe(true);
  });

  it('matches traits', () => {
    const unit = makeInstance();
    const state = makeState([unit]);
    const ctx = makeCtx(state);
    expect(evaluateShorthandFilter({ traits: ['Earth Federation'] }, unit, ctx)).toBe(true);
    expect(evaluateShorthandFilter({ traits: ['Zeon'] }, unit, ctx)).toBe(false);
    expect(evaluateShorthandFilter({ traits: ['Earth Federation', 'Zeon'] }, unit, ctx)).toBe(false);
  });

  it('matches rested', () => {
    const active = makeInstance({ is_resting: false });
    const rested = makeInstance({ instance_id: 'rested', is_resting: true });
    const state = makeState([active, rested]);
    const ctx = makeCtx(state);
    expect(evaluateShorthandFilter({ rested: true }, rested, ctx)).toBe(true);
    expect(evaluateShorthandFilter({ rested: true }, active, ctx)).toBe(false);
  });

  it('matches is_damaged', () => {
    const intact = makeInstance({ damage: 0 });
    const damaged = makeInstance({ instance_id: 'dmg', damage: 2 });
    const state = makeState([intact, damaged]);
    const ctx = makeCtx(state);
    expect(evaluateShorthandFilter({ is_damaged: true }, damaged, ctx)).toBe(true);
    expect(evaluateShorthandFilter({ is_damaged: true }, intact, ctx)).toBe(false);
  });

  it('applies AP modifier from temporary_modifiers', () => {
    const unit = makeInstance({
      temporary_modifiers: [{ source_ability_id: 'a1', stat: 'ap', amount: 2, duration: 'end_of_turn' }],
    }); // base ap=3, effective ap=5
    const state = makeState([unit]);
    const ctx = makeCtx(state);
    expect(evaluateShorthandFilter({ min_ap: 5 }, unit, ctx)).toBe(true);
    expect(evaluateShorthandFilter({ min_ap: 6 }, unit, ctx)).toBe(false);
  });

  it('matches combined conditions (AND)', () => {
    const unit = makeInstance({ damage: 1 }); // type=unit, side=friendly, hp=4, level=4
    const state = makeState([unit]);
    const ctx = makeCtx(state);
    // All must pass
    expect(evaluateShorthandFilter({ type: 'unit', side: 'friendly', max_hp: 5 }, unit, ctx)).toBe(true);
    // One fails
    expect(evaluateShorthandFilter({ type: 'unit', side: 'enemy', max_hp: 5 }, unit, ctx)).toBe(false);
  });

  it('not_self excludes the source instance', () => {
    const unit = makeInstance({ instance_id: 'src' });
    const other = makeInstance({ instance_id: 'other' });
    const state = makeState([unit, other]);
    const ctx: FilterContext = { ...makeCtx(state), sourceInstanceId: 'src' };
    expect(evaluateShorthandFilter({ not_self: true }, unit, ctx)).toBe(false);
    expect(evaluateShorthandFilter({ not_self: true }, other, ctx)).toBe(true);
  });
});

describe('evaluateFilter (formal)', () => {
  it('handles all_of', () => {
    const unit = makeInstance();
    const state = makeState([unit]);
    const ctx = makeCtx(state);
    expect(evaluateFilter(
      { all_of: [{ type: 'unit' }, { side: 'friendly' }] },
      unit,
      ctx,
    )).toBe(true);
    expect(evaluateFilter(
      { all_of: [{ type: 'unit' }, { side: 'enemy' }] },
      unit,
      ctx,
    )).toBe(false);
  });

  it('handles not', () => {
    const unit = makeInstance();
    const state = makeState([unit]);
    const ctx = makeCtx(state);
    expect(evaluateFilter({ not: { type: 'pilot' } }, unit, ctx)).toBe(true);
    expect(evaluateFilter({ not: { type: 'unit' } }, unit, ctx)).toBe(false);
  });

  it('handles any_of', () => {
    const unit = makeInstance();
    const state = makeState([unit]);
    const ctx = makeCtx(state);
    expect(evaluateFilter(
      { any_of: [{ type: 'pilot' }, { type: 'unit' }] },
      unit,
      ctx,
    )).toBe(true);
    expect(evaluateFilter(
      { any_of: [{ type: 'pilot' }, { type: 'command' }] },
      unit,
      ctx,
    )).toBe(false);
  });

  it('handles numeric comparison operators', () => {
    const unit = makeInstance(); // hp=5, level=4, ap=3
    const state = makeState([unit]);
    const ctx = makeCtx(state);
    expect(evaluateFilter({ hp: { op: '<=', value: 5 } }, unit, ctx)).toBe(true);
    expect(evaluateFilter({ hp: { op: '<', value: 5 } }, unit, ctx)).toBe(false);
    expect(evaluateFilter({ level: { op: '>=', value: 4 } }, unit, ctx)).toBe(true);
    expect(evaluateFilter({ level: { op: '>', value: 4 } }, unit, ctx)).toBe(false);
  });
});

describe('isLinked', () => {
  it('returns false when not paired', () => {
    const unit = makeInstance();
    const state = makeState([unit]);
    const ctx = makeCtx(state);
    expect(isLinked(unit, ctx)).toBe(false);
  });

  it('returns false when card has no link_conditions', () => {
    const pilot = makeInstance({ instance_id: 'pilot', card_id: 'TEST-002' });
    const unit = makeInstance({ paired_with_instance_id: 'pilot' });
    const unitCard = makeCard(); // no link_conditions
    const pilotCard = makeCard({ id: 'TEST-002', type: 'pilot' });
    const catalog = buildCatalog([unitCard, pilotCard]);
    const state = makeState([unit, pilot]);
    const ctx: FilterContext = { state, catalog, perspectivePlayerIndex: 0 };
    expect(isLinked(unit, ctx)).toBe(false);
  });

  it('returns true when pilot satisfies link_conditions', () => {
    const pilot = makeInstance({ instance_id: 'pilot', card_id: 'TEST-002' });
    const unit = makeInstance({
      paired_with_instance_id: 'pilot',
      card_id: 'TEST-001',
    });
    const unitCard = makeCard({
      link_conditions: [{ traits_include: ['White Base Team'] }],
    });
    const pilotCard = makeCard({
      id: 'TEST-002',
      type: 'pilot',
      traits: ['White Base Team'],
    });
    const catalog = buildCatalog([unitCard, pilotCard]);
    const state = makeState([unit, pilot]);
    const ctx: FilterContext = { state, catalog, perspectivePlayerIndex: 0 };
    expect(isLinked(unit, ctx)).toBe(true);
  });

  it('returns false when pilot does not satisfy link_conditions', () => {
    const pilot = makeInstance({ instance_id: 'pilot', card_id: 'TEST-002' });
    const unit = makeInstance({ paired_with_instance_id: 'pilot' });
    const unitCard = makeCard({
      link_conditions: [{ traits_include: ['White Base Team'] }],
    });
    const pilotCard = makeCard({ id: 'TEST-002', type: 'pilot', traits: ['Zeon'] });
    const catalog = buildCatalog([unitCard, pilotCard]);
    const state = makeState([unit, pilot]);
    const ctx: FilterContext = { state, catalog, perspectivePlayerIndex: 0 };
    expect(isLinked(unit, ctx)).toBe(false);
  });
});
