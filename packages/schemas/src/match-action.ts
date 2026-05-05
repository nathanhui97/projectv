import { z } from 'zod';

export const MatchActionSchema = z.object({
  match_id: z.string(),
  sequence_number: z.number().int().nonnegative(),
  controller_index: z.number().int().min(0).max(1),
  type: z.enum([
    'redraw', 'keep_hand',
    'place_resource', 'skip_resource',
    'deploy_card', 'pair_pilot',
    'play_command',
    'attack_player', 'attack_unit', 'attack_base',
    'use_blocker', 'skip_blocker',
    'activate_ability',
    'resolve_choice',
    'resolve_manual',
    'pass_priority',
    'end_phase', 'end_turn',
    'concede',
  ]),
  payload: z.record(z.unknown()),
  client_timestamp: z.string().datetime(),
  server_timestamp: z.string().datetime().optional(),
});

export type MatchAction = z.infer<typeof MatchActionSchema>;
