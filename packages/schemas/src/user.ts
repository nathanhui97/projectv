import { z } from 'zod';

export const UserSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  display_name: z.string().min(2).max(40),
  created_at: z.string().datetime(),
  is_admin: z.boolean().default(false),
});

export type User = z.infer<typeof UserSchema>;
