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
    'during_pair', 'during_link', 'static',
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
    opponent_turn_only: z.boolean().optional(),
  }).optional(),
  cost: z.object({
    rest_self: z.boolean().optional(),
    pay_resources: z.number().int().nonnegative().optional(),
  }).optional(),
});

export type Trigger = z.infer<typeof TriggerSchema>;
