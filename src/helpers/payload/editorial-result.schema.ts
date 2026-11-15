import { z } from 'zod';
export const editorialFailureSchema = z.object({
  code: z.enum(['invalid-input', 'stale-revision', 'locked', 'forbidden', 'unavailable']),
  message: z.string(),
  fields: z.array(z.object({ path: z.string(), message: z.string() })).optional(),
});
export type EditorialFailure = z.infer<typeof editorialFailureSchema>;
export type Result<T> = { ok: true; value: T } | { ok: false; error: EditorialFailure };
