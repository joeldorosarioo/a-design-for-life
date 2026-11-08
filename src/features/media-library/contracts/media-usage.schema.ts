import { z } from 'zod';
export const mediaUsageOwnerSchema = z.object({
  collection: z.enum(['case-content', 'site-navigation', 'professional-profiles']),
  documentId: z.uuid(),
  locale: z.enum(['pt', 'en']),
});
export const mediaUsageSchema = mediaUsageOwnerSchema.extend({
  revision: z.uuid(),
  state: z.enum(['draft', 'pending', 'confirmed', 'retained']),
});
export type MediaUsage = z.infer<typeof mediaUsageSchema>;
export const mediaUsageChangeSchema = mediaUsageOwnerSchema.extend({
  revision: z.uuid(),
  state: z.enum(['draft', 'pending', 'confirmed']),
  referenced: z.boolean(),
});
export type MediaUsageChange = z.infer<typeof mediaUsageChangeSchema>;
export const mediaUsageCommandSchema = mediaUsageOwnerSchema.extend({
  revision: z.uuid(),
  state: z.enum(['draft', 'pending', 'confirmed']),
  references: z.array(z.object({ mediaId: z.uuid(), kind: z.enum(['image', 'pdf']) })),
});
export type MediaUsageCommand = z.infer<typeof mediaUsageCommandSchema>;
