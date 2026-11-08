import { z } from 'zod';
import { parsePrivatePreviewPath } from '@/helpers/payload/private-preview-path';
import { resolvedNavigationDTOSchema } from './resolved-navigation-dto.schema';
const label = z.string().refine((value) => value.trim().length > 0, 'A link label is required');
function pagePath(page: 'home' | 'about' | 'cases') {
  return z.string().refine((path) => {
    try {
      const scope = parsePrivatePreviewPath(path);
      return scope.collection !== 'case-content' && scope.page === page;
    } catch {
      return false;
    }
  }, 'Invalid private navigation destination');
}
const base = resolvedNavigationDTOSchema.shape;
export const previewNavigationPresentationDTOSchema = z
  .strictObject({
    ...base,
    brand: z.strictObject({ ...base.brand.shape, href: pagePath('home') }),
    items: z.tuple([
      z.strictObject({
        purpose: z.literal('projects'),
        label,
        destination: z.strictObject({ kind: z.literal('page'), href: pagePath('cases') }),
      }),
      z.strictObject({
        purpose: z.literal('about'),
        label,
        destination: z.strictObject({ kind: z.literal('page'), href: pagePath('about') }),
      }),
      z.strictObject({
        purpose: z.literal('resume'),
        label,
        destination: z.strictObject({
          kind: z.literal('resume'),
          href: z
            .string()
            .regex(/^\/preview-media\/[a-f0-9-]{36}\/original$/)
            .refine((path) => z.uuid().safeParse(path.split('/')[2]).success),
          newTab: z.literal(true),
        }),
      }),
      z.strictObject({
        purpose: z.literal('contact'),
        label,
        destination: z.strictObject({ kind: z.literal('contact'), href: z.literal('#contact') }),
      }),
    ]),
  })
  .refine((value) => {
    try {
      const targets = [
        parsePrivatePreviewPath(value.brand.href),
        parsePrivatePreviewPath(value.items[0].destination.href),
        parsePrivatePreviewPath(value.items[1].destination.href),
      ];
      return targets.every(
        (target) =>
          target.locale === value.locale &&
          target.collection === targets[0].collection &&
          target.id === targets[0].id,
      );
    } catch {
      return false;
    }
  }, 'Private navigation destinations must share their locale and source scope.');
export type PreviewNavigationPresentationDTO = z.infer<
  typeof previewNavigationPresentationDTOSchema
>;
