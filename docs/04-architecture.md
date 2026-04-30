# 04 — Architecture

The big picture. How the pieces fit together. The non-negotiable design decisions.

## The layered model

```
┌─────────────────────────────────────────────────────────────────┐
│                    MOBILE APP (React Native)                     │
│  - Renders UI                                                    │
│  - Handles user input                                            │
│  - Syncs game state via Supabase Realtime                        │
│  - Imports engine and schemas                                    │
└────────────────┬────────────────────────────────┬───────────────┘
                 │                                 │
                 │                                 │
        ┌────────▼─────────┐               ┌───────▼──────────┐
        │     ENGINE        │               │     SUPABASE      │
        │  (TypeScript pkg) │               │   (Postgres +     │
        │                   │               │    Realtime +     │
        │  - State machine  │               │    Auth +         │
        │  - Action queue   │               │    Storage)       │
        │  - Phase logic    │               │                   │
        │  - Effect resolve │               │  Stores:          │
        │  - Filter eval    │               │  - cards          │
        │                   │               │  - decks          │
        │  Imports:         │               │  - matches        │
        │  - schemas        │               │  - users          │
        └────────▲──────────┘               │  - card_images    │
                 │                          └───────▲───────────┘
                 │                                  │
        ┌────────┴──────────┐                       │
        │     SCHEMAS        │                      │
        │   (Zod package)    │                      │
        │                    │                      │
        │  - Card            │                      │
        │  - Effect          │                      │
        │  - Filter          │                      │
        │  - GameState       │                      │
        │  - Action          │                      │
        └────────▲───────────┘                      │
                 │                                  │
                 │                                  │
        ┌────────┴──────────────────────────────────┴──────────┐
        │           ADMIN PORTAL (Next.js)                      │
        │  - Card CRUD                                          │
        │  - Form-based ability builder (generated from schemas)│
        │  - AI auto-fill from rules text                       │
        │  - Sandbox tester (uses engine package)               │
        │  - Trait dictionary, sets, formats                    │
        └────────────────────────────────────────────────────────┘
```

## Why this shape

### Schemas at the bottom

The Zod schemas define what every piece of data looks like — cards, abilities, filters, game state. Everything depends on them. They have no dependencies of their own.

When you change a schema, the type-checker tells you every place upstream that needs to update. This is the entire point.

### Engine sits on schemas

The engine knows nothing about UI, networking, or storage. It's a function: `apply(state, action) → newState`. It validates inputs against schemas, runs the rules, returns new state.

The engine runs identically in:
- The mobile app during a real match (twice, once per device)
- The admin portal sandbox tester
- Automated tests

This is why deterministic engines matter. Same input → same output. Always.

### Mobile app and admin portal are clients of engine + schemas

Both apps import the engine and schemas as packages. Neither has its own copy of game logic. Neither has its own type definitions for cards.

If you find yourself writing rules logic in the mobile app, stop — it belongs in the engine.

If you find yourself writing card type definitions in the admin portal, stop — they belong in the schemas package.

### Supabase is dumb storage + dumb relay

Supabase doesn't run rules. It stores data and broadcasts changes. The flow during a match:

1. Player A taps "Deploy this unit"
2. Mobile app validates the action against the engine: `canDeploy(state, action) === true`
3. Mobile app applies the action locally: `state = apply(state, action)`
4. Mobile app writes the action to Supabase
5. Supabase broadcasts the action to Player B via Realtime
6. Player B's app receives the action
7. Player B's app applies the same action: `state = apply(state, action)`
8. Both apps now have the same state

The engine is deterministic, so step 3 and step 7 produce identical results. This is why we sync *actions* not *state* — actions are small, state is large, and applying actions is the verification.

## The three architectural layers within the engine

This is the hardest part of the system. Get it right and adding cards is trivial.

### Layer 1: Tag-based traits

Every card has a flat `traits: string[]` array. There's no separate concept of "faction" or "team" — they're all just tags. When a card text says "(Zeon) Unit," the engine looks for cards with the tag `zeon`. When it says "(Earth Federation) Pilot," the tag is `earth_federation`. When it says "(White Base Team)," the tag is `white_base_team`.

Pilot link conditions use the same tag system, with an additional convention: pilot names become tags too. So the card "Char Aznable" has the tag `char_aznable`, and a Unit with link condition matching `char_aznable` will link when paired with that pilot.

**Why this matters:** when Bandai prints any new categorization (a new faction, a new mech series, a new pilot archetype), you don't change the engine. You just add a new tag string. Cards that use the new tag work immediately.

See [06-data-schemas.md](06-data-schemas.md) for the full Card schema and [10-card-authoring-playbook.md](10-card-authoring-playbook.md) for how to manage the trait dictionary.

### Layer 2: Filter expression language

A "filter" is a JSON description of which cards/units match some criteria. Filters describe targets ("which unit gets buffed?"), conditions ("if 3+ Zeon units exist..."), and search criteria ("look at top 5 cards for an Amuro Ray pilot").

The filter grammar:

```typescript
type Filter =
  | { side?: 'friendly' | 'enemy' | 'any' }
  | { zone?: 'battle_area' | 'shield_area' | 'hand' | 'deck' | 'trash' | 'resource_area' }
  | { type?: 'unit' | 'pilot' | 'command' | 'base' | 'resource' }
  | { color?: string | string[] }
  | { traits_include?: string[] }       // has ALL of these
  | { traits_any?: string[] }           // has ANY of these
  | { traits_exclude?: string[] }       // has NONE of these
  | { cost?: { op: '=' | '<' | '>' | '<=' | '>='; value: number } }
  | { ap?: { op: '...'; value: number } }
  | { hp?: { op: '...'; value: number } }
  | { has_keyword?: string[] }          // e.g., ['blocker']
  | { is_paired?: boolean }
  | { is_resting?: boolean }
  | { is_damaged?: boolean }
  | { exclude_self?: boolean }
  | { exclude?: string[] }              // exclude specific card ids
  // Combinators:
  | { all_of: Filter[] }                // AND
  | { any_of: Filter[] }                // OR
  | { not: Filter }                     // NOT
```

The engine has one function: `evaluateFilter(state, filter) → Card[]` that returns matching cards. This same function is used everywhere — for choosing targets, counting for conditions, searching decks, finding triggered effects, etc.

**Why this matters:** every "tricky effect" in Gundam decomposes into "find cards matching X, then do Y." If you build the filter language right, the "find" part is solved once and reused forever. New cards rarely require new filter primitives — most just compose existing ones.

See [05-effect-vocabulary.md](05-effect-vocabulary.md) for the complete filter vocabulary.

### Layer 3: Step chains with stored variables

Abilities are sequences of steps. Each step is one action. Steps can:
- Have an optional condition (skipped if false)
- Store their result in a named variable
- Reference earlier stored variables

```typescript
type Ability = {
  id: string;
  trigger: Trigger;
  steps: Step[];
};

type Step = {
  action: Action;
  condition?: Filter | CountCondition | ComparisonCondition;
  store_as?: string;        // for actions that produce results
  // ...action-specific fields
};
```

The engine processes an ability by walking through its steps, checking each step's condition, executing the action (using stored variables for targets), optionally storing the result, and moving to the next.

**Why this matters:** complex card effects almost always have a structure like "do A, then maybe do B, where B might reference what was chosen in A." This structure is exactly what step chains express. Every card I've examined in the Gundam pool fits this model.

See [05-effect-vocabulary.md](05-effect-vocabulary.md) for the complete action vocabulary and step semantics.

## Data flow: authoring a new card

```
Admin opens portal
   ↓
Fills form (or uses AI auto-fill from rules text)
   ↓
Form values validated against Zod schema in real-time
   ↓
"Save Draft" → admin portal generates JSON from form state
   ↓
JSON validated against schema (server-side, in Next.js API route)
   ↓
Inserted into Supabase `cards` table with status = 'draft'
   ↓
Admin clicks "Test in Sandbox"
   ↓
Sandbox loads the card + a dummy opponent
   ↓
Engine package runs the card's ability against test scenarios
   ↓
Results displayed; admin verifies preview matches official text
   ↓
Admin clicks "Publish"
   ↓
Status updated to 'published'
   ↓
Mobile app's next sync pulls the new card
   ↓
Card appears in deck builder and is playable
```

No app release. No code change. Pure data flow.

## Data flow: a player action during a match

```
Player A taps "Attack with this Unit"
   ↓
Mobile app calls engine: canAct(state, { type: 'declare_attack', unit_id, target_id })
   ↓
Engine validates: is it main phase? is unit ready? is target valid? etc.
   ↓
If valid: engine produces newState
   ↓
Mobile app updates local state (Zustand store)
   ↓
UI re-renders to reflect new state
   ↓
Mobile app inserts action into Supabase `match_actions` table
   ↓
Supabase Realtime broadcasts to Player B
   ↓
Player B's app receives the action
   ↓
Player B's app calls engine with the same action
   ↓
Player B's engine produces the same newState
   ↓
Player B's UI re-renders
   ↓
Both clients now have identical state
```

If the actions are deterministic (same input → same output), state stays in sync. Periodic checksums verify this.

## Synchronization model

We sync **actions**, not **state**. State is large; actions are small. As long as both clients start from the same initial state and apply the same sequence of actions, they end up at the same final state.

### Action ordering

Actions are written to a `match_actions` table with monotonically increasing `sequence_number`. The room creator's client is the canonical sequencer — it assigns sequence numbers. The opponent's client receives actions in order and applies them.

When both players can act simultaneously (e.g., during defender response windows), the engine has explicit "priority" states. Only the player with priority can submit an action. The other player's UI is in a "waiting" state.

### Desync detection

Every N actions (or at phase boundaries), each client computes a checksum of its game state and writes it to the match log. If the two clients' checksums differ, we have a desync.

Recovery v1: end the match with an error. Both players see "Desync detected, match invalidated." Crude but safe.

Recovery v2 (later): replay actions from a known-good state.

Desyncs should be vanishingly rare if the engine is truly deterministic. If they're frequent, something is wrong with the engine, not the network.

### Disconnection

If a player disconnects:
- Their client retries Realtime subscription for 30 seconds
- If reconnected: pulls all `match_actions` since last seen sequence number, applies them, resumes
- If not: opponent sees "opponent disconnected" with options: wait, claim win, or void match

### Optimistic UI

Player A's UI updates immediately when they act. They don't wait for the action to round-trip through Supabase. The action is broadcast in the background. If Player B's client rejects the action (shouldn't happen but), the match enters error state.

For v1, this is acceptable. We trust the engine to be deterministic and the network to deliver actions in order.

## What lives in each package

### `packages/schemas`

- All Zod schemas: Card, Pilot, Unit, Command, Base, Effect, Trigger, Filter, Action, GameState, Match, etc.
- Inferred TypeScript types
- Constants: ZONE names, COLOR names, KEYWORD names, etc.
- Trait taxonomy (the canonical list of valid trait strings)

No logic, no I/O, no React. Just data definitions.

### `packages/engine`

- `createInitialState(deckA, deckB, options)` — sets up a new match
- `canAct(state, action)` — validation
- `apply(state, action)` — the core reducer
- `evaluateFilter(state, filter)` — the filter evaluator
- `resolveAbility(state, ability, context)` — the step-chain runner
- Phase machine: start phase, draw phase, etc.
- Action queue / priority system
- Keyword behavior implementations (Repair, Blocker, First Strike, etc.)
- Pure functions only. No side effects. No I/O.

### `apps/mobile`

- All UI screens
- Zustand stores (game state mirror, deck list, user)
- Supabase client setup
- Network sync layer (writes to and subscribes to `match_actions`)
- Imports engine and schemas
- No game logic of its own

### `apps/admin`

- All admin UI: card list, card editor, trait manager, set manager, sandbox tester
- Form generation from Zod schemas
- AI auto-fill API route (server-side, calls Anthropic API)
- Supabase admin client (service role key, server-side only)
- Imports engine (for sandbox) and schemas
- No game logic of its own

## What never lives anywhere

- **Hardcoded card data.** Cards live in the database, not in code.
- **Hardcoded rules.** Rules live in the engine; cards' specific behaviors live in their data.
- **Duplicated types.** Each entity is defined once in `schemas`. If you find yourself redefining `Card` in the mobile app, that's a bug.

## Determinism: the cardinal rule

The engine MUST be deterministic. Same state + same action = same new state. Always.

Sources of non-determinism that will bite you if you're not careful:

- **`Math.random()`** — never use it directly. The engine has a seeded RNG that's part of the game state. When a match starts, both clients agree on a seed (from the room creator), and all randomness flows through the seeded RNG.
- **`Date.now()`** — never use it inside engine functions. Time is passed in as part of the action payload if needed.
- **Iteration order** — when iterating over arrays, use stable sorts. When iterating over objects, sort keys first.
- **Floating point** — avoid in game logic. Use integers for all stats, costs, damage.
- **Async** — engine functions are synchronous. No promises, no callbacks. Pure.

If determinism is broken, syncing breaks. Treat any non-determinism in the engine as a P0 bug.

## Architecture decisions explicitly considered and rejected

### Server-authoritative engine (rejected for v1)

**Pro:** prevents cheating, allows ranked, simpler sync.
**Con:** requires deploying and maintaining a Node.js server, adds latency, increases cost, slower to build.
**Decision:** client-side for v1. Re-evaluate when adding ranked.

### GraphQL (rejected)

**Pro:** flexible queries, type-safe.
**Con:** another moving part, learning curve, overkill for this app.
**Decision:** Supabase's REST + RPC is enough.

### Microservices (rejected)

**Pro:** scalability, separation.
**Con:** massive complexity for solo dev, premature.
**Decision:** monolith Supabase + monorepo apps.

### Separate "rules" data hot-updatable from server (rejected)

**Pro:** could change game rules without app release.
**Con:** rules are too fundamental; making them data makes the engine 10x more complex; YAGNI.
**Decision:** rules live in engine code. Cards override rules per-card via their abilities, which IS data. This matches Bandai's design ("If the text written on a card contradicts the comprehensive rules, the text on the card takes precedence"). New rules = app release.

## Implementation prompt template

When working on architecture-level decisions with an AI tool, paste this with `04-architecture.md`:

```
I'm building a mobile TCG simulator with the architecture described in @04-architecture.md.

The non-negotiables are:
- Schemas are the single source of truth (Zod)
- Engine is pure TypeScript, deterministic, framework-free
- Mobile and admin both import engine + schemas
- Card data is in Supabase, never hardcoded
- Sync via actions, not state

Task: <describe what you want>

Don't propose architectural changes. Work within the existing model.
```
