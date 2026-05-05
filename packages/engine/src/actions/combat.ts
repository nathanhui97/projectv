import type { GameState, MatchAction, CardInstance } from '@project-v/schemas';
import type { CardCatalog } from '../catalog';
import { resolveEffectiveStats, hasKeyword } from '../stats';
import { findInstanceLocation } from '../filter';
import { collectTriggers } from '../triggers';
import { processQueue } from '../queue';
import { destroyInstance } from '../steps';
import { setWinner } from '../win';

export function applyAttackPlayer(
  state: GameState,
  action: MatchAction,
  catalog: CardCatalog,
): GameState {
  const pi = action.controller_index as 0 | 1;
  const payload = action.payload as { attacker_instance_id: string };

  if (state.phase !== 'main') throw new Error('Can only attack during main phase');
  if (state.active_player_index !== pi) throw new Error('Not your turn');
  if (state.attack_substate) throw new Error('Attack already in progress');

  const attacker = findInstInPlayer(state, pi, payload.attacker_instance_id);
  if (!attacker) throw new Error('Attacker not in battle area');
  if (attacker.is_resting) throw new Error('Attacker is resting');
  if (state.units_attacked_this_turn.includes(attacker.instance_id)) {
    throw new Error('Unit has already attacked this turn');
  }

  const oppi = (1 - pi) as 0 | 1;
  const attackerCard = catalog.get(attacker.card_id);
  if (!attackerCard) throw new Error('Attacker card not found in catalog');
  const attackerStats = resolveEffectiveStats(attacker, attackerCard);

  // Check if opponent has units with Blocker keyword; if so, must attack them unless attacker has High-Maneuver
  const opponentUnits = state.players[oppi].zones.battle_area.cards;
  const hasHighManeuver = hasKeyword(attackerStats, 'high_maneuver');
  if (!hasHighManeuver) {
    const blockerUnits = opponentUnits.filter(u => {
      const c = catalog.get(u.card_id);
      if (!c) return false;
      return hasKeyword(resolveEffectiveStats(u, c), 'blocker');
    });
    if (blockerUnits.length > 0) {
      throw new Error('Must attack a Blocker unit (or use a High-Maneuver unit to bypass)');
    }
  }

  const s = structuredClone(state);
  s.attack_substate = {
    attacker_instance_id: attacker.instance_id,
    target: { kind: 'player' },
    blocker_instance_id: null,
    step: 'declared',
  };

  return processQueue(s, catalog);
}

export function applyAttackUnit(
  state: GameState,
  action: MatchAction,
  catalog: CardCatalog,
): GameState {
  const pi = action.controller_index as 0 | 1;
  const payload = action.payload as { attacker_instance_id: string; target_instance_id: string };

  if (state.phase !== 'main') throw new Error('Can only attack during main phase');
  if (state.active_player_index !== pi) throw new Error('Not your turn');
  if (state.attack_substate) throw new Error('Attack already in progress');

  const oppi = (1 - pi) as 0 | 1;
  const attacker = findInstInPlayer(state, pi, payload.attacker_instance_id);
  const target = findInstInPlayer(state, oppi, payload.target_instance_id);
  if (!attacker) throw new Error('Attacker not found');
  if (!target) throw new Error('Target not found in opponent battle area');
  if (attacker.is_resting) throw new Error('Attacker is resting');
  if (state.units_attacked_this_turn.includes(attacker.instance_id)) {
    throw new Error('Unit has already attacked this turn');
  }

  const s = structuredClone(state);
  s.attack_substate = {
    attacker_instance_id: attacker.instance_id,
    target: { kind: 'unit', instance_id: target.instance_id },
    blocker_instance_id: null,
    step: 'declared',
  };

  return processQueue(s, catalog);
}

export function applyAttackBase(
  state: GameState,
  action: MatchAction,
  catalog: CardCatalog,
): GameState {
  const pi = action.controller_index as 0 | 1;
  const payload = action.payload as { attacker_instance_id: string };

  if (state.phase !== 'main') throw new Error('Can only attack during main phase');
  if (state.active_player_index !== pi) throw new Error('Not your turn');
  if (state.attack_substate) throw new Error('Attack already in progress');

  const attacker = findInstInPlayer(state, pi, payload.attacker_instance_id);
  if (!attacker) throw new Error('Attacker not found');
  if (attacker.is_resting) throw new Error('Attacker is resting');
  if (state.units_attacked_this_turn.includes(attacker.instance_id)) {
    throw new Error('Unit has already attacked this turn');
  }

  const s = structuredClone(state);
  s.attack_substate = {
    attacker_instance_id: attacker.instance_id,
    target: { kind: 'base' },
    blocker_instance_id: null,
    step: 'declared',
  };

  return processQueue(s, catalog);
}

export function applyUseBlocker(
  state: GameState,
  action: MatchAction,
  catalog: CardCatalog,
): GameState {
  const pi = action.controller_index as 0 | 1;
  const payload = action.payload as { blocker_instance_id: string };

  if (!state.attack_substate) throw new Error('No attack in progress');
  if (state.attack_substate.step !== 'declared') throw new Error('Not in declared step');

  const oppi = (1 - state.active_player_index) as 0 | 1;
  if (pi !== oppi) throw new Error('Only the defending player can declare a blocker');

  const blocker = findInstInPlayer(state, oppi, payload.blocker_instance_id);
  if (!blocker) throw new Error('Blocker not found in battle area');
  if (blocker.is_resting) throw new Error('Blocker is resting');

  const blockerCard = catalog.get(blocker.card_id);
  if (!blockerCard) throw new Error('Blocker card not found');
  const blockerStats = resolveEffectiveStats(blocker, blockerCard);
  if (!hasKeyword(blockerStats, 'blocker')) throw new Error('Unit does not have Blocker keyword');

  const s = structuredClone(state);
  s.attack_substate!.blocker_instance_id = blocker.instance_id;
  s.attack_substate!.step = 'defender_action';

  return processQueue(s, catalog);
}

export function applySkipBlocker(
  state: GameState,
  action: MatchAction,
  catalog: CardCatalog,
): GameState {
  const pi = action.controller_index as 0 | 1;

  if (!state.attack_substate) throw new Error('No attack in progress');
  if (state.attack_substate.step !== 'declared') throw new Error('Not in declared step');

  const oppi = (1 - state.active_player_index) as 0 | 1;
  if (pi !== oppi) throw new Error('Only defending player can skip blocker');

  const s = structuredClone(state);
  s.attack_substate!.step = 'defender_action';
  return s;
}

// Resolve combat damage for the current attack_substate.
// Called after the attacker_action step concludes (no more priority responses).
export function resolveCombatDamage(
  state: GameState,
  catalog: CardCatalog,
): GameState {
  if (!state.attack_substate) return state;

  const sub = state.attack_substate;
  const attackerPi = state.active_player_index;
  const defenderPi = (1 - attackerPi) as 0 | 1;

  const attacker = findInstInAny(state, sub.attacker_instance_id);
  if (!attacker) return cleanupAttack(state);

  const attackerCard = catalog.get(attacker.card_id);
  if (!attackerCard) return cleanupAttack(state);
  const attackerStats = resolveEffectiveStats(attacker, attackerCard);

  let s = structuredClone(state);
  s.attack_substate!.step = 'damage';

  if (sub.target.kind === 'player') {
    // Break the top shield (or damage base if no shields)
    s = dealPlayerDamage(s, defenderPi, attackerStats.ap, catalog);
  } else if (sub.target.kind === 'base') {
    // Direct damage to base
    const base = s.players[defenderPi].zones.shield_base_section.cards[0];
    if (base) {
      base.damage += attackerStats.ap;
      const baseCard = catalog.get(base.card_id);
      if (baseCard) {
        const baseStats = resolveEffectiveStats(base, baseCard);
        if (base.damage >= baseStats.hp) {
          // Base destroyed — game over
          s = setWinner(s, attackerPi as 0 | 1, 'base_destroyed');
        }
      }
    }
  } else if (sub.target.kind === 'unit') {
    const defender = findInstInAny(s, sub.target.instance_id);
    if (defender) {
      const defenderCard = catalog.get(defender.card_id);
      if (defenderCard) {
        const defenderStats = resolveEffectiveStats(defender, defenderCard);

        const attackerHasFirstStrike = hasKeyword(attackerStats, 'first_strike');
        const defenderHasFirstStrike = hasKeyword(defenderStats, 'first_strike');

        if (attackerHasFirstStrike && !defenderHasFirstStrike) {
          // Attacker hits first
          defender.damage += attackerStats.ap;
          if (defender.damage >= defenderStats.hp) {
            s = destroyInstance(s, defender.instance_id);
            // Defender is destroyed — attacker takes no counter-damage
            const triggers = collectTriggers(s, catalog, {
              type: 'on_battle_destroy',
              instanceId: attacker.instance_id,
            });
            s.pending_resolutions.push(...triggers);
          } else {
            // Defender survives — deals counter-damage
            const attackerInS = findInstInAny(s, attacker.instance_id);
            if (attackerInS) {
              attackerInS.damage += defenderStats.ap;
              if (attackerInS.damage >= attackerStats.hp) {
                s = destroyInstance(s, attacker.instance_id);
              }
            }
          }
        } else {
          // Simultaneous damage
          const attackerInS = findInstInAny(s, attacker.instance_id);
          if (attackerInS) attackerInS.damage += defenderStats.ap;
          const defenderInS = findInstInAny(s, defender.instance_id);
          if (defenderInS) defenderInS.damage += attackerStats.ap;

          // Check destruction
          const attackerInS2 = findInstInAny(s, attacker.instance_id);
          if (attackerInS2) {
            const aCard = catalog.get(attackerInS2.card_id);
            if (aCard) {
              const aStats = resolveEffectiveStats(attackerInS2, aCard);
              if (attackerInS2.damage >= aStats.hp) s = destroyInstance(s, attackerInS2.instance_id);
            }
          }
          const defenderInS2 = findInstInAny(s, defender.instance_id);
          if (defenderInS2) {
            const dCard = catalog.get(defenderInS2.card_id);
            if (dCard) {
              const dStats = resolveEffectiveStats(defenderInS2, dCard);
              if (defenderInS2.damage >= dStats.hp) {
                s = destroyInstance(s, defenderInS2.instance_id);
                const triggers = collectTriggers(s, catalog, {
                  type: 'on_battle_destroy',
                  instanceId: attacker.instance_id,
                });
                s.pending_resolutions.push(...triggers);
              }
            }
          }
        }
      }
    }
  }

  // Rest the attacker
  const attackerInFinal = findInstInAny(s, sub.attacker_instance_id);
  if (attackerInFinal) attackerInFinal.is_resting = true;

  // Track attacked unit
  s.units_attacked_this_turn = [...s.units_attacked_this_turn, sub.attacker_instance_id];

  return cleanupAttack(processQueue(s, catalog));
}

// Deal damage to a player (break shields or damage base)
function dealPlayerDamage(
  state: GameState,
  defenderPi: 0 | 1,
  damage: number,
  catalog: CardCatalog,
): GameState {
  let s = structuredClone(state);
  const attackerPi = (1 - defenderPi) as 0 | 1;

  for (let i = 0; i < damage; i++) {
    const shields = s.players[defenderPi].zones.shield_area.cards;
    if (shields.length > 0) {
      // Break top shield
      const [shield] = shields.splice(0, 1);
      shield!.is_face_down = false;
      s.players[defenderPi].zones.trash.cards.push(shield!);

      // Collect shield destroy triggers
      const triggers = collectTriggers(s, catalog, {
        type: 'on_shield_destroy',
        playerIndex: defenderPi,
      });

      // Check for Burst on shield card
      const shieldCard = catalog.get(shield!.card_id);
      if (shieldCard) {
        for (const ability of shieldCard.abilities) {
          if (ability.trigger.type === 'on_burst') {
            s.pending_resolutions.unshift({
              ability_id: ability.id,
              source_instance_id: shield!.instance_id,
              controller_index: defenderPi,
              stored_variables: {},
              next_step_index: 0,
            });
          }
        }
      }

      s.pending_resolutions.push(...triggers);
    } else {
      // No shields — damage goes to base
      const base = s.players[defenderPi].zones.shield_base_section.cards[0];
      if (base) {
        base.damage += 1;
        const baseCard = catalog.get(base.card_id);
        if (baseCard) {
          const baseStats = resolveEffectiveStats(base, baseCard);
          if (base.damage >= baseStats.hp) {
            s = setWinner(s, attackerPi, 'base_destroyed');
            break;
          }
        }
      } else {
        // No base either — player loses
        s = setWinner(s, attackerPi, 'no_base');
        break;
      }
    }
  }

  return s;
}

function cleanupAttack(state: GameState): GameState {
  const s = structuredClone(state);
  s.attack_substate = null;
  return s;
}

function findInstInPlayer(
  state: GameState,
  pi: 0 | 1,
  instanceId: string,
): CardInstance | null {
  return state.players[pi].zones.battle_area.cards.find(c => c.instance_id === instanceId) ?? null;
}

function findInstInAny(state: GameState, instanceId: string): CardInstance | null {
  for (const player of state.players) {
    for (const zone of Object.values(player.zones)) {
      for (const inst of zone.cards) {
        if (inst.instance_id === instanceId) return inst;
      }
    }
  }
  return null;
}
