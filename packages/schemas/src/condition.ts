import { z } from 'zod';
import { FilterSchema } from './filter';
import { SideSchema, StatSchema, ComparisonOpSchema } from './primitives';

export const ConditionSchema: z.ZodType = z.lazy(() =>
  z.union([
    z.object({
      type: z.literal('count'),
      filter: FilterSchema,
      op: ComparisonOpSchema,
      value: z.number().int(),
    }),
    z.object({
      type: z.literal('compare_stat'),
      lhs: z.object({ target: z.string(), stat: StatSchema }),
      rhs: z.union([
        z.number().int(),
        z.object({ target: z.string(), stat: StatSchema }),
      ]),
      op: ComparisonOpSchema,
    }),
    z.object({ type: z.literal('has_card'), filter: FilterSchema }),
    z.object({ type: z.literal('no_card'), filter: FilterSchema }),
    z.object({ type: z.literal('is_my_turn') }),
    z.object({ type: z.literal('is_opponent_turn') }),
    z.object({
      type: z.literal('phase_is'),
      phase: z.enum(['start', 'draw', 'resource', 'main', 'end']),
    }),
    z.object({
      type: z.literal('resource_count'),
      op: ComparisonOpSchema,
      value: z.number().int(),
      active_only: z.boolean().optional(),
    }),
    z.object({
      type: z.literal('hand_size'),
      side: SideSchema,
      op: ComparisonOpSchema,
      value: z.number().int(),
    }),
    z.object({
      type: z.literal('deck_size'),
      side: SideSchema,
      op: ComparisonOpSchema,
      value: z.number().int(),
    }),
    z.object({
      type: z.literal('shields_remaining'),
      side: SideSchema,
      op: ComparisonOpSchema,
      value: z.number().int(),
    }),
    // Player level (resource count)
    z.object({
      type: z.literal('player_level'),
      side: SideSchema,
      op: ComparisonOpSchema,
      value: z.number().int(),
    }),
    // Count cards in a specific zone
    z.object({
      type: z.literal('zone_count'),
      side: SideSchema,
      zone: z.enum(['trash', 'hand', 'deck', 'shield_area']),
      filter: FilterSchema.optional(),
      op: ComparisonOpSchema,
      value: z.number().int(),
    }),
    z.object({ type: z.literal('coin_flip') }),
    z.object({
      type: z.literal('dice_roll'),
      sides: z.number().int().positive(),
      op: ComparisonOpSchema,
      value: z.number().int(),
    }),
    z.object({
      type: z.literal('controller_chose'),
      step_ref: z.string(),
      value: z.string(),
    }),
    z.object({ and: z.array(ConditionSchema) }),
    z.object({ or: z.array(ConditionSchema) }),
    z.object({ not: ConditionSchema }),
  ])
);

export type Condition = z.infer<typeof ConditionSchema>;
