import { z } from 'zod';
import { localeSchema } from '@/helpers/i18n/locale.schema';
export const caseIdentitySchema = z.object({ case: z.uuid(), locale: localeSchema });
