import { z } from 'zod';

export const DeckSchema = z.object({
  id: z.string(),
  user_id: z.string(),
  name: z.string().min(1).max(100),
  format: z.string().default('standard_1v1'),

  // 50-card main deck
  main_deck: z.array(z.object({
    card_id: z.string(),
    count: z.number().int().min(1).max(4),
  })),

  // 10-card resource deck
  resource_deck: z.array(z.object({
    card_id: z.string(),
    count: z.number().int().min(1).max(10),
  })),

  is_valid: z.boolean(),
  validation_errors: z.array(z.string()).default([]),

  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

export type Deck = z.infer<typeof DeckSchema>;
