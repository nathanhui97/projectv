# 05 — Effect Vocabulary

The complete primitives the engine understands. This is the most important doc. Get this right and 95% of new cards become "fill out a form, no code change."

## The shape of an ability

Every ability has this shape:

```typescript
{
  id: string,                          // unique within the card
  trigger: Trigger,                    // when does it fire
  steps: Step[],                       // what happens, in order
}
```

Each step has:

```typescript
{
  action: Action,                      // what to do
  condition?: Condition,               // optional gate (skip if false)
  store_as?: string,                   // optional name to save result
  // ...action-specific fields
}
```

Variables stored in earlier steps are referenced as `$variable_name` in later steps.

---

## Triggers

When does an ability fire? These are the trigger types. Each can have qualifiers (sub-conditions on the trigger itself).

### Lifecycle triggers

| Trigger | When | Common Qualifiers |
|---|---|---|
| `on_deploy` | When this card enters battle area | none |
| `on_destroyed` | When this card is destroyed | `by_battle`, `by_effect`, `by_self` |
| `on_attack` | When this unit declares an attack | `target_player`, `target_unit`, `target_base` |
| `on_attacked` | When this unit is targeted by an attack | `attacker_traits` |
| `on_damage_dealt` | When this unit deals damage | `to_player`, `to_unit`, `to_base` |
| `on_damage_taken` | When this unit takes damage | `from_battle`, `from_effect` |
| `on_burst` | When this card's burst trigger fires (shield destroyed) | none |
| `on_pair` | When a pilot is paired with this unit | `pilot_traits`, `pilot_name` |
| `on_unpair` | When a pilot is unpaired from this unit | none |
| `on_link_established` | When pilot pairing satisfies link conditions | none |
| `on_played_command` | When this command card is played | none |
| `on_resource_placed` | When a card is placed in resource area | `by_self_only` |
| `on_shield_destroyed` | When any of your shields is destroyed | `by_attacker_traits` |
| `on_card_drawn` | When a card is drawn | `by_self_only` |
| `on_card_discarded` | When a card is discarded | `from_zone` |

### Phase triggers

| Trigger | When |
|---|---|
| `on_start_phase` | At start of start phase |
| `on_draw_phase` | At start of draw phase |
| `on_resource_phase` | At start of resource phase |
| `on_main_phase_start` | At start of main phase |
| `on_main_phase_end` | At end of main phase |
| `on_end_phase` | At start of end phase |
| `on_turn_start` | At absolute start of turn (before start phase) |
| `on_turn_end` | At absolute end of turn (after end phase) |
| `on_opponent_turn_start` | At start of opponent's turn |
| `on_opponent_turn_end` | At end of opponent's turn |

### Activated triggers (player-initiated)

These don't fire automatically; the player chooses to use them.

| Trigger | When |
|---|---|
| `activated_main` | Player activates during main phase (rest cost typical) |
| `activated_action` | Player activates during action step (response window) |

### Conditional / continuous triggers

| Trigger | When |
|---|---|
| `during_pair` | Continuous: while paired (modifies stats etc.) |
| `during_link` | Continuous: while linked (pilot satisfies link conditions) |
| `static` | Always active (e.g., "all your X units have +1 AP") |

### Trigger qualifiers

Triggers can have additional gates. Common ones:

- `pilot_traits_include: string[]` — pilot must have these traits (for `on_pair`, `during_pair`, etc.)
- `pilot_name_is: string` — pilot must have this exact name
- `target_traits_include: string[]` — target of the action must have these traits
- `attacker_traits_include: string[]` — attacker must have these traits
- `from_zone: Zone` — source zone for "moved" triggers
- `to_zone: Zone` — destination zone for "moved" triggers
- `once_per_turn: boolean` — fires at most once per turn
- `your_turn_only: boolean` — only on your turn
- `opponent_turn_only: boolean` — only on opponent's turn

---

## Filters

The filter expression language. Used for targets, conditions, and counts. See [04-architecture.md § Layer 2](04-architecture.md) for the rationale.

### Atomic filters

| Filter | Description |
|---|---|
| `side: 'friendly' \| 'enemy' \| 'any'` | Whose cards |
| `zone: Zone` | Which zone |
| `type: CardType` | unit / pilot / command / base / resource |
| `color: Color \| Color[]` | Card color(s) |
| `traits_include: string[]` | Has ALL of these traits |
| `traits_any: string[]` | Has ANY of these traits |
| `traits_exclude: string[]` | Has NONE of these traits |
| `cost: { op, value }` | Cost comparison: `=`, `<`, `>`, `<=`, `>=`, `!=` |
| `level: { op, value }` | Level comparison |
| `ap: { op, value }` | AP comparison (for units) |
| `hp: { op, value }` | HP comparison (for units) |
| `has_keyword: string[]` | Has ALL of these keywords (Repair, Blocker, etc.) |
| `has_any_keyword: string[]` | Has ANY of these keywords |
| `is_paired: boolean` | Has a pilot paired (units only) |
| `is_linked: boolean` | Pilot satisfies link conditions |
| `is_resting: boolean` | Card is rested |
| `is_active: boolean` | Card is active (not rested) |
| `is_damaged: boolean` | Has any damage counters |
| `name_is: string` | Exact name match |
| `name_includes: string` | Name contains substring |
| `set_code: string \| string[]` | From specific set(s) |
| `card_id: string \| string[]` | Specific card id(s) |
| `exclude_self: boolean` | Exclude the source of the ability |
| `exclude: string[]` | Exclude specific card instance ids |

### Combinators

| Combinator | Description |
|---|---|
| `all_of: Filter[]` | AND — must match every sub-filter |
| `any_of: Filter[]` | OR — must match at least one |
| `not: Filter` | NOT — must not match |

### Examples

"1 friendly Zeon Unit, excluding self":
```json
{
  "all_of": [
    { "side": "friendly" },
    { "zone": "battle_area" },
    { "type": "unit" },
    { "traits_include": ["zeon"] },
    { "exclude_self": true }
  ]
}
```

"Any Earth Federation OR Neo Zeon Unit":
```json
{
  "all_of": [
    { "type": "unit" },
    { "any_of": [
      { "traits_include": ["earth_federation"] },
      { "traits_include": ["neo_zeon"] }
    ]}
  ]
}
```

"Cards in trash with cost ≤ 3":
```json
{
  "all_of": [
    { "zone": "trash" },
    { "cost": { "op": "<=", "value": 3 } }
  ]
}
```

---

## Conditions

A condition gates a step (skip step if false) or qualifies a trigger.

### Condition types

| Condition Type | Description | Fields |
|---|---|---|
| `count` | Count cards matching a filter, compare | `filter`, `op`, `value` |
| `compare_stat` | Compare two stats | `lhs`, `rhs`, `op` |
| `has_card` | Filter matches at least one card | `filter` |
| `no_card` | Filter matches zero cards | `filter` |
| `is_my_turn` | True if it's the source's controller's turn | none |
| `is_opponent_turn` | True if it's the opponent's turn | none |
| `phase_is` | Currently in a specific phase | `phase` |
| `resource_count` | Resource area count comparison | `op`, `value`, `active_only?` |
| `hand_size` | Hand size comparison | `side`, `op`, `value` |
| `deck_size` | Deck size comparison | `side`, `op`, `value` |
| `shields_remaining` | Shield count comparison | `side`, `op`, `value` |
| `coin_flip` | Random 50/50 (uses seeded RNG) | none |
| `dice_roll` | Random N-sided die | `sides`, `op`, `value` |
| `controller_chose` | A previous step's controller choice was X | `step_ref`, `value` |

### Combinators

| Combinator | Description |
|---|---|
| `and: Condition[]` | All conditions true |
| `or: Condition[]` | At least one true |
| `not: Condition` | Negation |

### Examples

"If you have 3+ Zeon Units in battle area":
```json
{
  "type": "count",
  "filter": { "all_of": [
    { "side": "friendly" },
    { "zone": "battle_area" },
    { "type": "unit" },
    { "traits_include": ["zeon"] }
  ]},
  "op": ">=",
  "value": 3
}
```

"If your shield area has 2 or fewer shields":
```json
{
  "type": "shields_remaining",
  "side": "friendly",
  "op": "<=",
  "value": 2
}
```

---

## Actions

What a step does. The vocabulary is intentionally broad — better to have an unused action type than a missing one.

### Targeting actions (produce results, often `store_as`)

| Action | Description | Key Fields |
|---|---|---|
| `choose_target` | Player picks N cards matching filter | `filter`, `min`, `max`, `selector` |
| `random_target` | Engine picks N random cards | `filter`, `count` |
| `all_matching` | Selects all cards matching filter | `filter` |
| `select_top_of_deck` | Top N cards of a deck | `side`, `count`, `reveal_to` |
| `search_deck` | Player searches deck for matching cards | `filter`, `count`, `reveal: 'public' \| 'private'` |
| `look_at` | Look at hidden cards (no selection) | `filter`, `reveal_to` |

`selector` options for `choose_target`: `controller_chooses`, `opponent_chooses`, `random` (deterministic via seed).

### Card movement actions

| Action | Description |
|---|---|
| `deploy_unit` | Place a unit card into battle area |
| `pair_pilot` | Pair a pilot with a unit |
| `unpair_pilot` | Remove pairing |
| `move_to_hand` | Move targets to controller's/opponent's hand |
| `move_to_deck_top` | Move to top of deck |
| `move_to_deck_bottom` | Move to bottom of deck |
| `move_to_trash` | Move to trash |
| `move_to_resource` | Move to resource area (active or rested) |
| `move_to_shield` | Move to shield area |
| `discard` | Discard from hand |
| `mill` | Move from top of deck to trash |

Each takes a `target` (filter or stored variable).

### Damage and combat

| Action | Description |
|---|---|
| `deal_damage` | Deal damage to a target | `target`, `amount`, `damage_type: 'effect' \| 'battle'` |
| `prevent_damage` | Prevent next N damage to target | `target`, `amount`, `duration` |
| `destroy` | Destroy a card | `target` (skips damage, just removes) |
| `heal` | Remove damage counters | `target`, `amount` |

### Stat and ability modification

| Action | Description |
|---|---|
| `modify_stat` | +/- to AP, HP, or cost | `target`, `stat`, `amount`, `duration` |
| `set_stat` | Force a stat to a specific value | `target`, `stat`, `value`, `duration` |
| `gain_keyword` | Add keyword(s) to target | `target`, `keywords[]`, `duration` |
| `lose_keyword` | Remove keyword(s) from target | `target`, `keywords[]`, `duration` |
| `gain_traits` | Add traits to target | `target`, `traits[]`, `duration` |
| `gain_ability` | Add a full ability to target | `target`, `ability`, `duration` |
| `copy_abilities` | Target gains another card's abilities | `target`, `source`, `duration` |

`duration` options: `end_of_turn`, `end_of_opponent_turn`, `until_end_of_phase`, `permanent`, `while_paired`, `while_in_zone`.

### State changes

| Action | Description |
|---|---|
| `rest` | Rest target(s) |
| `ready` | Ready (un-rest) target(s) |
| `tap_for_resource` | Use a resource to pay |
| `add_counter` | Add a custom counter to target | `target`, `counter_name`, `amount` |
| `remove_counter` | Remove counter | `target`, `counter_name`, `amount` |

### Card draw and deck manipulation

| Action | Description |
|---|---|
| `draw` | Draw N cards | `side`, `amount` |
| `shuffle` | Shuffle a zone | `side`, `zone` |
| `reveal` | Reveal cards | `target`, `to: 'all' \| 'controller' \| 'opponent'` |
| `peek_top` | Look at top N | `side`, `count`, `reveal_to` |

### Token and misc

| Action | Description |
|---|---|
| `create_token` | Create a token unit/base | `token_type`, `count`, `zone` |
| `remove_from_game` | Remove from game (rare in Gundam) | `target` |
| `change_controller` | Switch control of a card | `target` (rare) |
| `controller_chooses_one` | Branch: player picks one of N options | `options: { label, steps }[]` |
| `noop` | Does nothing (for placeholders) | none |
| `manual_resolve` | Pause game, both players resolve manually | `prompt_text` |

### Player choice (decision points)

| Action | Description |
|---|---|
| `prompt_choice` | Ask controller to pick from labeled options | `prompt`, `options[]` |
| `prompt_yes_no` | Yes/no question | `prompt` |
| `prompt_number` | Pick a number in range | `prompt`, `min`, `max` |

Stored result is referenced in subsequent step conditions.

---

## Keywords

Keyword effects are pre-defined behaviors a card can have. They're enumerated in code (engine package) but applied to cards via the `keywords: string[]` field on a card or via the `gain_keyword` action.

### Currently defined keywords

Based on the official rule set:

| Keyword | Semantics |
|---|---|
| `repair` | At end of your turn, recover X damage. Multiple Repair instances stack. |
| `breach` | When this unit destroys an enemy unit, deal X damage to opponent's shield area. |
| `support` | Rest this unit; another friendly unit gets +X AP this turn. (Activated, main phase.) |
| `blocker` | Rest this unit to redirect an attack to it. (Triggered, action step.) |
| `first_strike` | Deals battle damage before normal damage step. |
| `high_maneuver` | Can't be blocked. |
| `suppression` | When this unit attacks, opponent rests N units. |

Each keyword has an integer parameter where applicable (e.g., `repair: 2`, `support: 1`). Stored as `{ keyword: 'repair', amount: 2 }` on the card or `{ keywords: [{ keyword: 'repair', amount: 2 }], duration: 'end_of_turn' }` for the `gain_keyword` action.

### Adding new keywords

When Bandai introduces a new keyword (it happens):

1. Implement the behavior in `packages/engine/src/keywords/<name>.ts`
2. Register it in the keyword registry
3. Add it to the `KEYWORDS` constant in schemas
4. Update admin portal dropdowns automatically (since they read from schemas)
5. Ship as an app update — this is one of the few things that requires a release

---

## Zones

The locations cards can be in. Engine knows these.

| Zone | Description |
|---|---|
| `deck` | Main deck (face-down) |
| `resource_deck` | Resource deck (face-down) |
| `hand` | Player's hand (private) |
| `resource_area` | Played resources (active / rested) |
| `battle_area` | Active units |
| `shield_area` | Shields (face-down) and base section |
| `shield_base_section` | Subset of shield area for the Base |
| `trash` | Discard pile |
| `removed_from_game` | Rare; specific cards |

---

## Card types

| Type | Description |
|---|---|
| `unit` | Mobile suits, etc. Lives in battle_area. Has AP/HP. |
| `pilot` | Lives only when paired with a unit. Modifies the unit. |
| `command` | One-shot effect. Resolves and goes to trash. May also be a Pilot if it has the [Pilot] keyword. |
| `base` | Lives in shield_base_section. Defends. Has HP. |
| `resource` | Lives in resource_deck and resource_area. Pays costs. |
| `token` | Engine-generated cards (EX Base, EX Resource, custom tokens). |

---

## Colors

| Color | Pronunciation in card text |
|---|---|
| `blue` | Blue |
| `green` | Green |
| `red` | Red |
| `white` | White |

(Confirm against latest sets — colors are fixed at 4.)

---

## A complete worked example

Card: hypothetical Zaku-like unit with the ability:

> 【When Paired・(Zeon) Pilot】 Choose 1 other friendly (Zeon) Unit. It gets AP+2 during this turn. Then, if you have 3 or more (Zeon) Units in the battle area, draw 1.

Encoded:

```json
{
  "id": "abil_zeon_buff_draw",
  "trigger": {
    "type": "on_pair",
    "qualifiers": {
      "pilot_traits_include": ["zeon"]
    }
  },
  "steps": [
    {
      "action": "choose_target",
      "filter": {
        "all_of": [
          { "side": "friendly" },
          { "zone": "battle_area" },
          { "type": "unit" },
          { "traits_include": ["zeon"] },
          { "exclude_self": true }
        ]
      },
      "selector": "controller_chooses",
      "min": 1, "max": 1,
      "store_as": "buff_target"
    },
    {
      "action": "modify_stat",
      "target": "$buff_target",
      "stat": "ap",
      "amount": 2,
      "duration": "end_of_turn"
    },
    {
      "action": "draw",
      "side": "friendly",
      "amount": 1,
      "condition": {
        "type": "count",
        "filter": {
          "all_of": [
            { "side": "friendly" },
            { "zone": "battle_area" },
            { "type": "unit" },
            { "traits_include": ["zeon"] }
          ]
        },
        "op": ">=",
        "value": 3
      }
    }
  ]
}
```

The admin portal generates this from form input. The author never sees the JSON.

---

## Vocabulary expansion playbook

When a new card needs a primitive that doesn't exist:

1. **Stop and assess.** Is this truly novel, or can it be expressed with existing primitives?
2. **If novel:** open a "vocabulary expansion" issue. Document the card and the missing primitive.
3. **For the card itself:** mark as `manual_mode: true` so it ships in a playable state via manual resolution.
4. **Add the primitive:** to schemas, then to engine, then to admin portal dropdowns.
5. **Update this doc.**
6. **Re-author the card** properly. Remove `manual_mode` flag.
7. **Ship as an app release.**

Expected frequency: every 1–2 booster sets, maybe one new primitive needed. By v1.5, the vocabulary should be saturated.

---

## Initial vocabulary completeness check

Before shipping v1, verify by:

1. Going through all cards in ST01–GD03 (manually or with AI assist)
2. For each card with an ability, confirm it can be expressed with the above primitives
3. Mark any that can't, with a description
4. Decide: extend vocabulary now, or use manual mode for those cards

This is a 4–8 hour job and the most valuable QA work you'll do before launch.
