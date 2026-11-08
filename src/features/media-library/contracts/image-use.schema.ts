import { z } from 'zod';
export const imageUseInputSchema = z.strictObject({
  media: z.uuid().nullish(),
  decorative: z.boolean().nullish(),
  alt: z.string().nullish(),
  caption: z.string().nullish(),
});
export type ImageUseInput = z.infer<typeof imageUseInputSchema>;
