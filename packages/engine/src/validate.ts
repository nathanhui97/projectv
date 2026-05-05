import type { GameState, MatchAction } from '@project-v/schemas';
import type { CardCatalog } from './catalog';
import { resolveEffectiveStats, hasKeyword } from './stats';

type ValidationResult = { valid: true } | { valid: false; reason: string };

function ok(): ValidationResult { return { valid: true }; }
function fail(reason: string): ValidationResult { return { valid: false, reason }; }

export function validateAction(
  state: GameState,
  action: MatchAction,
  catalog: CardCatalog,
): ValidationResult {
  // Game already over
  if (state.winner_index !== undefined) return fail('Game is already over');

  // Pending resolution must be cleared before taking regular actions
  if (state.pending_resolutions.length > 0) {
    const res = state.pending_resolutions[0]!;
    if (res.waiting_for) {
      const allowed = ['resolve_choice', 'resolve_manual', 'concede'];
      if (!allowed.includes(action.type)) {
        return fail('Must resolve pending ability first');
      }
    }
  }

  const pi = action.controller_index;

  // During mulligan only specific actions are allowed
  if (state.phase === 'mulligan') {
    const mulliganAllowed = ['redraw', 'keep_hand', 'concede', 'resolve_choice', 'resolve_manual'];
    if (!mulliganAllowed.includes(action.type)) return fail('Only mulligan actions allowed during mulligan phase');
  }

  switch (action.type) {
    case 'redraw':
    case 'keep_hand': {
      if (state.phase !== 'mulligan') return fail('Not in mulligan phase');
      if (state.players[pi].has_redrawn) return fail('Already made mulligan decision');
      return ok();
    }

    case 'place_resource': {
      if (state.phase !== 'resource') return fail('Not in resource phase');
      if (state.active_player_index !== pi) return fail('Not your turn');
      if (state.players[pi].has_placed_resource_this_turn) return fail('Already placed a resource');
      const payload = action.payload as { card_instance_id?: string };
      if (!payload.card_instance_id) return fail('Missing card_instance_id');
      const inHand = state.players[pi].zones.hand.cards.some(c => c.instance_id === payload.card_instance_id);
      if (!inHand) return fail('Card not in hand');
      return ok();
    }

    case 'skip_resource': {
      if (state.phase !== 'resource') return fail('Not in resource phase');
      if (state.active_player_index !== pi) return fail('Not your turn');
      return ok();
    }

    case 'deploy_card': {
      if (state.phase !== 'main') return fail('Not in main phase');
      if (state.active_player_index !== pi) return fail('Not your turn');
      const payload = action.payload as { card_instance_id?: string };
      if (!payload.card_instance_id) return fail('Missing card_instance_id');
      const inst = state.players[pi].zones.hand.cards.find(c => c.instance_id === payload.card_instance_id);
      if (!inst) return fail('Card not in hand');
      const card = catalog.get(inst.card_id);
      if (!card) return fail('Card not in catalog');
      const stats = resolveEffectiveStats(inst, card);
      const activeRes = state.players[pi].zones.resource_area.cards.filter(c => !c.is_resting).length;
      if (activeRes < stats.cost) return fail(`Not enough resources (need ${stats.cost}, have ${activeRes})`);
      if (card.type !== 'command' && card.type !== 'base' && card.type !== 'pilot') {
        if (state.players[pi].zones.battle_area.cards.length >= 6) return fail('Battle area is full');
      }
      return ok();
    }

    case 'pair_pilot': {
      if (state.phase !== 'main') return fail('Not in main phase');
      if (state.active_player_index !== pi) return fail('Not your turn');
      const payload = action.payload as { pilot_instance_id?: string; unit_instance_id?: string };
      if (!payload.pilot_instance_id || !payload.unit_instance_id) return fail('Missing payload fields');
      const unitInBattle = state.players[pi].zones.battle_area.cards.some(c => c.instance_id === payload.unit_instance_id);
      if (!unitInBattle) return fail('Unit not in battle area');
      const pilotInHand = state.players[pi].zones.hand.cards.some(c => c.instance_id === payload.pilot_instance_id);
      const pilotInBattle = state.players[pi].zones.battle_area.cards.some(c => c.instance_id === payload.pilot_instance_id);
      if (!pilotInHand && !pilotInBattle) return fail('Pilot not found');
      return ok();
    }

    case 'play_command': {
      if (state.active_player_index !== pi) return fail('Not your turn');
      const payload = action.payload as { card_instance_id?: string };
      if (!payload.card_instance_id) return fail('Missing card_instance_id');
      const inst = state.players[pi].zones.hand.cards.find(c => c.instance_id === payload.card_instance_id);
      if (!inst) return fail('Card not in hand');
      const card = catalog.get(inst.card_id);
      if (!card) return fail('Card not in catalog');
      if (card.type !== 'command') return fail('Not a command card');
      return ok();
    }

    case 'attack_player':
    case 'attack_unit':
    case 'attack_base': {
      if (state.phase !== 'main') return fail('Not in main phase');
      if (state.active_player_index !== pi) return fail('Not your turn');
      if (state.attack_substate) return fail('Attack already in progress');
      const payload = action.payload as { attacker_instance_id?: string; target_instance_id?: string };
      if (!payload.attacker_instance_id) return fail('Missing attacker_instance_id');
      const attacker = state.players[pi].zones.battle_area.cards.find(c => c.instance_id === payload.attacker_instance_id);
      if (!attacker) return fail('Attacker not in battle area');
      if (attacker.is_resting) return fail('Attacker is resting');
      if (state.units_attacked_this_turn.includes(attacker.instance_id)) return fail('Unit already attacked this turn');
      if (action.type === 'attack_unit') {
        const oppi = (1 - pi) as 0 | 1;
        if (!payload.target_instance_id) return fail('Missing target_instance_id');
        const target = state.players[oppi].zones.battle_area.cards.find(c => c.instance_id === payload.target_instance_id);
        if (!target) return fail('Target not in opponent battle area');
      }
      return ok();
    }

    case 'use_blocker': {
      if (!state.attack_substate) return fail('No attack in progress');
      if (state.attack_substate.step !== 'declared') return fail('Not in declared step');
      const oppi = (1 - state.active_player_index) as 0 | 1;
      if (pi !== oppi) return fail('Only defending player can declare blocker');
      const payload = action.payload as { blocker_instance_id?: string };
      if (!payload.blocker_instance_id) return fail('Missing blocker_instance_id');
      const blocker = state.players[oppi].zones.battle_area.cards.find(c => c.instance_id === payload.blocker_instance_id);
      if (!blocker) return fail('Blocker not in battle area');
      if (blocker.is_resting) return fail('Blocker is resting');
      const blockerCard = catalog.get(blocker.card_id);
      if (!blockerCard) return fail('Blocker card not in catalog');
      if (!hasKeyword(resolveEffectiveStats(blocker, blockerCard), 'blocker')) return fail('Not a Blocker unit');
      return ok();
    }

    case 'skip_blocker': {
      if (!state.attack_substate) return fail('No attack in progress');
      if (state.attack_substate.step !== 'declared') return fail('Not in declared step');
      const oppi = (1 - state.active_player_index) as 0 | 1;
      if (pi !== oppi) return fail('Only defending player can skip blocker');
      return ok();
    }

    case 'activate_ability': {
      const payload = action.payload as { source_instance_id?: string; ability_id?: string };
      if (!payload.source_instance_id || !payload.ability_id) return fail('Missing payload fields');
      let inst = null;
      for (const zone of Object.values(state.players[pi].zones)) {
        inst = zone.cards.find(c => c.instance_id === payload.source_instance_id) ?? null;
        if (inst) break;
      }
      if (!inst) return fail('Source instance not found');
      const card = catalog.get(inst.card_id);
      if (!card) return fail('Card not in catalog');
      const ability = card.abilities.find(a => a.id === payload.ability_id);
      if (!ability) return fail('Ability not found');
      const ttype = ability.trigger.type;
      if (!['activated_main', 'activated_action', 'activated_main_or_action'].includes(ttype)) {
        return fail('Ability is not an activated ability');
      }
      if (ttype === 'activated_main' && (state.phase !== 'main' || state.active_player_index !== pi)) {
        return fail('Activated Main ability only usable during your Main phase');
      }
      if (ability.trigger.qualifiers?.once_per_turn && state.players[pi].abilities_used_this_turn.includes(ability.id)) {
        return fail('Ability already used this turn');
      }
      return ok();
    }

    case 'resolve_choice': {
      if (state.pending_resolutions.length === 0) return fail('No pending resolution');
      if (!state.pending_resolutions[0]!.waiting_for) return fail('Not waiting for a choice');
      if (state.pending_resolutions[0]!.waiting_for!.type !== 'choice') return fail('Not a choice step');
      return ok();
    }

    case 'resolve_manual': {
      if (state.pending_resolutions.length === 0) return fail('No pending resolution');
      if (!state.pending_resolutions[0]!.waiting_for) return fail('Not waiting for manual resolve');
      if (state.pending_resolutions[0]!.waiting_for!.type !== 'manual_resolve') return fail('Not a manual_resolve step');
      return ok();
    }

    case 'pass_priority':
      if (state.priority_player_index !== pi) return fail('Not your priority');
      return ok();

    case 'end_phase': {
      if (state.active_player_index !== pi) return fail('Not your turn');
      if (state.attack_substate) return fail('Cannot end phase during attack');
      if (state.phase === 'end') {
        const hand = state.players[pi].zones.hand.cards;
        if (hand.length > 10) return fail('Must discard to 10 cards before ending turn');
      }
      return ok();
    }

    case 'end_turn': {
      if (state.active_player_index !== pi) return fail('Not your turn');
      if (state.phase !== 'end') return fail('Not in end phase');
      const hand = state.players[pi].zones.hand.cards;
      if (hand.length > 10) return fail('Must discard to 10 cards before ending turn');
      return ok();
    }

    case 'concede':
      return ok();

    default:
      return fail(`Unknown action type: ${action.type}`);
  }
}
