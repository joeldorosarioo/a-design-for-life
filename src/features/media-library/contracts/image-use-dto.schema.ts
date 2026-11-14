import { z } from 'zod';
export const imageUseDTOSchema = z.object({
  mediaId: z.uuid(),
  decorative: z.boolean(),
  alt: z.string(),
  caption: z.string().nullable(),
  intrinsicSize: z
    .object({ width: z.number().int().positive(), height: z.number().int().positive() })
    .optional(),
});
export type ImageUseDTO = z.infer<typeof imageUseDTOSchema>;
