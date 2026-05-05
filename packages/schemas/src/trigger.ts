import { z } from 'zod';
import { ColorSchema, ZoneSchema } from './primitives';

export const TriggerSchema = z.object({
  type: z.enum([
    // ── Lifecycle ──────────────────────────────────────────────────────────────
    'on_deploy', 'on_destroyed',
    'on_burst',
    // Pairing / linking
    'on_pair', 'on_unpair',
    'on_linked',           // link condition becomes satisfied
    'on_link_established', // alias kept for backward compat
    // Attacks
    'on_attack',           // this unit declares an attack
    'on_attacked',         // this unit is declared as defender
    // Damage events on this unit
    'on_receives_damage',
    'on_receives_battle_damage',
    'on_receives_effect_damage',
    // Damage dealt by this unit
    'on_damage_dealt',
    'on_battle_damage_dealt',
    // Battle-result events (your units)
    'on_battle_destroy',   // this unit destroys an enemy via battle damage
    // State-change events on this unit
    'on_rested_by_effect',
    'on_set_active_by_effect',
    // Zone / card-draw events
    'on_card_drawn', 'on_card_discarded',
    'on_resource_placed',
    // Command events
    'on_command_activated',
    'on_played_command',   // alias kept for backward compat
    // Shield events
    'on_shield_destroy',
    'on_shield_destroyed', // alias kept for backward compat
    // Friendly-unit events (triggered by any friendly, not just self)
    'on_friendly_receives_damage',
    'on_friendly_receives_effect_damage',
    'on_friendly_rested_by_opponent_effect',
    // EX Resource mechanic (GD04+)
    'on_ex_resource_placed',
    'on_command_played_with_ex_resource',
    'on_resource_payment_for_unit_effect',

    // ── Phase ──────────────────────────────────────────────────────────────────
    'on_start_phase', 'on_draw_phase', 'on_resource_phase',
    'on_main_phase_start', 'on_main_phase_end', 'on_end_phase',
    'on_turn_start', 'on_turn_end',
    'on_opponent_turn_start', 'on_opponent_turn_end',

    // ── Activated abilities ────────────────────────────────────────────────────
    'activated_main',           // pay cost during Main phase
    'activated_action',         // pay cost as fast/action (either turn)
    'activated_main_or_action', // usable in either slot

    // ── Continuous ────────────────────────────────────────────────────────────
    // Use requires_pair / requires_link qualifier on a normal trigger instead of
    // during_pair / during_link when you mean an event "while paired/linked".
    // Reserve during_pair / during_link for pure continuous effects.
    'during_pair',
    'during_link',
    'static',
  ]),

  qualifiers: z.object({
    // ── Turn / frequency ────────────────────────────────────────────────────
    once_per_turn: z.boolean().optional(),
    your_turn_only: z.boolean().optional(),
    opponent_turn_only: z.boolean().optional(),

    // ── State requirements on the source unit ───────────────────────────────
    requires_pair: z.boolean().optional(), // fires only when source is paired
    requires_link: z.boolean().optional(), // fires only when source is linked

    // ── Attack qualifiers ────────────────────────────────────────────────────
    // For on_attack triggers: constrain what kind of target the attack is against.
    target_is_unit: z.boolean().optional(),   // only fires when attacking a unit
    attacking_player: z.boolean().optional(), // only fires when attacking the player

    // ── Pilot qualifiers (for on_pair, during_pair, etc.) ───────────────────
    pilot_traits_include: z.array(z.string()).optional(),
    pilot_name_is: z.string().optional(),
    pilot_color: ColorSchema.optional(),
    pilot_max_level: z.number().int().nonnegative().optional(),

    // ── Source / unit qualifiers ─────────────────────────────────────────────
    unit_color: ColorSchema.optional(),        // unit must be this color
    source_traits: z.array(z.string()).optional(), // for friendly-event triggers
    source_pilot_traits: z.array(z.string()).optional(),
    not_self: z.boolean().optional(),          // event must come from a different unit

    // ── Command qualifiers ───────────────────────────────────────────────────
    command_traits: z.array(z.string()).optional(),

    // ── Damage qualifiers ────────────────────────────────────────────────────
    from_enemy: z.boolean().optional(),       // damage must come from an enemy source
    battle_damage: z.boolean().optional(),    // must be battle damage (not effect)
    attacker_max_ap: z.number().int().optional(), // for on_receives_battle_damage
    target_traits_include: z.array(z.string()).optional(),
    attacker_traits_include: z.array(z.string()).optional(),

    // ── Zone qualifiers ──────────────────────────────────────────────────────
    from_zone: ZoneSchema.optional(),
    to_zone: ZoneSchema.optional(),
  }).optional(),

  cost: z.object({
    rest_self: z.boolean().optional(),
    pay_resources: z.number().int().nonnegative().optional(),
  }).optional(),
});

export type Trigger = z.infer<typeof TriggerSchema>;
