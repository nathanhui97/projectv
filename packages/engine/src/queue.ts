/**
 * Queue processor — walks the pending_resolutions queue and executes
 * ability steps until it needs player input or the queue is empty.
 */
import type { GameState, PendingResolution } from '@project-v/schemas';
import type { CardCatalog } from './catalog';
import { resolveStep, type StepContext } from './steps';
import { lookupCard } from './catalog';

// Process until waiting or empty. Returns the new state.
export function processQueue(state: GameState, catalog: CardCatalog): GameState {
  let s = structuredClone(state);

  while (s.pending_resolutions.length > 0) {
    const resolution = s.pending_resolutions[0]!;

    // If already waiting for player input, stop
    if (resolution.waiting_for) break;

    // Look up the ability
    const card = findCardForAbility(s, catalog, resolution.ability_id, resolution.source_instance_id);
    if (!card) {
      // Orphaned resolution — remove and continue
      s.pending_resolutions.shift();
      continue;
    }

    const ability = card.abilities.find(a => a.id === resolution.ability_id);
    if (!ability) {
      s.pending_resolutions.shift();
      continue;
    }

    const steps = ability.steps;
    if (resolution.next_step_index >= steps.length) {
      // All steps done — pop this resolution
      s.pending_resolutions.shift();
      continue;
    }

    const step = steps[resolution.next_step_index]!;
    const ctx: StepContext = { state: s, catalog, resolution };
    const result = resolveStep(step as Record<string, unknown>, ctx);

    if (result.kind === 'waiting') {
      // Update state and set waiting_for
      s = structuredClone(result.state);
      s.pending_resolutions[0]!.waiting_for = result.waitingFor;
      break;
    }

    // Step done — advance
    s = structuredClone(result.state);
    s.pending_resolutions[0]!.next_step_index = resolution.next_step_index + 1;
  }

  return s;
}

function findCardForAbility(
  state: GameState,
  catalog: CardCatalog,
  abilityId: string,
  sourceInstanceId: string,
) {
  // Find the source instance's card
  for (const player of state.players) {
    for (const zone of Object.values(player.zones)) {
      for (const inst of zone.cards) {
        if (inst.instance_id === sourceInstanceId) {
          const card = catalog.get(inst.card_id);
          if (card?.abilities.some(a => a.id === abilityId)) return card;
        }
      }
    }
  }
  // Also check catalog for abilities that might be on cards no longer on field (unlikely but safe)
  return null;
}
