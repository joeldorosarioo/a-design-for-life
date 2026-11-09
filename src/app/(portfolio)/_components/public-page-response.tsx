import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import type { Locale } from '@/helpers/i18n/locale.schema';
import { readPublicPageRequest } from '@/config/public-page-request';
import { buildLocalizedMetadata } from '@/config/build-localized-metadata';
import { LanguageToggle } from '@/features/language-switcher/ui';
import { readingPositionMessage, type SourcePage } from '@/features/language-switcher';
import { resolveTranslatedDestination } from '@/features/language-switcher/server';
import { getPublishedNavigation } from '@/features/site-navigation/server';
import { PublicPageView } from './public-page-view';
import { readServerEnv } from '@/config/server-env';
import { readPublicRuntime } from '@/config/public-runtime';
import { composePublicAnalytics } from '@/features/analytics/server';

type Kind = 'home' | 'cases' | 'about' | 'case';
function matchesExpected(
  snapshot: Awaited<ReturnType<typeof readPublicPageRequest>>,
  locale: string,
  pathname: string,
) {
  return snapshot?.context.locale === locale && snapshot.context.pathname === pathname;
}
async function languageControl(
  snapshot: NonNullable<Awaited<ReturnType<typeof readPublicPageRequest>>>,
  kind: Kind,
) {
  const { context, root, detail, portfolio } = snapshot;
  const sourcePage: SourcePage | null =
    kind === 'case' ? (detail ? { kind, caseId: detail.caseId } : null) : { kind };
  if (!sourcePage) return undefined;
  const locale = context.locale;
  const targetLocale = locale === 'pt' ? 'en' : 'pt';
  const resolved =
    root && context.status === 200
      ? await resolveTranslatedDestination({ sourcePage, targetLocale, root })
      : null;
  const targetNavigation = root
    ? await getPublishedNavigation(targetLocale, undefined, root)
    : null;
  const targetMessages = targetNavigation?.ok ? targetNavigation.value.messages : null;
  return (
    <LanguageToggle
      locale={locale}
      pathname={context.pathname}
      sourcePage={sourcePage}
      status={context.status}
      destination={resolved?.ok ? resolved.value : { kind: 'unavailable' }}
      labels={{
        languageLabel:
          portfolio?.navigation.controls?.languageLabel ??
          (locale === 'pt' ? 'Idioma' : 'Language'),
        caseMissing:
          targetMessages?.translationUnavailable ??
          (targetLocale === 'pt'
            ? 'Este case ainda não está disponível em português.'
            : 'This case is not yet available in English.'),
        readingPositionAdjusted: readingPositionMessage(
          targetLocale,
          targetMessages?.readingPositionAdjusted,
        ),
        failure:
          portfolio?.navigation.messages?.temporaryFailureDescription ??
          (locale === 'pt'
            ? 'Não foi possível trocar o idioma. Tente novamente.'
            : 'Unable to change language. Please try again.'),
      }}
    />
  );
}
export async function renderPublicPage(kind: Kind, locale: string, pathname: string) {
  const snapshot = await readPublicPageRequest();
  if (!matchesExpected(snapshot, locale, pathname) || !snapshot) notFound();
  const page = (
    <PublicPageView
      kind={kind}
      locale={snapshot.context.locale}
      pathname={snapshot.context.pathname}
      portfolio={snapshot.portfolio}
      detail={snapshot.detail}
      status={snapshot.context.status}
      languageControl={await languageControl(snapshot, kind)}
    />
  );
  if (snapshot.context.status !== 200) return page;
  return composePublicAnalytics({
    children: page,
    verifiedPublic: true,
    area: 'public',
    preview: false,
    status: snapshot.context.status,
    context: { locale: snapshot.context.locale, pagePath: snapshot.context.pathname },
    runtime: readPublicRuntime(readServerEnv(process.env)),
  });
}
export async function publicPageMetadata(
  kind: Kind,
  locale: string,
  pathname: string,
): Promise<Metadata> {
  const snapshot = await readPublicPageRequest();
  if (!matchesExpected(snapshot, locale, pathname) || !snapshot)
    return { robots: { index: false, follow: false } };
  const { context, portfolio, detail, origin, indexable } = snapshot;
  const publishedAlternates: Partial<Record<Locale, string>> = {};
  if (kind === 'case' && detail) {
    for (const route of snapshot.routes)
      if (route.caseId === detail.caseId) publishedAlternates[route.locale] = route.path;
  } else if (portfolio) {
    for (const language of ['pt', 'en'] as const) {
      const path =
        kind === 'home'
          ? `/${language}`
          : kind === 'cases'
            ? `/${language}/cases`
            : language === 'pt'
              ? '/pt/sobre'
              : '/en/about';
      if (portfolio.sitemap.includes(path)) publishedAlternates[language] = path;
    }
  }
  return buildLocalizedMetadata({
    locale: context.locale,
    page: kind === 'case' ? { kind, path: pathname } : { kind },
    origin,
    profile: portfolio?.profile ?? null,
    detail,
    publishedAlternates,
    indexable,
    status: context.status,
  });
}
