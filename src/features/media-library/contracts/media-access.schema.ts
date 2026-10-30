import { z } from 'zod';
export const mediaAccessInputSchema = z.object({
  mediaId: z.uuid(),
  variant: z.string().regex(/^(original|w\d+)$/),
  preview: z.boolean(),
});
export const authorizedMediaSchema = z.object({
  bytes: z.custom<Uint8Array>((value) => value instanceof Uint8Array),
  type: z.string(),
});
export type MediaAccessInput = z.infer<typeof mediaAccessInputSchema>;
export type MediaAccessResult =
  | { ok: true; value: z.infer<typeof authorizedMediaSchema> }
  | { ok: false; status: 401 | 404 | 503 };
