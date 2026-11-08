import { z } from 'zod';
import { profileContactsSchema } from '@/features/professional-profile';
import { navigationDTOSchema } from './navigation-dto.schema';

const requiredLabel = z
  .string()
  .refine((value) => value.trim().length > 0, 'A link label is required');
const contacts = profileContactsSchema.extend({
  email: profileContactsSchema.shape.email
    .unwrap()
    .refine((value) => value.trim().length > 0, 'A public email is required'),
  linkedin: profileContactsSchema.shape.linkedin
    .unwrap()
    .refine((value) => value.trim().length > 0, 'A public LinkedIn contact is required'),
});
export const resolvedNavigationDTOSchema = navigationDTOSchema
  .extend({
    brand: navigationDTOSchema.shape.brand.extend({ label: requiredLabel }),
    items: z.tuple([
      z.object({
        purpose: z.literal('projects'),
        label: requiredLabel,
        destination: z.object({
          kind: z.literal('page'),
          href: z.enum(['/pt/cases', '/en/cases']),
        }),
      }),
      z.object({
        purpose: z.literal('about'),
        label: requiredLabel,
        destination: z.object({
          kind: z.literal('page'),
          href: z.enum(['/pt/sobre', '/en/about']),
        }),
      }),
      z.object({
        purpose: z.literal('resume'),
        label: requiredLabel,
        destination: z.object({
          kind: z.literal('resume'),
          href: z.string().refine((value) => {
            const match = /^\/media\/([^/]+)\/original$/.exec(value);
            return z.uuid().safeParse(match?.[1]).success;
          }, 'A public resume media path is required'),
          newTab: z.literal(true),
        }),
      }),
      z.object({
        purpose: z.literal('contact'),
        label: requiredLabel,
        destination: z.object({ kind: z.literal('contact'), href: z.literal('#contact') }),
      }),
    ]),
    footer: navigationDTOSchema.shape.footer.unwrap().unwrap().extend({
      emailLabel: requiredLabel,
      linkedinLabel: requiredLabel,
      resumeLabel: requiredLabel,
    }),
    controls: navigationDTOSchema.shape.controls.unwrap().unwrap().extend({
      newTabLabel: requiredLabel,
      openMenuLabel: requiredLabel,
      closeMenuLabel: requiredLabel,
      languageLabel: requiredLabel,
    }),
    contacts,
  })
  .superRefine((value, context) => {
    if (
      value.brand.href !== `/${value.locale}` ||
      value.items[0].destination.href !== `/${value.locale}/cases` ||
      value.items[1].destination.href !== (value.locale === 'pt' ? '/pt/sobre' : '/en/about')
    ) {
      context.addIssue({
        code: 'custom',
        message: 'Navigation paths must match the requested locale',
      });
    }
  });

export type ResolvedNavigationDTO = z.infer<typeof resolvedNavigationDTOSchema>;
