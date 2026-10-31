import { z } from 'zod';
import { localeSchema } from '@/helpers/i18n/locale.schema';
import { resolvedNavigationDTOSchema } from '@/features/site-navigation';
export const caseStatePresentationSchema = z.strictObject({
  locale: localeSchema,
  status: z.union([z.literal(404), z.literal(410), z.literal(503)]),
  title: z.string().refine((value) => value.trim().length > 0),
  description: z.string().nullable(),
  navigation: resolvedNavigationDTOSchema,
});
export type CaseStatePresentation = z.infer<typeof caseStatePresentationSchema>;
