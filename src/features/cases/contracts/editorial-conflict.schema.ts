import { z } from 'zod';
export const caseEditorialConflictSchema = z.object({
  code: z.enum(['translation-conflict', 'slug-conflict']),
  field: z.enum(['locale', 'slug']),
  message: z.string().min(1),
});
export type CaseEditorialConflict = z.infer<typeof caseEditorialConflictSchema>;
