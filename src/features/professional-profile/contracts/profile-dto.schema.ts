import { z } from 'zod';
import { localeSchema } from '@/helpers/i18n/locale.schema';
const text = z.string().nullable();
export const profileDTOSchema = z.object({
  locale: localeSchema,
  identity: z.object({ name: text, role: text }),
  home: z.object({
    eyebrow: text,
    title: text,
    titleEmphasis: text,
    description: text,
    projectsLabel: text,
  }),
  listing: z.object({ eyebrow: text, title: text, description: text }),
  contacts: z.object({ email: text, linkedin: text }),
  resumeId: z.uuid().nullable(),
  seo: z.object({
    homeTitle: text,
    homeDescription: text,
    listingTitle: text,
    listingDescription: text,
    aboutTitle: text,
    aboutDescription: text,
  }),
});
export type ProfileDTO = z.infer<typeof profileDTOSchema>;
