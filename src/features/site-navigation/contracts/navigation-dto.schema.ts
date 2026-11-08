import { z } from 'zod';
import { localeSchema } from '@/helpers/i18n/locale.schema';
import { profileDTOSchema } from '@/features/professional-profile';
import { footerLabelsSchema, navigationInputSchema } from './navigation.schema';
const label = z.string().nullable();
const projects = z.object({ kind: z.literal('page'), href: z.enum(['/pt/cases', '/en/cases']) });
const about = z.object({ kind: z.literal('page'), href: z.enum(['/pt/sobre', '/en/about']) });
export const navigationDTOSchema = z.object({
  locale: localeSchema,
  brand: z.object({ label, href: z.string().regex(/^\/(pt|en)$/) }),
  items: z.tuple([
    z.object({ purpose: z.literal('projects'), label, destination: projects }),
    z.object({ purpose: z.literal('about'), label, destination: about }),
    z.object({
      purpose: z.literal('resume'),
      label,
      destination: z.object({
        kind: z.literal('resume'),
        mediaId: z.uuid().nullable(),
        newTab: z.literal(true),
      }),
    }),
    z.object({
      purpose: z.literal('contact'),
      label,
      destination: z.object({ kind: z.literal('contact'), anchor: z.literal('#contact') }),
    }),
  ]),
  footer: footerLabelsSchema.nullish(),
  controls: navigationInputSchema.shape.controls,
  messages: navigationInputSchema.shape.messages,
  contacts: profileDTOSchema.shape.contacts,
});
export type NavigationDTO = z.infer<typeof navigationDTOSchema>;
