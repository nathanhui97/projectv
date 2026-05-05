import { z } from 'zod';

// ─── Card instance ────────────────────────────────────────────────────────────

const TemporaryModifierSchema = z.object({
  source_ability_id: z.string(),
  stat: z.string().optional(),
  amount: z.number().int().optional(),
  keyword: z.string().optional(),
  trait: z.string().optional(),
  duration: z.string(),
});

const CardInstanceSchema = z.object({
  instance_id: z.string(),               // unique to this match
  card_id: z.string(),                   // references CardSchema.id
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

// ─── Player state ─────────────────────────────────────────────────────────────

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
  has_placed_resource_this_turn: z.boolean().default(false),
  abilities_used_this_turn: z.array(z.string()).default([]),
});

// ─── Ability queue entry ──────────────────────────────────────────────────────

const PendingResolutionSchema = z.object({
  ability_id: z.string(),
  source_instance_id: z.string(),
  controller_index: z.number().int().min(0).max(1),
  stored_variables: z.record(z.array(z.string())).default({}),
  next_step_index: z.number().int().nonnegative(),
  waiting_for: z.object({
    type: z.enum(['choice', 'manual_resolve', 'opponent_response']),
    prompt: z.string().optional(),
    step_ref: z.string().optional(),
  }).optional(),
});

// ─── Attack sub-state (null when no attack in progress) ───────────────────────

const AttackTargetSchema = z.union([
  z.object({ kind: z.literal('player') }),
  z.object({ kind: z.literal('unit'),  instance_id: z.string() }),
  z.object({ kind: z.literal('base') }),
]);

const AttackSubstateSchema = z.object({
  attacker_instance_id: z.string(),
  target: AttackTargetSchema,
  blocker_instance_id: z.string().nullable().default(null),
  // declared       → waiting for defender to block or skip
  // defender_action → defender may activate Action abilities / Blocker
  // attacker_action → attacker may activate Action responses
  // damage          → damage is being calculated
  // resolution      → post-damage cleanup (destroyed units, Burst, etc.)
  step: z.enum(['declared', 'defender_action', 'attacker_action', 'damage', 'resolution']),
});

// ─── Action log entry ─────────────────────────────────────────────────────────

const LogEntrySchema = z.object({
  sequence_number: z.number().int().nonnegative(),
  action_type: z.string(),
  controller_index: z.number().int().min(0).max(1),
  summary: z.string(),                  // human-readable one-liner for the game log
});

// ─── Game state ───────────────────────────────────────────────────────────────

export const GameStateSchema = z.object({
  match_id: z.string(),
  rng_seed: z.number().int(),
  rng_counter: z.number().int().default(0),

  players: z.tuple([PlayerStateSchema, PlayerStateSchema]),
  active_player_index: z.number().int().min(0).max(1),
  turn_number: z.number().int().positive().default(1),

  // Phases: mulligan (pre-game setup) → start → draw → resource → main → end
  // Attacks are tracked via attack_substate (sub-state within main phase).
  phase: z.enum(['mulligan', 'start', 'draw', 'resource', 'main', 'end']),

  // Null when no attack is in progress; set during the attack sub-phase.
  attack_substate: AttackSubstateSchema.nullable().default(null),

  priority_player_index: z.number().int().min(0).max(1),
  pending_resolutions: z.array(PendingResolutionSchema).default([]),

  // Turn-scoped flags
  units_attacked_this_turn: z.array(z.string()).default([]),
  abilities_triggered_once_per_turn: z.array(z.string()).default([]),

  // Game log (append-only; used for the UI game log and replay)
  log: z.array(LogEntrySchema).default([]),

  // Outcome
  winner_index: z.number().int().min(0).max(1).optional(),
  ended_at: z.string().datetime().optional(),
  end_reason: z.string().optional(),

  // Sync
  action_sequence_number: z.number().int().nonnegative().default(0),
  state_checksum: z.string().optional(),
});

export type GameState = z.infer<typeof GameStateSchema>;
export type PlayerState = z.infer<typeof PlayerStateSchema>;
export type ZoneState = z.infer<typeof ZoneStateSchema>;
export type CardInstance = z.infer<typeof CardInstanceSchema>;
export type AttackSubstate = z.infer<typeof AttackSubstateSchema>;
export type AttackTarget = z.infer<typeof AttackTargetSchema>;
export type PendingResolution = z.infer<typeof PendingResolutionSchema>;
export type LogEntry = z.infer<typeof LogEntrySchema>;
