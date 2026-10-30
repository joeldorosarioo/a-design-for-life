import { z } from 'zod';
import { localeSchema } from '@/helpers/i18n/locale.schema';
import { slugSchema } from './slug.schema';
export const routeResolutionSchema = z.discriminatedUnion('status', [
  z.object({
    status: z.literal(200),
    locale: localeSchema,
    slug: slugSchema,
    case: z.object({ id: z.uuid(), title: z.string().min(1), summary: z.string().min(1) }),
  }),
  z.object({ status: z.literal(308), location: z.string() }),
  z.object({ status: z.literal(404) }),
  z.object({ status: z.literal(410), locale: localeSchema }),
  z.object({ status: z.literal(503), locale: localeSchema }),
]);
export type RouteResolution = z.infer<typeof routeResolutionSchema>;
