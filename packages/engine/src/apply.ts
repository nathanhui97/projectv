import type { GameState, MatchAction } from '@project-v/schemas';
import type { CardCatalog } from './catalog';
import { validateAction } from './validate';
import { applyRedraw, applyKeepHand } from './actions/setup';
import { applyPlaceResource, applySkipResource } from './actions/resources';
import { applyDeployCard, applyPairPilot, applyPlayCommand } from './actions/deploy';
import {
  applyAttackPlayer,
  applyAttackUnit,
  applyAttackBase,
  applyUseBlocker,
  applySkipBlocker,
} from './actions/combat';
import {
  applyActivateAbility,
  applyResolveChoice,
  applyResolveManual,
} from './actions/abilities';
import { applyPassPriority, applyEndPhase, applyEndTurn, applyConcede } from './actions/turn';
import { checkWinCondition } from './win';

export function applyAction(
  state: GameState,
  action: MatchAction,
  catalog: CardCatalog,
): GameState {
  // Validate first
  const validation = validateAction(state, action, catalog);
  if (!validation.valid) throw new Error(validation.reason);

  // Stamp sequence number
  const s0 = {
    ...state,
    action_sequence_number: state.action_sequence_number + 1,
  };

  let next: GameState;

  switch (action.type) {
    case 'redraw':       next = applyRedraw(s0, action); break;
    case 'keep_hand':    next = applyKeepHand(s0, action); break;

    case 'place_resource': next = applyPlaceResource(s0, action, catalog); break;
    case 'skip_resource':  next = applySkipResource(s0, action); break;

    case 'deploy_card':    next = applyDeployCard(s0, action, catalog); break;
    case 'pair_pilot':     next = applyPairPilot(s0, action, catalog); break;
    case 'play_command':   next = applyPlayCommand(s0, action, catalog); break;

    case 'attack_player': next = applyAttackPlayer(s0, action, catalog); break;
    case 'attack_unit':   next = applyAttackUnit(s0, action, catalog); break;
    case 'attack_base':   next = applyAttackBase(s0, action, catalog); break;
    case 'use_blocker':   next = applyUseBlocker(s0, action, catalog); break;
    case 'skip_blocker':  next = applySkipBlocker(s0, action, catalog); break;

    case 'activate_ability': next = applyActivateAbility(s0, action, catalog); break;
    case 'resolve_choice':   next = applyResolveChoice(s0, action, catalog); break;
    case 'resolve_manual':   next = applyResolveManual(s0, action, catalog); break;

    case 'pass_priority': next = applyPassPriority(s0, action, catalog); break;
    case 'end_phase':     next = applyEndPhase(s0, action, catalog); break;
    case 'end_turn':      next = applyEndTurn(s0, action, catalog); break;
    case 'concede':       next = applyConcede(s0, action); break;

    default:
      throw new Error(`Unhandled action type: ${(action as MatchAction).type}`);
  }

  // Append log entry
  return appendLog(next, action);
}

function appendLog(state: GameState, action: MatchAction): GameState {
  const summary = summarize(action);
  return {
    ...state,
    log: [
      ...state.log,
      {
        sequence_number: state.action_sequence_number,
        action_type: action.type,
        controller_index: action.controller_index,
        summary,
      },
    ],
  };
}

function summarize(action: MatchAction): string {
  const p = `P${action.controller_index + 1}`;
  switch (action.type) {
    case 'redraw':         return `${p} redraws their hand`;
    case 'keep_hand':      return `${p} keeps their hand`;
    case 'place_resource': return `${p} places a resource`;
    case 'skip_resource':  return `${p} skips resource placement`;
    case 'deploy_card':    return `${p} deploys a card`;
    case 'pair_pilot':     return `${p} pairs a pilot`;
    case 'play_command':   return `${p} plays a command`;
    case 'attack_player':  return `${p} attacks the player`;
    case 'attack_unit':    return `${p} attacks a unit`;
    case 'attack_base':    return `${p} attacks the base`;
    case 'use_blocker':    return `${p} uses a blocker`;
    case 'skip_blocker':   return `${p} skips blocker`;
    case 'activate_ability': return `${p} activates an ability`;
    case 'resolve_choice': return `${p} makes a choice`;
    case 'resolve_manual': return `${p} confirms manual step`;
    case 'pass_priority':  return `${p} passes priority`;
    case 'end_phase':      return `${p} ends the phase`;
    case 'end_turn':       return `${p} ends their turn`;
    case 'concede':        return `${p} concedes`;
    default:               return `${p} takes action: ${action.type}`;
  }
}
