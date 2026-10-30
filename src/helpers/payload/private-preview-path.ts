import { z } from 'zod';
import { localeSchema, type Locale } from '@/helpers/i18n/locale.schema';
const scopeSchema = z
  .strictObject({
    locale: localeSchema,
    collection: z.enum(['case-content', 'professional-profiles', 'site-navigation']),
    id: z.uuid().regex(/^[0-9a-f-]+$/),
    page: z.enum(['home', 'about', 'cases', 'case']),
  })
  .refine(
    (scope) =>
      scope.collection === 'case-content' ? scope.page === 'case' : scope.page !== 'case',
    'Private page must match its source collection.',
  );
export type PrivatePreviewScope = z.infer<typeof scopeSchema>;
export type PrivatePreviewPageScope = {
  collection: 'professional-profiles' | 'site-navigation';
  id: string;
};
/** A closed URL constructor, not an authorization capability. */
export function buildPrivatePreviewPath(input: PrivatePreviewScope): string {
  const scope = scopeSchema.parse(input);
  return `/preview-ui/${scope.locale}/${scope.collection}/${scope.id}/${scope.page}`;
}
export function parsePrivatePreviewPath(path: string): PrivatePreviewScope {
  const match =
    /^\/preview-ui\/(pt|en)\/(case-content|professional-profiles|site-navigation)\/([0-9a-f-]{36})\/(home|about|cases|case)$/.exec(
      path,
    );
  if (!match) throw new TypeError('Invalid private preview path.');
  return scopeSchema.parse({
    locale: match[1] as Locale,
    collection: match[2],
    id: match[3],
    page: match[4],
  });
}
