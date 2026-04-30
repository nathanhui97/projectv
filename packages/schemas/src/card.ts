import { z } from 'zod';
import { CardTypeSchema, ColorSchema, RaritySchema, KeywordInstanceSchema } from './primitives';
import { AbilitySchema } from './ability';
import { FilterSchema } from './filter';

export const CardSchema = z.object({
  // Identity
  id: z.string(),                                // e.g. "GD01-042"
  set_code: z.string(),                          // "GD01", "ST01", etc.
  card_number: z.string(),                       // "042", "001A", etc.
  name: z.string(),
  display_name: z.string().optional(),           // Plan B stripped mode

  // Classification
  type: CardTypeSchema,
  color: ColorSchema.optional(),
  rarity: RaritySchema,

  // Stats (presence depends on type)
  cost: z.number().int().nonnegative().optional(),
  level: z.number().int().nonnegative().optional(),
  ap: z.number().int().optional(),
  hp: z.number().int().optional(),

  // Tags
  traits: z.array(z.string()),

  // Pilot link conditions (units only) — each entry is an OR option
  link_conditions: z.array(FilterSchema).optional(),

  // Pilot stat modifiers (pilot cards only)
  pilot_modifiers: z.object({
    ap_mod: z.number().int().optional(),
    hp_mod: z.number().int().optional(),
  }).optional(),

  // Pre-printed keywords
  keywords: z.array(KeywordInstanceSchema).default([]),

  // Abilities
  abilities: z.array(AbilitySchema).default([]),

  // Display
  rules_text: z.string(),
  flavor_text: z.string().optional(),
  art_url: z.string().url().optional(),

  // Authoring metadata
  status: z.enum(['draft', 'published', 'errata', 'banned']),
  format_legality: z.record(z.enum(['legal', 'banned', 'restricted'])).default({}),
  manual_mode: z.boolean().default(false),
  authoring_notes: z.string().optional(),

  // Versioning
  version: z.number().int().positive().default(1),
  previous_version_id: z.string().optional(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
  authored_by: z.string(),
});

export type Card = z.infer<typeof CardSchema>;
