import 'server-only';
import type { Locale } from '@/helpers/i18n/locale.schema';
import type { CaseDetailDTO } from '@/features/cases';
import type { PreviewNavigationPresentationDTO } from '@/features/site-navigation/server';
import type { ProfileDTO } from '@/features/professional-profile';
import {
  buildPrivatePreviewPath,
  type PrivatePreviewPageScope,
} from '@/helpers/payload/private-preview-path';
import { getPreviewProfile } from '@/features/professional-profile/server';
import { getPreviewNavigation, resolvePreviewNavigation } from '@/features/site-navigation/server';
import { getPreviewCase, getPreviewCases } from '@/features/cases/server';
import { authorizePrivatePreviewRequest } from './prepare-private-preview-request';
import type { PortfolioPresentation } from './portfolio-presentation';
import type { PrivatePreviewRequestOptions } from './prepare-private-preview-request';
export type PrivatePageModel = {
  locale: Locale;
  kind: 'home' | 'about' | 'cases' | 'case';
  portfolio: PortfolioPresentation;
  detail?: CaseDetailDTO;
  targets: { home: string; cases: string; about: string };
  navigation: PreviewNavigationPresentationDTO;
  routeContext: {
    locale: Locale;
    profile: ProfileDTO;
    routes: { caseId: string; contentId: string; locale: Locale; path: string }[];
    pageScope: PrivatePreviewPageScope;
  };
};
export type PrivatePageModelResult =
  { ok: true; value: PrivatePageModel } | { ok: false; response: Response };
function unavailable(): PrivatePageModelResult {
  return {
    ok: false,
    response: new Response(null, {
      status: 503,
      headers: {
        'Cache-Control': 'private, no-store, max-age=0',
        'X-Robots-Tag': 'noindex, nofollow',
        'X-Content-Type-Options': 'nosniff',
        'Referrer-Policy': 'no-referrer',
      },
    }),
  };
}
/** Reauthenticate every call; return presentation DTOs without Native context or publication authority. */
export async function readPrivatePageModel(
  request: Request,
  options: PrivatePreviewRequestOptions,
): Promise<PrivatePageModelResult> {
  const authorization = await authorizePrivatePreviewRequest(request, options);
  if (!authorization.ok) return authorization;
  try {
    const {
      scope,
      context: { req },
    } = authorization.value;
    const locale = scope.locale;
    let pageScope: PrivatePreviewPageScope;
    if (scope.collection === 'case-content') {
      // A case ID is never a structural identity. Read only the unique same-locale
      // source ID under this actor, then obtain its DTO through the feature API.
      const sources = await req.payload.find({
        collection: 'professional-profiles',
        where: { locale: { equals: locale } },
        draft: true,
        depth: 0,
        limit: 2,
        overrideAccess: false,
        req,
        select: { id: true, locale: true },
      });
      if (sources.docs.length !== 1 || sources.docs[0].locale !== locale) return unavailable();
      pageScope = { collection: 'professional-profiles', id: sources.docs[0].id };
    } else {
      pageScope = { collection: scope.collection, id: scope.id };
    }
    const profile = await getPreviewProfile(
      locale,
      req,
      pageScope.collection === 'professional-profiles' ? pageScope.id : undefined,
    );
    if (!profile.ok) return unavailable();
    const [navigation, cases, detail] = await Promise.all([
      getPreviewNavigation(
        locale,
        profile.value,
        req,
        scope.collection === 'site-navigation' ? scope.id : undefined,
      ),
      getPreviewCases(locale, req),
      scope.collection === 'case-content' ? getPreviewCase(locale, scope.id, req) : undefined,
    ]);
    if (!navigation.ok || !cases.ok || (detail && !detail.ok)) return unavailable();
    const target = (page: 'home' | 'cases' | 'about') =>
      buildPrivatePreviewPath({ ...pageScope, locale, page });
    return {
      ok: true,
      value: {
        locale,
        kind: scope.page,
        portfolio: {
          locale,
          profile: profile.value,
          navigation: navigation.value,
          cases: cases.value.cases,
          featured: cases.value.featured,
          routes: cases.value.routes.map(({ caseId, locale: language, path }) => ({
            caseId,
            locale: language,
            path,
          })),
        },
        ...(detail?.ok ? { detail: detail.value } : {}),
        targets: { home: target('home'), cases: target('cases'), about: target('about') },
        navigation: resolvePreviewNavigation({
          locale,
          profile: profile.value,
          navigation: navigation.value,
          pageScope,
        }),
        routeContext: { locale, profile: profile.value, routes: cases.value.routes, pageScope },
      },
    };
  } catch {
    return unavailable();
  }
}
