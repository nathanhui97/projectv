import { z } from 'zod';
import { TriggerSchema } from './trigger';
import { StepSchema } from './action';

export const AbilitySchema = z.object({
  id: z.string(),
  display_text: z.string(),
  trigger: TriggerSchema,
  steps: z.array(StepSchema),
  notes: z.string().optional(),
});

export type Ability = z.infer<typeof AbilitySchema>;
