import 'server-only';
import { localeSchema, type Locale } from '@/helpers/i18n/locale.schema';
import { profileDTOSchema, type ProfileDTO } from '@/features/professional-profile';
import {
  buildPrivatePreviewPath,
  parsePrivatePreviewPath,
  type PrivatePreviewPageScope,
} from '@/helpers/payload/private-preview-path';
import {
  contextualLinkFieldsSchema,
  type ContextualLink,
} from '../contracts/contextual-link.schema';
export type PreviewContextualLinkInput = {
  locale: Locale;
  profile: ProfileDTO | null;
  pageScope?: PrivatePreviewPageScope;
  routes: readonly { caseId: string; contentId: string; locale: Locale; path: string }[];
};
export function resolvePreviewContextualLink(
  link: ContextualLink,
  context: PreviewContextualLinkInput,
): { href: string; newTab?: boolean } | null {
  try {
    const locale = localeSchema.parse(context.locale);
    const parsed = contextualLinkFieldsSchema.safeParse(link);
    if (!parsed.success) return null;
    const profile = context.profile ? profileDTOSchema.parse(context.profile) : null;
    if (profile && profile.locale !== locale) return null;
    const fields = parsed.data;
    const destination = (href: string) => (fields.newTab ? { href, newTab: true } : { href });
    switch (fields.destination) {
      case 'external':
        return fields.url ? destination(fields.url) : null;
      case 'contact':
        return destination('#contact');
      case 'resume':
        return profile?.resumeId
          ? { href: `/preview-media/${profile.resumeId}/original`, newTab: true }
          : null;
      case 'page':
        return fields.page && context.pageScope
          ? destination(
              buildPrivatePreviewPath({ ...context.pageScope, locale, page: fields.page }),
            )
          : null;
      case 'case': {
        const routes = context.routes.filter(
          (route) => route.caseId === fields.case && route.locale === locale,
        );
        if (routes.length !== 1) return null;
        const route = routes[0];
        const scope = parsePrivatePreviewPath(route.path);
        if (
          scope.locale !== locale ||
          scope.collection !== 'case-content' ||
          scope.page !== 'case' ||
          scope.id !== route.contentId
        )
          return null;
        return destination(route.path);
      }
    }
  } catch {
    return null;
  }
}
