import { z } from 'zod';
import { FilterSchema } from './filter';
import { ConditionSchema } from './condition';
import { SideSchema, StatSchema, DurationSchema, KeywordInstanceSchema, ZoneSchema, ColorSchema } from './primitives';

const TargetRefSchema = z.union([
  z.string(),                              // "$buff_target" — stored variable reference
  z.object({ filter: FilterSchema }),      // resolves to all matching at runtime
]);

export type TargetRef = z.infer<typeof TargetRefSchema>;

export const StepSchema: z.ZodType = z.lazy(() =>
  z.union([
    // --- Targeting ---
    z.object({
      action: z.literal('choose_target'),
      filter: FilterSchema,
      selector: z.enum(['controller_chooses', 'opponent_chooses', 'random']),
      min: z.number().int().nonnegative(),
      max: z.number().int().positive(),
      store_as: z.string(),
      optional: z.boolean().optional(),
      condition: ConditionSchema.optional(),
    }),
    z.object({
      action: z.literal('all_matching'),
      filter: FilterSchema,
      store_as: z.string(),
      condition: ConditionSchema.optional(),
    }),
    z.object({
      action: z.literal('search_deck'),
      side: SideSchema,
      filter: FilterSchema,
      count: z.number().int().nonnegative(),
      reveal: z.enum(['public', 'private']),
      store_as: z.string().optional(),
      condition: ConditionSchema.optional(),
    }),
    z.object({
      action: z.literal('look_at'),
      target: TargetRefSchema,
      reveal_to: z.enum(['controller', 'opponent', 'all']),
      condition: ConditionSchema.optional(),
    }),
    z.object({
      action: z.literal('peek_top'),
      side: SideSchema,
      count: z.number().int().positive(),
      reveal_to: z.enum(['controller', 'opponent', 'all']),
      store_as: z.string().optional(),
      condition: ConditionSchema.optional(),
    }),

    // --- Card movement ---
    z.object({
      action: z.enum([
        'move_to_hand', 'move_to_deck_top', 'move_to_deck_bottom',
        'move_to_trash', 'move_to_resource', 'move_to_shield',
        'discard', 'mill',
      ]),
      target: TargetRefSchema,
      rest_state: z.enum(['active', 'rested']).optional(),
      condition: ConditionSchema.optional(),
    }),
    z.object({
      action: z.literal('exile'),
      target: TargetRefSchema,
      condition: ConditionSchema.optional(),
    }),
    z.object({
      action: z.literal('discard_from_hand'),
      side: SideSchema,
      amount: z.union([z.number().int().positive(), z.literal('all')]),
      filter: FilterSchema.optional(),
      selector: z.enum(['controller_chooses', 'opponent_chooses', 'random']).optional(),
      condition: ConditionSchema.optional(),
    }),
    z.object({
      action: z.literal('deploy_card'),
      target: TargetRefSchema,
      pay_cost: z.boolean().optional(),
      condition: ConditionSchema.optional(),
    }),
    z.object({
      action: z.literal('pair_pilot'),
      pilot: TargetRefSchema,
      unit: TargetRefSchema,
      condition: ConditionSchema.optional(),
    }),

    // --- Damage and combat ---
    z.object({
      action: z.literal('deal_damage'),
      target: TargetRefSchema,
      amount: z.union([z.number().int().nonnegative(), z.string()]),
      damage_type: z.enum(['effect', 'battle']).default('effect'),
      condition: ConditionSchema.optional(),
    }),
    z.object({
      action: z.literal('prevent_damage'),
      target: TargetRefSchema,
      amount: z.number().int().nonnegative(),
      duration: DurationSchema,
      condition: ConditionSchema.optional(),
    }),
    z.object({
      action: z.literal('destroy'),
      target: TargetRefSchema,
      condition: ConditionSchema.optional(),
    }),
    z.object({
      action: z.literal('heal'),
      target: TargetRefSchema,
      amount: z.union([z.number().int().nonnegative(), z.literal('all')]),
      condition: ConditionSchema.optional(),
    }),

    // --- Stat and ability modification ---
    z.object({
      action: z.literal('modify_stat'),
      target: TargetRefSchema,
      stat: StatSchema,
      amount: z.number().int(),
      duration: DurationSchema,
      condition: ConditionSchema.optional(),
    }),
    z.object({
      action: z.literal('set_stat'),
      target: TargetRefSchema,
      stat: StatSchema,
      value: z.number().int(),
      duration: DurationSchema,
      condition: ConditionSchema.optional(),
    }),
    z.object({
      action: z.literal('gain_keyword'),
      target: TargetRefSchema,
      keywords: z.array(KeywordInstanceSchema),
      duration: DurationSchema,
      condition: ConditionSchema.optional(),
    }),
    z.object({
      action: z.literal('lose_keyword'),
      target: TargetRefSchema,
      keywords: z.array(z.string()),
      duration: DurationSchema,
      condition: ConditionSchema.optional(),
    }),
    z.object({
      action: z.literal('gain_traits'),
      target: TargetRefSchema,
      traits: z.array(z.string()),
      duration: DurationSchema,
      condition: ConditionSchema.optional(),
    }),
    z.object({
      action: z.literal('copy_abilities'),
      target: TargetRefSchema,
      source: TargetRefSchema,
      duration: DurationSchema,
      condition: ConditionSchema.optional(),
    }),

    // --- State changes ---
    z.object({
      action: z.enum(['rest', 'ready']),
      target: TargetRefSchema,
      condition: ConditionSchema.optional(),
    }),
    z.object({
      action: z.literal('prevent_ready'),
      target: TargetRefSchema,
      duration: DurationSchema,
      condition: ConditionSchema.optional(),
    }),
    z.object({
      action: z.literal('grant_taunt'),
      target: TargetRefSchema,
      duration: DurationSchema,
      condition: ConditionSchema.optional(),
    }),
    z.object({
      action: z.literal('change_attack_target'),
      new_target: TargetRefSchema,
      condition: ConditionSchema.optional(),
    }),
    z.object({
      action: z.literal('add_counter'),
      target: TargetRefSchema,
      counter_name: z.string(),
      amount: z.number().int().positive(),
      condition: ConditionSchema.optional(),
    }),
    z.object({
      action: z.literal('remove_counter'),
      target: TargetRefSchema,
      counter_name: z.string(),
      amount: z.union([z.number().int().positive(), z.literal('all')]),
      condition: ConditionSchema.optional(),
    }),

    // --- Cost and resource modification ---
    z.object({
      action: z.literal('modify_cost'),
      target: TargetRefSchema,
      amount: z.number().int(),
      duration: DurationSchema,
      condition: ConditionSchema.optional(),
    }),
    z.object({
      action: z.literal('add_ex_resource'),
      side: SideSchema,
      amount: z.number().int().positive(),
      condition: ConditionSchema.optional(),
    }),

    // --- Zone queries ---
    z.object({
      action: z.literal('count_zone'),
      side: SideSchema,
      zone: ZoneSchema,
      filter: FilterSchema.optional(),
      store_as: z.string(),
      condition: ConditionSchema.optional(),
    }),

    // --- Card draw and deck manipulation ---
    z.object({
      action: z.literal('draw'),
      side: SideSchema,
      amount: z.number().int().positive(),
      condition: ConditionSchema.optional(),
    }),
    z.object({
      action: z.literal('shuffle'),
      side: SideSchema,
      zone: ZoneSchema,
      condition: ConditionSchema.optional(),
    }),
    z.object({
      action: z.literal('reveal'),
      target: TargetRefSchema,
      to: z.enum(['all', 'controller', 'opponent']),
      condition: ConditionSchema.optional(),
    }),

    // --- Tokens ---
    z.object({
      action: z.literal('create_token'),
      // Registry-based token (optional when using inline definition)
      token_id: z.string().optional(),
      // Inline token definition — used when no token_id registry entry exists
      name: z.string().optional(),
      traits: z.array(z.string()).optional(),
      keywords: z.array(KeywordInstanceSchema).optional(),
      ap: z.number().int().nonnegative().optional(),
      hp: z.number().int().nonnegative().optional(),
      color: ColorSchema.optional(),
      // Deployment options
      count: z.number().int().positive().default(1),
      side: SideSchema,
      zone: ZoneSchema.optional(),
      rest_state: z.enum(['active', 'rested']).optional(),
      condition: ConditionSchema.optional(),
    }),

    // --- Player choice (recursive: sub_steps reference StepSchema) ---
    z.object({
      action: z.literal('prompt_choice'),
      prompt: z.string(),
      options: z.array(z.object({
        label: z.string(),
        value: z.string(),
        sub_steps: z.array(StepSchema).optional(),
      })),
      store_as: z.string(),
      condition: ConditionSchema.optional(),
    }),
    z.object({
      action: z.literal('prompt_yes_no'),
      prompt: z.string(),
      store_as: z.string(),
      on_yes: z.array(StepSchema).optional(),
      on_no: z.array(StepSchema).optional(),
      condition: ConditionSchema.optional(),
    }),
    z.object({
      action: z.literal('prompt_number'),
      prompt: z.string(),
      min: z.number().int(),
      max: z.number().int(),
      store_as: z.string(),
      condition: ConditionSchema.optional(),
    }),

    // --- Misc ---
    z.object({
      action: z.literal('manual_resolve'),
      prompt_text: z.string(),
      condition: ConditionSchema.optional(),
    }),
    z.object({
      action: z.literal('noop'),
    }),
  ])
);

export type Step = z.infer<typeof StepSchema>;
