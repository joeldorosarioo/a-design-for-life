import { z } from 'zod';
import { localeSchema } from '@/helpers/i18n/locale.schema';
export const structuralIdentitySchema = z.object({ locale: localeSchema });
