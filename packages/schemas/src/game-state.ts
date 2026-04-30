import { z } from 'zod';

const TemporaryModifierSchema = z.object({
  source_ability_id: z.string(),
  stat: z.string().optional(),
  amount: z.number().int().optional(),
  keyword: z.string().optional(),
  trait: z.string().optional(),
  duration: z.string(),
});

const CardInstanceSchema = z.object({
  instance_id: z.string(),                    // unique to this match
  card_id: z.string(),                        // references CardSchema.id
  is_resting: z.boolean().default(false),
  is_face_down: z.boolean().default(false),
  damage: z.number().int().nonnegative().default(0),
  counters: z.record(z.number().int()).default({}),
  paired_with_instance_id: z.string().optional(),
  temporary_modifiers: z.array(TemporaryModifierSchema).default([]),
});

const ZoneStateSchema = z.object({
  cards: z.array(CardInstanceSchema),
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
    removed_from_game: ZoneStateSchema,
  }),
  has_redrawn: z.boolean().default(false),
  abilities_used_this_turn: z.array(z.string()).default([]),
});

const PendingResolutionSchema = z.object({
  ability_id: z.string(),
  source_instance_id: z.string(),
  controller_index: z.number().int().min(0).max(1),
  stored_variables: z.record(z.array(z.string())).default({}),
  next_step_index: z.number().int().nonnegative(),
  waiting_for: z.object({
    type: z.enum(['choice', 'manual_resolve', 'opponent_response']),
    step_ref: z.string().optional(),
  }).optional(),
});

export const GameStateSchema = z.object({
  match_id: z.string(),
  rng_seed: z.number().int(),
  rng_counter: z.number().int().default(0),

  players: z.tuple([PlayerStateSchema, PlayerStateSchema]),
  active_player_index: z.number().int().min(0).max(1),
  turn_number: z.number().int().positive().default(1),
  phase: z.enum(['start', 'draw', 'resource', 'main', 'end', 'attack_resolution']),

  priority_player_index: z.number().int().min(0).max(1),
  pending_resolutions: z.array(PendingResolutionSchema).default([]),

  units_attacked_this_turn: z.array(z.string()).default([]),
  abilities_triggered_once_per_turn: z.array(z.string()).default([]),

  winner_index: z.number().int().min(0).max(1).optional(),
  ended_at: z.string().datetime().optional(),
  end_reason: z.string().optional(),

  action_sequence_number: z.number().int().nonnegative().default(0),
  state_checksum: z.string().optional(),
});

export type GameState = z.infer<typeof GameStateSchema>;
export type PlayerState = z.infer<typeof PlayerStateSchema>;
export type ZoneState = z.infer<typeof ZoneStateSchema>;
export type CardInstance = z.infer<typeof CardInstanceSchema>;
