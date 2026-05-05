import { z } from 'zod';

export const ColorSchema = z.enum(['blue', 'green', 'red', 'white', 'purple']);
export type Color = z.infer<typeof ColorSchema>;

export const CardTypeSchema = z.enum([
  'unit', 'pilot', 'command', 'base', 'resource', 'token',
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
  'removed_from_game',
]);
export type Zone = z.infer<typeof ZoneSchema>;

export const RaritySchema = z.enum([
  'common', 'uncommon', 'rare', 'super_rare', 'legendary_rare', 'promo',
]);
export type Rarity = z.infer<typeof RaritySchema>;

export const SideSchema = z.enum(['friendly', 'enemy', 'any']);
export type Side = z.infer<typeof SideSchema>;

export const StatSchema = z.enum(['ap', 'hp', 'cost', 'level']);
export type Stat = z.infer<typeof StatSchema>;

export const DurationSchema = z.enum([
  'end_of_turn',
  'end_of_opponent_turn',
  'end_of_battle',
  'until_end_of_phase',
  'permanent',
  'while_paired',
  'while_linked',
  'while_in_zone',
  'until_destroyed',
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
  'suppression',
  // Add new keywords here when introduced by Bandai. Requires app release.
]);
export type Keyword = z.infer<typeof KeywordSchema>;

export const KeywordInstanceSchema = z.object({
  keyword: KeywordSchema,
  amount: z.number().int().nonnegative().optional(),
});
export type KeywordInstance = z.infer<typeof KeywordInstanceSchema>;
