import 'server-only';
import type { Locale } from '@/helpers/i18n/locale.schema';
import type { ProfileDTO } from '@/features/professional-profile';
import {
  contextualLinkFieldsSchema,
  type ContextualLink,
} from '../contracts/contextual-link.schema';
import { slugSchema } from '../contracts/slug.schema';

type LinkContext = {
  locale: Locale;
  routes: readonly { caseId: string; locale: Locale; path: string }[];
  profile: ProfileDTO;
};

export function resolveContextualLink(
  link: ContextualLink,
  context: LinkContext,
): { href: string; newTab?: boolean } | null {
  const parsed = contextualLinkFieldsSchema.safeParse(link);
  if (!parsed.success || context.profile.locale !== context.locale) return null;
  const fields = parsed.data;
  const destination = (href: string) => (fields.newTab ? { href, newTab: true } : { href });
  switch (fields.destination) {
    case 'external':
      return fields.url ? destination(fields.url) : null;
    case 'contact':
      return destination('#contact');
    case 'resume':
      return context.profile.resumeId
        ? { href: `/media/${context.profile.resumeId}/original`, newTab: true }
        : null;
    case 'page':
      if (!fields.page) return null;
      return destination(
        fields.page === 'home'
          ? `/${context.locale}`
          : fields.page === 'cases'
            ? `/${context.locale}/cases`
            : context.locale === 'pt'
              ? '/pt/sobre'
              : '/en/about',
      );
    case 'case': {
      const route = context.routes.find(
        (candidate) => candidate.caseId === fields.case && candidate.locale === context.locale,
      );
      const prefix = `/${context.locale}/cases/`;
      if (
        !route?.path.startsWith(prefix) ||
        !slugSchema.safeParse(route.path.slice(prefix.length)).success
      )
        return null;
      return destination(route.path);
    }
  }
}
