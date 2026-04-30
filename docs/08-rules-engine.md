# 08 — Rules Engine Spec

The rules engine is the brain. It takes a GameState and a player Action and produces the next GameState. This doc specifies how.

## Design principles

1. **Pure functions where possible.** No side effects, no I/O, no platform deps. Easy to test, easy to port.
2. **Game state is data.** Every state is fully serializable (JSON). No closures, no class instances stored in state.
3. **Data-driven.** Card behavior is read from card data; engine code provides primitives, not card logic.
4. **Deterministic.** Same input state + same action = same output state. No randomness without explicit RNG seed.
5. **Validated everywhere.** Engine rejects illegal actions; never produces invalid states.
6. **Observable.** Every step is logged for debugging and replay.

## Where the engine lives

`/packages/engine` — pure TypeScript. Imported by:
- Mobile app (runs locally during matches)
- Admin portal (runs in sandbox tester)
- (v2) Edge Function for server-side authoritative play

Can NOT import: React, React Native, Supabase client, anything platform-specific.

## Public API

The engine exports a small surface area.

```typescript
// Initial setup
function getInitialState(input: {
  matchId: string;
  format: string;
  playerA: { id: string; username: string; deck: Deck };
  playerB: { id: string; username: string; deck: Deck };
  rngSeed: string;
}): GameState;

// Action validation
function validateAction(state: GameState, action: Action): 
  | { ok: true } 
  | { ok: false; reason: string };

// Action application
function applyAction(state: GameState, action: Action): GameState;

// Pending choice resolution
function resolveChoice(state: GameState, choice: ChoiceResponse): GameState;

// Mandatory effects (to be called whenever state may have triggered effects)
function processQueue(state: GameState): GameState;

// Win detection
function checkWinCondition(state: GameState): { 
  ended: false 
} | { 
  ended: true; 
  winnerId: string; 
  reason: string 
};

// Helpers
function rendersTo(card: Card): string; // Plain English render of card text
function listLegalActions(state: GameState, playerId: string): Action[];
function evaluateFilter(state: GameState, filter: Filter, context: EvalContext): InstanceId[];
```

## The action types

Every player-initiated game move is an Action. Engine validates it, applies it, and triggers downstream effects.

```typescript
type Action =
  | { type: 'mulligan'; playerId: string; redraw: boolean }
  | { type: 'place_shields'; playerId: string } // Auto, but logged
  | { type: 'pass_phase'; playerId: string }
  | { type: 'place_resource'; playerId: string; cardId: CardId } // From hand to resource area
  | { type: 'deploy_unit'; playerId: string; cardId: CardId; restedResources: InstanceId[] }
  | { type: 'pair_pilot'; playerId: string; pilotCardId: CardId; targetUnitInstanceId: InstanceId; restedResources: InstanceId[] }
  | { type: 'play_command'; playerId: string; cardId: CardId; restedResources: InstanceId[] }
  | { type: 'activate_main'; playerId: string; sourceInstanceId: InstanceId; abilityIndex: number; restedResources?: InstanceId[] }
  | { type: 'activate_action'; playerId: string; cardId: CardId; restedResources: InstanceId[] }
  | { type: 'declare_attack'; playerId: string; attackerInstanceId: InstanceId; target: AttackTarget }
  | { type: 'block'; playerId: string; blockerInstanceId: InstanceId }
  | { type: 'pass_action_step'; playerId: string }
  | { type: 'concede'; playerId: string }
  | { type: 'choice_response'; playerId: string; choiceId: string; response: any };

type AttackTarget = 
  | { kind: 'player' }
  | { kind: 'unit'; instanceId: InstanceId }
  | { kind: 'base' };
```

## Phases

Per the comprehensive rules, a turn has 5 phases:

1. **Start phase** — ready all rested cards (units, pilots, resources, base)
2. **Draw phase** — active player draws 1 (skipped on player 1's first turn)
3. **Resource phase** — active player may place 1 card from hand into resource area face-down
4. **Main phase** — active player may take any number of main actions in any order:
    - Deploy a Unit
    - Pair a Pilot
    - Play a Command
    - Activate `Activate・Main` ability
    - Declare an attack (begins attack sub-phase)
5. **End phase** — resolve end-of-turn effects (Repair, "until end of turn" expirations); active player discards down to max hand (10)

Then turn passes to the other player.

## Phase machine

The engine tracks `state.phase` and enforces what actions are legal in each phase.

```typescript
const PhaseTransitions: Record<Phase, Phase> = {
  start: 'draw',
  draw: 'resource',
  resource: 'main',
  main: 'end',
  end: 'start', // (other player's turn)
};
```

Some phases auto-advance (start, draw, end), others require player action (resource, main). Phase changes emit events.

## Attacks and action steps

Attacks are a complex sub-phase. When the active player declares an attack:

1. **Attack declaration** — attacker rests, target chosen. Trigger: `attack` (on attacker).
2. **Counter step (defender priority)** — defender may activate `Action` cards or use Blocker. Defender acts first per the action step system.
3. **Attacker action step** — attacker may activate counter responses.
4. **Damage resolution** — based on First Strike, Blocker presence, etc.
5. **Post-damage triggers** — destroyed triggers fire, burst effects on revealed shields fire.

This is a state machine within a state machine. The engine has a sub-state field `state.attack_substate` that tracks this.

```typescript
type AttackSubstate = null | {
  attackerInstanceId: InstanceId;
  target: AttackTarget;
  blocker: InstanceId | null;
  step: 'declared' | 'defender_action' | 'attacker_action' | 'damage' | 'resolution';
};
```

## Action queue

When an ability triggers, its steps are added to the action queue. The engine resolves them in order.

```typescript
type QueuedAction = {
  id: string;
  source: { cardId: CardId; instanceId: InstanceId; abilityIndex: number };
  remainingSteps: Step[];
  storedVariables: Record<string, InstanceId | InstanceId[]>;
  pendingChoiceId?: string;
};
```

The engine processes queue depth-first: when it hits a step requiring a choice, it pauses by setting `pending_choices` and waits for `resolveChoice`. After resolution, processing continues.

When the queue is empty and no pending choices, control returns to the active player for their next action.

## Pending choices

When an action requires a player decision (e.g., `choose_target`), the engine doesn't block — it returns a state with a pending choice.

```typescript
type PendingChoice = {
  id: string;
  type: 'choose_target' | 'choose_option' | 'yes_no' | ...;
  forPlayerId: string;
  prompt: string; // Human-readable
  options?: any; // Type-specific
  filter?: Filter; // For choose_target
  min?: number;
  max?: number;
  optional?: boolean;
};
```

Mobile app sees this in state.pending_choices and renders a UI prompting the player. Player taps a choice. App calls `resolveChoice(state, response)`.

## Continuous effects

Some abilities are continuous (e.g., "While linked, this Unit has Breach" or "All friendly Zeon Units have AP+1").

These are stored separately from the action queue:

```typescript
type ContinuousEffect = {
  id: string;
  source: { cardId: CardId; instanceId: InstanceId };
  appliesWhile: Condition; // E.g., "is_linked: $self"
  modifies: ContinuousModifier[];
};

type ContinuousModifier =
  | { type: 'stat_modifier'; target: Filter; stat: 'ap' | 'hp'; amount: number }
  | { type: 'grant_keyword'; target: Filter; keyword: string; value?: number }
  | { type: 'replacement_effect'; ... };
```

Continuous effects are evaluated *every time state is queried* — not stored on units directly. This avoids stale state when conditions change. The engine has helpers `getEffectiveAP(state, instanceId)` etc. that fold in continuous effect modifications.

## Replacement effects

A small number of effects replace events with different events. Example: "If this Unit would be destroyed, instead heal it to full and place 1 damage counter on it."

Modeled as:

```typescript
type ReplacementEffect = {
  id: string;
  trigger: 'would_be_destroyed' | 'would_take_damage' | ...;
  replacementSteps: Step[];
};
```

Engine consults replacement effects before normal event resolution. Per Bandai's rules, when multiple replacement effects apply, the controller of the affected card chooses order.

## Keyword effect implementations

Each keyword effect has a registered handler.

```typescript
const KeywordRegistry: Record<string, KeywordHandler> = {
  repair: {
    register(unit, value) {
      // Add an end_of_turn trigger to this unit's effective abilities
      return {
        trigger: 'end_of_turn',
        steps: [
          { action: 'heal', target: '$self', amount: value, condition: 'damage > 0' }
        ]
      };
    }
  },
  blocker: { ... },
  first_strike: { ... }, // Modifies damage timing
  high_maneuver: { ... }, // Prevents Blocker
  breach: { ... },
  support: { ... },
  suppression: { ... },
};
```

When a unit gains/loses a keyword (temporarily or permanently), the engine recomputes its effective ability list.

## Engine's main loop

```typescript
function applyAction(state: GameState, action: Action): GameState {
  // 1. Validate
  const validation = validateAction(state, action);
  if (!validation.ok) {
    throw new InvalidActionError(validation.reason);
  }
  
  // 2. Apply primary effect
  let newState = applyPrimaryEffect(state, action);
  
  // 3. Emit events; collect triggered abilities
  const triggered = collectTriggeredAbilities(state, newState, action);
  
  // 4. Add to queue
  newState = addToQueue(newState, triggered);
  
  // 5. Process queue (until pending choice or empty)
  newState = processQueue(newState);
  
  // 6. Check win condition
  const win = checkWinCondition(newState);
  if (win.ended) {
    newState = endMatch(newState, win);
  }
  
  // 7. Bump state_version
  newState.state_version++;
  
  // 8. Append to log
  newState.log.push({ action, timestamp: now() });
  
  return newState;
}
```

## Validation rules

`validateAction` runs before any state change. Some examples:

- `deploy_unit`: card is in hand, player has enough resources, Unit limit (6) not reached, not in attack substate, is main phase
- `place_resource`: phase is `resource`, hasn't placed yet this turn, card is in hand, resource limit (10) not reached
- `declare_attack`: unit is active (not rested), is on field, not paired-only-no-link case where pilot prevents (rare), is main phase, not currently in another attack
- `pair_pilot`: Unit not already paired, both unit and pilot exist, etc.

Validation is exhaustive. Tests catch every illegal action that should be rejected.

## Tests

Engine MUST be heavily tested. Tests live in `/packages/engine/test/`.

- **Unit tests** for every action type, every condition, every action primitive
- **Card behavior tests**: for each card with abilities, a test that sets up a state, plays the card, asserts the resulting state
- **Scenario tests**: full mini-matches that exercise rule interactions (e.g., "First Strike kills attacker before its damage applies")
- **Property tests**: random valid action sequences should never produce an invalid state

Aim for ~90% line coverage in `/packages/engine`. This is the most important code in the entire project — bugs here destroy player trust.

Use Vitest. Snapshot tests for state diffs after specific actions.

## Determinism and RNG

Card games include randomness (deck shuffling, random selections). Engine uses a seeded RNG.

```typescript
// State holds the RNG seed/state
state.rng_seed: string;

// Functions that need randomness derive from seed deterministically
function shuffleDeck(deck: CardId[], seed: string): { shuffled: CardId[]; newSeed: string } { ... }
```

This means matches are fully replayable from initial state + action log. Useful for debugging and replay features (later).

## Hash-based sync verification

Each action produces a state hash (e.g., SHA-256 of canonical JSON). Both clients compute the hash after applying an action and include it in the action log.

If the two clients ever disagree on hashes, sync has broken. The engine detects this and pauses the match with a "sync error" state. Clients can refetch from DB to recover.

## Error types

```typescript
class EngineError extends Error {}
class InvalidActionError extends EngineError {} // Player tried something illegal
class IllegalStateError extends EngineError {} // State is corrupt (a bug)
class SyncError extends EngineError {} // Multi-client desync detected
class TimeoutError extends EngineError {} // Pending choice not resolved in time
```

Mobile app catches these and shows user-friendly messages.

## Performance

Target: action resolution in <50ms client-side for typical actions, <200ms for complex chained effects.

Optimizations to apply if needed:
- Memoize filter evaluation (filter results stable until state changes)
- Index battle_area by instance_id for O(1) lookups
- Lazy-evaluate continuous effect conditions

Don't optimize prematurely. Measure first.

## Manual mode handling

When a card has `manual_mode: true`, its triggered abilities don't enter the action queue normally. Instead, the engine emits a `manual_resolution_required` pending choice with the card's official rules text. Both players see a modal: "Resolve [card name]'s effect manually. Press Confirm when done." When both confirm, processing continues.

This is the escape hatch for cards too complex to auto-encode.

## Versioning

Engine has a semver version. Bump on any change to public API or behavior. Mobile app's `engine_version` is checked against `metadata.engine_min_version`. If app is below min, force user to update.

## Open questions / decisions

- **Public reveal of opponent hand size**: opponent's hand contents are private; size is public. Implementation: `hand` array is filtered for opponent's view (only counts visible).
- **Look-at effects (e.g., search deck)**: send temporary `viewer_state` overlay with revealed cards visible only to that viewer; not persisted in main state.
- **Simultaneous triggers**: per Bandai rules, controller of the active player resolves their triggers first, then non-active player. Implementation: collect triggers, sort by controller, queue in order.

## Implementation prompt template

When you're ready to build the engine, paste this into Claude Code along with this doc, the schema doc, and the vocabulary doc:

> Implement the rules engine in /packages/engine following /docs/08-rules-engine-spec.md. Use Zod schemas from /packages/schema.
>
> Build incrementally:
> 1. State helpers: getInitialState, deck shuffling with seeded RNG, mulligan flow, EX Resource for player 2
> 2. Phase machine: pass_phase action, start/draw/end auto-advance, resource phase 1-card limit
> 3. Action validation: validateAction for each Action type, exhaustive coverage
> 4. Action application: applyAction primary effects (deploy, pair, play command, place resource, etc.)
> 5. Filter evaluator: evaluateFilter(state, filter, context) -> InstanceId[]
> 6. Action queue + pending choices: data structures, processQueue, resolveChoice
> 7. Trigger collection: after each action, find triggered abilities and queue their steps
> 8. Step interpreters: implement each Action type from the vocabulary (draw, deal_damage, modify_stat, etc.)
> 9. Keyword registry: Repair, Blocker, First Strike, High-Maneuver, Breach, Support, Suppression
> 10. Continuous effects: data + getEffectiveAP/HP helpers
> 11. Replacement effects (basic; can expand later)
> 12. Attack subphase state machine: declare → defender action → attacker action → damage → resolution
> 13. Win condition checker
> 14. Manual mode handling
> 15. Hash-based sync verification helpers
>
> Write tests as you go. Each Action type needs unit tests. Each keyword effect needs integration tests showing it works in a real match scenario.
>
> Do NOT implement the mobile UI or networking — that's the next layer. The engine should be runnable from a Node script for testing.
