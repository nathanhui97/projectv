# 06 — Data Schemas

The Zod schemas are the foundation. Everything else generates from these.

> **Note:** This doc shows the schemas as TypeScript/Zod for clarity, but you (the author) never write JSON or TypeScript when adding cards. The admin portal forms are generated from these schemas. This doc is the contract; the portal is the interface.

## Where schemas live

`packages/schemas/src/` — one file per major entity. Re-exported from `index.ts`.

```
packages/schemas/src/
├── primitives.ts       # Shared enums and small types
├── filter.ts           # Filter expression language
├── condition.ts        # Conditions for steps and triggers
├── trigger.ts          # Triggers
├── action.ts           # Step actions
├── ability.ts          # Composes trigger + steps
├── card.ts             # The Card schema (Unit, Pilot, Command, Base)
├── deck.ts             # Deck and DeckList
├── game-state.ts       # GameState, ZoneState, MatchOptions
├── match-action.ts     # Player actions during a match
├── user.ts             # User profile
└── index.ts            # Re-exports everything
```

---

## Primitives

```typescript
// primitives.ts
import { z } from 'zod';

export const ColorSchema = z.enum(['blue', 'green', 'red', 'white']);
export type Color = z.infer<typeof ColorSchema>;

export const CardTypeSchema = z.enum([
  'unit', 'pilot', 'command', 'base', 'resource', 'token'
]);
export type CardType = z.infer<typeof CardTypeSchema>;

export const ZoneSchema = z.enum([
  'deck',
  'resource_deck',
  'hand',
  'resource_area',
  'battle_area',
  'shield_area',
  'shield_base_section',
  'trash',
  'removed_from_game'
]);
export type Zone = z.infer<typeof ZoneSchema>;

export const RaritySchema = z.enum([
  'common', 'uncommon', 'rare', 'super_rare', 'legendary_rare', 'promo'
]);
export type Rarity = z.infer<typeof RaritySchema>;

export const SideSchema = z.enum(['friendly', 'enemy', 'any']);
export type Side = z.infer<typeof SideSchema>;

export const StatSchema = z.enum(['ap', 'hp', 'cost', 'level']);
export type Stat = z.infer<typeof StatSchema>;

export const DurationSchema = z.enum([
  'end_of_turn',
  'end_of_opponent_turn',
  'until_end_of_phase',
  'permanent',
  'while_paired',
  'while_in_zone'
]);
export type Duration = z.infer<typeof DurationSchema>;

export const ComparisonOpSchema = z.enum(['=', '!=', '<', '>', '<=', '>=']);
export type ComparisonOp = z.infer<typeof ComparisonOpSchema>;

export const KeywordSchema = z.enum([
  'repair',
  'breach',
  'support',
  'blocker',
  'first_strike',
  'high_maneuver',
  'suppression'
  // Add new keywords here when introduced. Requires app release.
]);
export type Keyword = z.infer<typeof KeywordSchema>;

export const KeywordInstanceSchema = z.object({
  keyword: KeywordSchema,
  amount: z.number().int().nonnegative().optional() // for parameterized keywords
});
export type KeywordInstance = z.infer<typeof KeywordInstanceSchema>;
```

---

## Filter

```typescript
// filter.ts
import { z } from 'zod';
import { SideSchema, ZoneSchema, CardTypeSchema, ColorSchema, ComparisonOpSchema, KeywordSchema } from './primitives';

const NumericComparisonSchema = z.object({
  op: ComparisonOpSchema,
  value: z.number().int()
});

// Recursive filter type
export type Filter =
  | { side?: 'friendly' | 'enemy' | 'any' }
  | { zone?: Zone | Zone[] }
  | { type?: CardType | CardType[] }
  | { color?: Color | Color[] }
  | { traits_include?: string[] }
  | { traits_any?: string[] }
  | { traits_exclude?: string[] }
  | { cost?: { op: ComparisonOp; value: number } }
  | { level?: { op: ComparisonOp; value: number } }
  | { ap?: { op: ComparisonOp; value: number } }
  | { hp?: { op: ComparisonOp; value: number } }
  | { has_keyword?: Keyword[] }
  | { has_any_keyword?: Keyword[] }
  | { is_paired?: boolean }
  | { is_linked?: boolean }
  | { is_resting?: boolean }
  | { is_active?: boolean }
  | { is_damaged?: boolean }
  | { name_is?: string }
  | { name_includes?: string }
  | { set_code?: string | string[] }
  | { card_id?: string | string[] }
  | { exclude_self?: boolean }
  | { exclude?: string[] }
  | { all_of: Filter[] }
  | { any_of: Filter[] }
  | { not: Filter };

export const FilterSchema: z.ZodType<Filter> = z.lazy(() =>
  z.union([
    z.object({ side: SideSchema }),
    z.object({ zone: z.union([ZoneSchema, z.array(ZoneSchema)]) }),
    z.object({ type: z.union([CardTypeSchema, z.array(CardTypeSchema)]) }),
    z.object({ color: z.union([ColorSchema, z.array(ColorSchema)]) }),
    z.object({ traits_include: z.array(z.string()) }),
    z.object({ traits_any: z.array(z.string()) }),
    z.object({ traits_exclude: z.array(z.string()) }),
    z.object({ cost: NumericComparisonSchema }),
    z.object({ level: NumericComparisonSchema }),
    z.object({ ap: NumericComparisonSchema }),
    z.object({ hp: NumericComparisonSchema }),
    z.object({ has_keyword: z.array(KeywordSchema) }),
    z.object({ has_any_keyword: z.array(KeywordSchema) }),
    z.object({ is_paired: z.boolean() }),
    z.object({ is_linked: z.boolean() }),
    z.object({ is_resting: z.boolean() }),
    z.object({ is_active: z.boolean() }),
    z.object({ is_damaged: z.boolean() }),
    z.object({ name_is: z.string() }),
    z.object({ name_includes: z.string() }),
    z.object({ set_code: z.union([z.string(), z.array(z.string())]) }),
    z.object({ card_id: z.union([z.string(), z.array(z.string())]) }),
    z.object({ exclude_self: z.boolean() }),
    z.object({ exclude: z.array(z.string()) }),
    z.object({ all_of: z.array(FilterSchema) }),
    z.object({ any_of: z.array(FilterSchema) }),
    z.object({ not: FilterSchema })
  ])
);
```

The recursive structure is what makes the filter language composable. Note that in practice, atomic filters (single fields) are usually wrapped in `all_of` for clarity, even when only one criterion is used.

---

## Condition

```typescript
// condition.ts
import { z } from 'zod';
import { FilterSchema } from './filter';
import { SideSchema, StatSchema, ComparisonOpSchema } from './primitives';

export const ConditionSchema: z.ZodType = z.lazy(() =>
  z.union([
    z.object({
      type: z.literal('count'),
      filter: FilterSchema,
      op: ComparisonOpSchema,
      value: z.number().int()
    }),
    z.object({
      type: z.literal('compare_stat'),
      lhs: z.object({ target: z.string(), stat: StatSchema }),
      rhs: z.union([
        z.number().int(),
        z.object({ target: z.string(), stat: StatSchema })
      ]),
      op: ComparisonOpSchema
    }),
    z.object({ type: z.literal('has_card'), filter: FilterSchema }),
    z.object({ type: z.literal('no_card'), filter: FilterSchema }),
    z.object({ type: z.literal('is_my_turn') }),
    z.object({ type: z.literal('is_opponent_turn') }),
    z.object({
      type: z.literal('phase_is'),
      phase: z.enum(['start', 'draw', 'resource', 'main', 'end'])
    }),
    z.object({
      type: z.literal('resource_count'),
      op: ComparisonOpSchema,
      value: z.number().int(),
      active_only: z.boolean().optional()
    }),
    z.object({
      type: z.literal('hand_size'),
      side: SideSchema,
      op: ComparisonOpSchema,
      value: z.number().int()
    }),
    z.object({
      type: z.literal('deck_size'),
      side: SideSchema,
      op: ComparisonOpSchema,
      value: z.number().int()
    }),
    z.object({
      type: z.literal('shields_remaining'),
      side: SideSchema,
      op: ComparisonOpSchema,
      value: z.number().int()
    }),
    z.object({ type: z.literal('coin_flip') }),
    z.object({
      type: z.literal('dice_roll'),
      sides: z.number().int().positive(),
      op: ComparisonOpSchema,
      value: z.number().int()
    }),
    z.object({
      type: z.literal('controller_chose'),
      step_ref: z.string(),
      value: z.string()
    }),
    z.object({ and: z.array(ConditionSchema) }),
    z.object({ or: z.array(ConditionSchema) }),
    z.object({ not: ConditionSchema })
  ])
);
```

---

## Trigger

```typescript
// trigger.ts
import { z } from 'zod';
import { ZoneSchema } from './primitives';

export const TriggerSchema = z.object({
  type: z.enum([
    // Lifecycle
    'on_deploy', 'on_destroyed', 'on_attack', 'on_attacked',
    'on_damage_dealt', 'on_damage_taken', 'on_burst',
    'on_pair', 'on_unpair', 'on_link_established',
    'on_played_command', 'on_resource_placed',
    'on_shield_destroyed', 'on_card_drawn', 'on_card_discarded',
    // Phase
    'on_start_phase', 'on_draw_phase', 'on_resource_phase',
    'on_main_phase_start', 'on_main_phase_end', 'on_end_phase',
    'on_turn_start', 'on_turn_end',
    'on_opponent_turn_start', 'on_opponent_turn_end',
    // Activated
    'activated_main', 'activated_action',
    // Continuous
    'during_pair', 'during_link', 'static'
  ]),
  qualifiers: z.object({
    pilot_traits_include: z.array(z.string()).optional(),
    pilot_name_is: z.string().optional(),
    target_traits_include: z.array(z.string()).optional(),
    attacker_traits_include: z.array(z.string()).optional(),
    from_zone: ZoneSchema.optional(),
    to_zone: ZoneSchema.optional(),
    once_per_turn: z.boolean().optional(),
    your_turn_only: z.boolean().optional(),
    opponent_turn_only: z.boolean().optional()
  }).optional(),
  cost: z.object({
    rest_self: z.boolean().optional(),
    pay_resources: z.number().int().nonnegative().optional()
  }).optional()
});
export type Trigger = z.infer<typeof TriggerSchema>;
```

---

## Action / Step

The full action vocabulary, expressed as a discriminated union. Each action type has its own field set.

```typescript
// action.ts
import { z } from 'zod';
import { FilterSchema } from './filter';
import { ConditionSchema } from './condition';
import { SideSchema, StatSchema, DurationSchema, KeywordInstanceSchema, ZoneSchema } from './primitives';

const TargetRefSchema = z.union([
  z.string(),                              // "$buff_target" — references stored variable
  z.object({ filter: FilterSchema })       // resolves to all matching at runtime
]);

export const StepSchema: z.ZodType = z.lazy(() => z.union([
  // Targeting
  z.object({
    action: z.literal('choose_target'),
    filter: FilterSchema,
    selector: z.enum(['controller_chooses', 'opponent_chooses', 'random']),
    min: z.number().int().nonnegative(),
    max: z.number().int().positive(),
    store_as: z.string(),
    optional: z.boolean().optional(),
    condition: ConditionSchema.optional()
  }),
  z.object({
    action: z.literal('all_matching'),
    filter: FilterSchema,
    store_as: z.string(),
    condition: ConditionSchema.optional()
  }),
  z.object({
    action: z.literal('search_deck'),
    side: SideSchema,
    filter: FilterSchema,
    count: z.number().int().nonnegative(),
    reveal: z.enum(['public', 'private']),
    store_as: z.string().optional(),
    condition: ConditionSchema.optional()
  }),
  z.object({
    action: z.literal('look_at'),
    target: TargetRefSchema,
    reveal_to: z.enum(['controller', 'opponent', 'all']),
    condition: ConditionSchema.optional()
  }),
  z.object({
    action: z.literal('peek_top'),
    side: SideSchema,
    count: z.number().int().positive(),
    reveal_to: z.enum(['controller', 'opponent', 'all']),
    store_as: z.string().optional(),
    condition: ConditionSchema.optional()
  }),

  // Movement
  z.object({
    action: z.enum([
      'move_to_hand', 'move_to_deck_top', 'move_to_deck_bottom',
      'move_to_trash', 'move_to_resource', 'move_to_shield',
      'discard', 'mill'
    ]),
    target: TargetRefSchema,
    rest_state: z.enum(['active', 'rested']).optional(),
    condition: ConditionSchema.optional()
  }),
  z.object({
    action: z.literal('deploy_unit'),
    target: TargetRefSchema,
    pay_cost: z.boolean().optional(),
    condition: ConditionSchema.optional()
  }),
  z.object({
    action: z.literal('pair_pilot'),
    pilot: TargetRefSchema,
    unit: TargetRefSchema,
    condition: ConditionSchema.optional()
  }),

  // Damage
  z.object({
    action: z.literal('deal_damage'),
    target: TargetRefSchema,
    amount: z.union([z.number().int().nonnegative(), z.string()]), // number or stored ref
    damage_type: z.enum(['effect', 'battle']).default('effect'),
    condition: ConditionSchema.optional()
  }),
  z.object({
    action: z.literal('prevent_damage'),
    target: TargetRefSchema,
    amount: z.number().int().nonnegative(),
    duration: DurationSchema,
    condition: ConditionSchema.optional()
  }),
  z.object({
    action: z.literal('destroy'),
    target: TargetRefSchema,
    condition: ConditionSchema.optional()
  }),
  z.object({
    action: z.literal('heal'),
    target: TargetRefSchema,
    amount: z.union([z.number().int().nonnegative(), z.literal('all')]),
    condition: ConditionSchema.optional()
  }),

  // Stats / abilities
  z.object({
    action: z.literal('modify_stat'),
    target: TargetRefSchema,
    stat: StatSchema,
    amount: z.number().int(),
    duration: DurationSchema,
    condition: ConditionSchema.optional()
  }),
  z.object({
    action: z.literal('set_stat'),
    target: TargetRefSchema,
    stat: StatSchema,
    value: z.number().int(),
    duration: DurationSchema,
    condition: ConditionSchema.optional()
  }),
  z.object({
    action: z.literal('gain_keyword'),
    target: TargetRefSchema,
    keywords: z.array(KeywordInstanceSchema),
    duration: DurationSchema,
    condition: ConditionSchema.optional()
  }),
  z.object({
    action: z.literal('lose_keyword'),
    target: TargetRefSchema,
    keywords: z.array(z.string()), // keyword names only
    duration: DurationSchema,
    condition: ConditionSchema.optional()
  }),
  z.object({
    action: z.literal('gain_traits'),
    target: TargetRefSchema,
    traits: z.array(z.string()),
    duration: DurationSchema,
    condition: ConditionSchema.optional()
  }),
  z.object({
    action: z.literal('copy_abilities'),
    target: TargetRefSchema,
    source: TargetRefSchema,
    duration: DurationSchema,
    condition: ConditionSchema.optional()
  }),

  // State
  z.object({
    action: z.enum(['rest', 'ready']),
    target: TargetRefSchema,
    condition: ConditionSchema.optional()
  }),
  z.object({
    action: z.literal('add_counter'),
    target: TargetRefSchema,
    counter_name: z.string(),
    amount: z.number().int().positive(),
    condition: ConditionSchema.optional()
  }),
  z.object({
    action: z.literal('remove_counter'),
    target: TargetRefSchema,
    counter_name: z.string(),
    amount: z.union([z.number().int().positive(), z.literal('all')]),
    condition: ConditionSchema.optional()
  }),

  // Cards
  z.object({
    action: z.literal('draw'),
    side: SideSchema,
    amount: z.number().int().positive(),
    condition: ConditionSchema.optional()
  }),
  z.object({
    action: z.literal('shuffle'),
    side: SideSchema,
    zone: ZoneSchema,
    condition: ConditionSchema.optional()
  }),
  z.object({
    action: z.literal('reveal'),
    target: TargetRefSchema,
    to: z.enum(['all', 'controller', 'opponent']),
    condition: ConditionSchema.optional()
  }),

  // Tokens
  z.object({
    action: z.literal('create_token'),
    token_id: z.string(),
    count: z.number().int().positive(),
    side: SideSchema,
    zone: ZoneSchema,
    condition: ConditionSchema.optional()
  }),

  // Player choice
  z.object({
    action: z.literal('prompt_choice'),
    prompt: z.string(),
    options: z.array(z.object({
      label: z.string(),
      value: z.string(),
      sub_steps: z.array(StepSchema).optional()
    })),
    store_as: z.string(),
    condition: ConditionSchema.optional()
  }),
  z.object({
    action: z.literal('prompt_yes_no'),
    prompt: z.string(),
    store_as: z.string(),
    on_yes: z.array(StepSchema).optional(),
    on_no: z.array(StepSchema).optional(),
    condition: ConditionSchema.optional()
  }),
  z.object({
    action: z.literal('prompt_number'),
    prompt: z.string(),
    min: z.number().int(),
    max: z.number().int(),
    store_as: z.string(),
    condition: ConditionSchema.optional()
  }),

  // Misc
  z.object({
    action: z.literal('manual_resolve'),
    prompt_text: z.string(),
    condition: ConditionSchema.optional()
  }),
  z.object({
    action: z.literal('noop')
  })
]));

export type Step = z.infer<typeof StepSchema>;
```

---

## Ability

```typescript
// ability.ts
import { z } from 'zod';
import { TriggerSchema } from './trigger';
import { StepSchema } from './action';

export const AbilitySchema = z.object({
  id: z.string(),                                  // unique within the card
  display_text: z.string(),                        // official rules text (display only)
  trigger: TriggerSchema,
  steps: z.array(StepSchema),
  notes: z.string().optional()                     // author notes / caveats
});
export type Ability = z.infer<typeof AbilitySchema>;
```

---

## Card

```typescript
// card.ts
import { z } from 'zod';
import {
  CardTypeSchema, ColorSchema, RaritySchema, KeywordInstanceSchema
} from './primitives';
import { AbilitySchema } from './ability';
import { FilterSchema } from './filter';

export const CardSchema = z.object({
  // Identity
  id: z.string(),                                  // global unique id (e.g., "GD01-042")
  set_code: z.string(),                            // "GD01", "ST01", etc.
  card_number: z.string(),                         // "042", "001A", etc.
  name: z.string(),
  display_name: z.string().optional(),             // for stripped mode (Plan B)

  // Classification
  type: CardTypeSchema,
  color: ColorSchema.optional(),                   // resources, tokens may not have
  rarity: RaritySchema,

  // Stats (presence depends on type)
  cost: z.number().int().nonnegative().optional(),
  level: z.number().int().nonnegative().optional(),
  ap: z.number().int().optional(),
  hp: z.number().int().optional(),

  // Tags
  traits: z.array(z.string()),

  // Pilot link conditions (for units)
  link_conditions: z.array(FilterSchema).optional(),

  // Pilot stat modifiers (for pilot cards)
  pilot_modifiers: z.object({
    ap_mod: z.number().int().optional(),
    hp_mod: z.number().int().optional()
  }).optional(),

  // Pre-printed keywords
  keywords: z.array(KeywordInstanceSchema).default([]),

  // Effects
  abilities: z.array(AbilitySchema).default([]),

  // Display
  rules_text: z.string(),                          // exactly as printed
  flavor_text: z.string().optional(),
  art_url: z.string().url().optional(),

  // Meta
  status: z.enum(['draft', 'published', 'errata', 'banned']),
  format_legality: z.record(z.enum(['legal', 'banned', 'restricted'])).default({}),
  manual_mode: z.boolean().default(false),         // engine can't fully resolve
  authoring_notes: z.string().optional(),

  // Versioning
  version: z.number().int().positive().default(1),
  previous_version_id: z.string().optional(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
  authored_by: z.string()
});
export type Card = z.infer<typeof CardSchema>;
```

---

## Deck

```typescript
// deck.ts
import { z } from 'zod';

export const DeckSchema = z.object({
  id: z.string(),
  user_id: z.string(),
  name: z.string().min(1).max(100),
  format: z.string().default('standard_1v1'),

  // Main deck: 50 cards. Each entry is {card_id, count}.
  main_deck: z.array(z.object({
    card_id: z.string(),
    count: z.number().int().min(1).max(4)
  })),

  // Resource deck: 10 cards.
  resource_deck: z.array(z.object({
    card_id: z.string(),
    count: z.number().int().min(1).max(10)
  })),

  is_valid: z.boolean(),                           // computed at save time
  validation_errors: z.array(z.string()).default([]),

  created_at: z.string().datetime(),
  updated_at: z.string().datetime()
});
export type Deck = z.infer<typeof DeckSchema>;
```

Validation rules for standard 1v1:
- Main deck must equal exactly 50 cards
- Resource deck must equal exactly 10 cards
- Max 4 copies of any card_id (across both decks combined where applicable; check rules)
- All cards must be `format_legality.standard_1v1 === 'legal'` or undefined (default legal)
- Color identity rules if applicable

---

## Game state

The complete state of a match. Engine treats this as the canonical input/output.

```typescript
// game-state.ts
import { z } from 'zod';
import { CardSchema } from './card';

const ZoneStateSchema = z.object({
  cards: z.array(z.object({
    instance_id: z.string(),                       // unique to this match
    card_id: z.string(),                           // references CardSchema.id
    is_resting: z.boolean().default(false),
    is_face_down: z.boolean().default(false),
    damage: z.number().int().nonnegative().default(0),
    counters: z.record(z.number().int()).default({}),
    paired_with_instance_id: z.string().optional(),
    temporary_modifiers: z.array(z.object({
      source_ability_id: z.string(),
      stat: z.string().optional(),
      amount: z.number().int().optional(),
      keyword: z.string().optional(),
      trait: z.string().optional(),
      duration: z.string()
    })).default([])
  }))
});

const PlayerStateSchema = z.object({
  user_id: z.string(),
  display_name: z.string(),
  zones: z.object({
    deck: ZoneStateSchema,
    resource_deck: ZoneStateSchema,
    hand: ZoneStateSchema,
    resource_area: ZoneStateSchema,
    battle_area: ZoneStateSchema,
    shield_area: ZoneStateSchema,
    shield_base_section: ZoneStateSchema,
    trash: ZoneStateSchema,
    removed_from_game: ZoneStateSchema
  }),
  has_redrawn: z.boolean().default(false),
  abilities_used_this_turn: z.array(z.string()).default([])
});

export const GameStateSchema = z.object({
  match_id: z.string(),
  rng_seed: z.number().int(),                       // for deterministic randomness
  rng_counter: z.number().int().default(0),         // monotonic, advances each random call

  players: z.tuple([PlayerStateSchema, PlayerStateSchema]),
  active_player_index: z.number().int().min(0).max(1),
  turn_number: z.number().int().positive().default(1),
  phase: z.enum(['start', 'draw', 'resource', 'main', 'end', 'attack_resolution']),

  // Priority and action stack
  priority_player_index: z.number().int().min(0).max(1),
  pending_resolutions: z.array(z.object({
    ability_id: z.string(),
    source_instance_id: z.string(),
    controller_index: z.number(),
    stored_variables: z.record(z.array(z.string())).default({}),
    next_step_index: z.number().int().nonnegative(),
    waiting_for: z.object({
      type: z.enum(['choice', 'manual_resolve', 'opponent_response']),
      step_ref: z.string().optional()
    }).optional()
  })).default([]),

  // Turn flags
  units_attacked_this_turn: z.array(z.string()).default([]),
  abilities_triggered_once_per_turn: z.array(z.string()).default([]),

  // Outcome
  winner_index: z.number().int().min(0).max(1).optional(),
  ended_at: z.string().datetime().optional(),
  end_reason: z.string().optional(),

  // Sync
  action_sequence_number: z.number().int().nonnegative().default(0),
  state_checksum: z.string().optional()
});
export type GameState = z.infer<typeof GameStateSchema>;
```

---

## Match action

What the engine consumes. Each action represents one player decision.

```typescript
// match-action.ts
import { z } from 'zod';

export const MatchActionSchema = z.object({
  match_id: z.string(),
  sequence_number: z.number().int().nonnegative(),
  controller_index: z.number().int().min(0).max(1),
  type: z.enum([
    'redraw', 'keep_hand',
    'place_resource', 'skip_resource',
    'deploy_unit', 'pair_pilot',
    'play_command', 'deploy_base',
    'attack_player', 'attack_unit', 'attack_base',
    'use_blocker', 'skip_blocker',
    'activate_ability',
    'resolve_choice',                              // response to prompt
    'resolve_manual',                              // ack of manual resolve
    'pass_priority',
    'end_phase', 'end_turn',
    'concede'
  ]),
  payload: z.record(z.unknown()),                  // type-specific
  client_timestamp: z.string().datetime(),
  server_timestamp: z.string().datetime().optional()
});
export type MatchAction = z.infer<typeof MatchActionSchema>;
```

The `payload` shape depends on `type`. For example:
- `deploy_unit`: `{ card_instance_id: string, pay_with: string[] }`
- `attack_unit`: `{ attacker_instance_id: string, target_instance_id: string }`
- `resolve_choice`: `{ resolution_id: string, choice: string | string[] }`

Each type has a sub-schema that's validated at runtime.

---

## User

```typescript
// user.ts
import { z } from 'zod';

export const UserSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  display_name: z.string().min(2).max(40),
  created_at: z.string().datetime(),
  is_admin: z.boolean().default(false)             // for admin portal access
});
export type User = z.infer<typeof UserSchema>;
```

---

## Supabase schema (SQL migrations)

Tables roughly mirror the schemas above. Key tables:

```sql
-- users (managed by Supabase Auth, plus a profiles table)
create table profiles (
  id uuid primary key references auth.users(id),
  display_name text not null,
  is_admin boolean default false,
  created_at timestamptz default now()
);

-- cards (the catalog)
create table cards (
  id text primary key,
  data jsonb not null,                             -- entire CardSchema
  status text not null default 'draft',
  set_code text not null,
  version int not null default 1,
  previous_version_id text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index cards_set_code_idx on cards(set_code);
create index cards_status_idx on cards(status);

-- traits dictionary
create table traits (
  slug text primary key,                           -- "zeon", "earth_federation"
  display_name text not null,                     -- "Zeon", "Earth Federation"
  category text,                                  -- "faction", "team", "pilot_name"
  description text,
  created_at timestamptz default now()
);

-- decks
create table decks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  data jsonb not null,                             -- entire DeckSchema
  is_valid boolean not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index decks_user_id_idx on decks(user_id);

-- matches
create table matches (
  id uuid primary key default gen_random_uuid(),
  room_code text unique not null,
  status text not null,                            -- 'waiting', 'in_progress', 'ended'
  player_a_id uuid references auth.users(id),
  player_b_id uuid references auth.users(id),
  player_a_deck_id uuid references decks(id),
  player_b_deck_id uuid references decks(id),
  winner_index int,
  rng_seed bigint not null,
  initial_state jsonb not null,                    -- starting GameState
  created_at timestamptz default now(),
  ended_at timestamptz
);
create index matches_room_code_idx on matches(room_code);

-- match actions (the action log; engine replays this to reconstruct state)
create table match_actions (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references matches(id),
  sequence_number int not null,
  data jsonb not null,                             -- entire MatchActionSchema
  created_at timestamptz default now(),
  unique(match_id, sequence_number)
);
create index match_actions_match_id_idx on match_actions(match_id, sequence_number);

-- card images stored in Supabase Storage 'card-art' bucket
-- referenced by URL in card data
```

Realtime is enabled on `match_actions` (for sync) and `matches` (for status changes).

Row-level security policies:
- `cards`: anyone can read published; admins can write
- `decks`: users can CRUD their own only
- `matches`: visible to participants
- `match_actions`: insertable by participants of that match, readable by participants

---

## Schema versioning

The schemas evolve. Card data stored in the DB might be on an older schema. Strategy:

- Schemas have a `schema_version` field at the top level of `data` (default 1)
- A migration function converts old → new on read
- Migrations are tested and idempotent
- Major changes bump the version; minor additions are backward-compatible (new optional fields)

Don't over-engineer this in v1. Just include the field and add migrations as needed.

---

## Implementation prompt template

When working on schema-related code with an AI tool:

```
I'm building schemas for a TCG simulator. The full schema spec is in @06-data-schemas.md.

The non-negotiables:
- Zod is the source of truth
- Types are inferred from Zod, never hand-written
- Schemas live in packages/schemas
- Discriminated unions for actions, conditions, filters
- Recursive schemas use z.lazy()

Task: <describe what you want>
```
