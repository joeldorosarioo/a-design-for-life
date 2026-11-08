import { z } from 'zod';
const key = z
  .string()
  .min(1)
  .max(160)
  .regex(/^[a-zA-Z0-9:_-]+$/);
export const readingAnchorSchema = z.strictObject({
  key,
  top: z.number().finite(),
  ancestors: z.array(key).max(32),
});
export type ReadingAnchor = z.infer<typeof readingAnchorSchema>;
