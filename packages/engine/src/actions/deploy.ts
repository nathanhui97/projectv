import type { GameState, MatchAction, CardInstance } from '@project-v/schemas';
import type { CardCatalog } from '../catalog';
import { resolveEffectiveStats } from '../stats';
import { collectTriggers } from '../triggers';
import { processQueue } from '../queue';

export function applyDeployCard(
  state: GameState,
  action: MatchAction,
  catalog: CardCatalog,
): GameState {
  const pi = action.controller_index;
  const player = state.players[pi];
  const payload = action.payload as { card_instance_id: string };

  if (state.phase !== 'main') throw new Error('Cannot deploy outside main phase');
  if (state.active_player_index !== pi) throw new Error('Not your turn');

  const handIdx = player.zones.hand.cards.findIndex(
    c => c.instance_id === payload.card_instance_id,
  );
  if (handIdx === -1) throw new Error('Card not in hand');

  const inst = player.zones.hand.cards[handIdx]!;
  const card = catalog.get(inst.card_id);
  if (!card) throw new Error(`Card not in catalog: ${inst.card_id}`);

  // Pay cost
  const cost = resolveEffectiveStats(inst, card).cost;
  const activeResources = player.zones.resource_area.cards.filter(c => !c.is_resting);
  if (activeResources.length < cost) {
    throw new Error(`Not enough resources: need ${cost}, have ${activeResources.length}`);
  }

  const s = structuredClone(state);

  // Rest resources to pay
  let paid = 0;
  for (const res of s.players[pi].zones.resource_area.cards) {
    if (!res.is_resting && paid < cost) {
      res.is_resting = true;
      paid++;
    }
  }

  // Move from hand to appropriate zone
  s.players[pi].zones.hand.cards.splice(handIdx, 1);
  const deployedInst = structuredClone(inst);
  deployedInst.is_face_down = false;
  deployedInst.is_resting = false;

  if (card.type === 'base') {
    // Limit: one base per player
    if (s.players[pi].zones.shield_base_section.cards.length > 0) {
      throw new Error('Already have a base in play');
    }
    s.players[pi].zones.shield_base_section.cards.push(deployedInst);
  } else if (card.type === 'pilot') {
    // Pilots go to hand or battle_area depending on if they're being paired
    // For standalone deploy, pilots go to hand (they're paired later)
    // Actually pilots deployed standalone go to battle_area in some games
    // For GTCG: pilots typically pair immediately on deploy
    s.players[pi].zones.battle_area.cards.push(deployedInst);
  } else if (card.type === 'command') {
    // Commands resolve then go to trash — handled via play_command action
    s.players[pi].zones.trash.cards.push(deployedInst);
  } else {
    // unit, token, resource → battle_area
    if (s.players[pi].zones.battle_area.cards.length >= 6) {
      throw new Error('Battle area is full (max 6 units)');
    }
    s.players[pi].zones.battle_area.cards.push(deployedInst);
  }

  // Collect on_deploy triggers
  const triggers = collectTriggers(s, catalog, {
    type: 'on_deploy',
    instanceId: deployedInst.instance_id,
  });
  s.pending_resolutions.push(...triggers);

  return processQueue(s, catalog);
}

export function applyPairPilot(
  state: GameState,
  action: MatchAction,
  catalog: CardCatalog,
): GameState {
  const pi = action.controller_index;
  const payload = action.payload as { pilot_instance_id: string; unit_instance_id: string };

  if (state.phase !== 'main') throw new Error('Cannot pair outside main phase');
  if (state.active_player_index !== pi) throw new Error('Not your turn');

  // Find pilot (in hand or battle_area) and unit (in battle_area)
  const pilotHandIdx = state.players[pi].zones.hand.cards.findIndex(
    c => c.instance_id === payload.pilot_instance_id,
  );
  const pilotBattleIdx = state.players[pi].zones.battle_area.cards.findIndex(
    c => c.instance_id === payload.pilot_instance_id,
  );
  const unitIdx = state.players[pi].zones.battle_area.cards.findIndex(
    c => c.instance_id === payload.unit_instance_id,
  );
  if (unitIdx === -1) throw new Error('Unit not in battle area');
  if (pilotHandIdx === -1 && pilotBattleIdx === -1) throw new Error('Pilot not found');

  const s = structuredClone(state);
  const unit = s.players[pi].zones.battle_area.cards[unitIdx]!;

  let pilotInst: CardInstance;
  if (pilotHandIdx !== -1) {
    const [p] = s.players[pi].zones.hand.cards.splice(pilotHandIdx, 1);
    pilotInst = p!;
    pilotInst.is_face_down = false;
    s.players[pi].zones.battle_area.cards.push(pilotInst);
  } else {
    pilotInst = s.players[pi].zones.battle_area.cards[pilotBattleIdx]!;
  }

  // Pay pilot cost
  const pilotCard = catalog.get(pilotInst.card_id);
  if (pilotCard && pilotCard.cost) {
    const cost = pilotCard.cost;
    const activeResources = s.players[pi].zones.resource_area.cards.filter(c => !c.is_resting);
    if (activeResources.length < cost) throw new Error('Not enough resources to pair');
    let paid = 0;
    for (const res of s.players[pi].zones.resource_area.cards) {
      if (!res.is_resting && paid < cost) { res.is_resting = true; paid++; }
    }
  }

  // Link pairing
  unit.paired_with_instance_id = pilotInst.instance_id;
  pilotInst.paired_with_instance_id = unit.instance_id;

  // Also apply pilot stat modifiers to the unit
  if (pilotCard?.pilot_modifiers) {
    const { ap_mod, hp_mod } = pilotCard.pilot_modifiers;
    if (ap_mod) {
      unit.temporary_modifiers.push({
        source_ability_id: `pilot_mod_${pilotInst.instance_id}`,
        stat: 'ap',
        amount: ap_mod,
        duration: 'while_paired',
      });
    }
    if (hp_mod) {
      unit.temporary_modifiers.push({
        source_ability_id: `pilot_mod_${pilotInst.instance_id}`,
        stat: 'hp',
        amount: hp_mod,
        duration: 'while_paired',
      });
    }
  }

  const triggers = collectTriggers(s, catalog, {
    type: 'on_pair',
    instanceId: unit.instance_id,
  });
  s.pending_resolutions.push(...triggers);

  return processQueue(s, catalog);
}

export function applyPlayCommand(
  state: GameState,
  action: MatchAction,
  catalog: CardCatalog,
): GameState {
  const pi = action.controller_index;
  const player = state.players[pi];
  const payload = action.payload as { card_instance_id: string };

  if (state.active_player_index !== pi) throw new Error('Not your turn');
  // Commands can be played during main phase or as responses
  if (state.phase !== 'main' && state.phase !== 'mulligan') {
    // Allow during attack substates too (action abilities)
    if (!state.attack_substate) throw new Error('Cannot play command now');
  }

  const handIdx = player.zones.hand.cards.findIndex(
    c => c.instance_id === payload.card_instance_id,
  );
  if (handIdx === -1) throw new Error('Card not in hand');

  const inst = player.zones.hand.cards[handIdx]!;
  const card = catalog.get(inst.card_id);
  if (!card || card.type !== 'command') throw new Error('Not a command card');

  // Pay cost
  const cost = resolveEffectiveStats(inst, card).cost;
  const activeResources = player.zones.resource_area.cards.filter(c => !c.is_resting);
  if (activeResources.length < cost) throw new Error('Not enough resources');

  const s = structuredClone(state);
  let paid = 0;
  for (const res of s.players[pi].zones.resource_area.cards) {
    if (!res.is_resting && paid < cost) { res.is_resting = true; paid++; }
  }

  // Move from hand to trash immediately (commands are one-time)
  const [removed] = s.players[pi].zones.hand.cards.splice(handIdx, 1);
  removed!.is_face_down = false;
  s.players[pi].zones.trash.cards.push(removed!);

  // Push ability steps onto the queue
  for (const ability of card.abilities) {
    s.pending_resolutions.push({
      ability_id: ability.id,
      source_instance_id: removed!.instance_id,
      controller_index: pi,
      stored_variables: {},
      next_step_index: 0,
    });
  }

  return processQueue(s, catalog);
}
