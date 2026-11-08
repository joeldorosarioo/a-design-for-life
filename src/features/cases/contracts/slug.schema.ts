import { z } from 'zod';
export const SLUG_MESSAGE = 'Use letras minúsculas, números e hífens, até 80 caracteres.';
export const slugSchema = z
  .string()
  .min(1, SLUG_MESSAGE)
  .max(80, SLUG_MESSAGE)
  .regex(/^[a-z0-9-]+$/, SLUG_MESSAGE);
export const draftSlugSchema = z.union([z.literal(''), slugSchema]).nullish();
export const reserveCaseRouteSchema = z.object({
  caseId: z.uuid(),
  contentId: z.uuid(),
  locale: z.enum(['pt', 'en']),
  slug: slugSchema,
});
export type ReserveCaseRouteInput = z.infer<typeof reserveCaseRouteSchema>;
