import { z } from 'zod';
export const imageUseDTOSchema = z.object({
  mediaId: z.uuid(),
  decorative: z.boolean(),
  alt: z.string(),
  caption: z.string().nullable(),
});
export type ImageUseDTO = z.infer<typeof imageUseDTOSchema>;
