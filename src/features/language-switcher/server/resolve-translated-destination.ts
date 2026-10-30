import 'server-only';
import { localeSchema, type Locale } from '@/helpers/i18n/locale.schema';
import { publicRootSchema, type PublicRoot } from '@/helpers/payload/public-root';
import type { Result } from '@/helpers/payload/editorial-result.schema';
import { getPublishedProfile } from '@/features/professional-profile/server';
import { getPublishedNavigation, resolveNavigation } from '@/features/site-navigation/server';
import { resolveCaseTranslation } from '@/features/cases/server';
import {
  sourcePageSchema,
  type SourcePage,
  type TranslatedDestination,
} from '../contracts/language-control.schema';
export async function resolveTranslatedDestination(input: {
  sourcePage: SourcePage;
  targetLocale: Locale;
  root: PublicRoot;
}): Promise<Result<TranslatedDestination>> {
  const unavailable: Result<TranslatedDestination> = {
    ok: false,
    error: { code: 'unavailable', message: 'Confirmed translation unavailable.' },
  };
  try {
    const sourcePage = sourcePageSchema.parse(input.sourcePage);
    const locale = localeSchema.parse(input.targetLocale);
    const root = publicRootSchema.parse(input.root);
    if (sourcePage.kind === 'case') {
      const result = await resolveCaseTranslation({
        caseId: sourcePage.caseId,
        targetLocale: locale,
        root,
      });
      if (!result.ok) return unavailable;
      if (result.value.kind === 'published')
        return { ok: true, value: { kind: 'equivalent', href: result.value.href } };
    }
    const [profile, navigation] = await Promise.all([
      getPublishedProfile(locale, undefined, root),
      getPublishedNavigation(locale, undefined, root),
    ]);
    if (!profile.ok || !navigation.ok) return unavailable;
    resolveNavigation({ locale, profile: profile.value, navigation: navigation.value });
    const href =
      sourcePage.kind === 'home'
        ? `/${locale}`
        : sourcePage.kind === 'about'
          ? locale === 'pt'
            ? '/pt/sobre'
            : '/en/about'
          : `/${locale}/cases`;
    return {
      ok: true,
      value: { kind: sourcePage.kind === 'case' ? 'case-missing' : 'equivalent', href },
    };
  } catch {
    return unavailable;
  }
}
