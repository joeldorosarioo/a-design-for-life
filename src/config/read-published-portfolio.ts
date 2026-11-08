import 'server-only';
import { z } from 'zod';
import { localeSchema, type Locale } from '@/helpers/i18n/locale.schema';
import { readPublicRoot, type PublicRoot } from '@/helpers/payload/public-root';
import { runtimePublication } from '@/helpers/payload/publication-runtime';
import type { Result } from '@/helpers/payload/editorial-result.schema';
import { caseCardDTOSchema } from '@/features/cases';
import { profileDTOSchema } from '@/features/professional-profile';
import { navigationDTOSchema } from '@/features/site-navigation';
import {
  publishedCaseRouteSchema,
  getPublishedCases,
  getFeaturedCases,
  getPublishedCaseRoutes,
} from '@/features/cases/server';
import { getPublishedProfile } from '@/features/professional-profile/server';
import { getPublishedNavigation } from '@/features/site-navigation/server';
export const publishedPortfolioSchema = z.object({
  generation: z.uuid(),
  locale: localeSchema,
  profile: profileDTOSchema,
  navigation: navigationDTOSchema,
  cases: z.array(caseCardDTOSchema),
  featured: z.array(caseCardDTOSchema),
  count: z.number().int().nonnegative(),
  routes: z.array(
    publishedCaseRouteSchema.extend({
      canonical: z.string(),
      alternates: z.object({ pt: z.string().optional(), en: z.string().optional() }),
    }),
  ),
  sitemap: z.array(z.string()),
});
export type PublishedPortfolio = z.infer<typeof publishedPortfolioSchema>;
export async function readPublishedPortfolio(
  locale: Locale,
  generation?: PublicRoot | null,
): Promise<Result<PublishedPortfolio>> {
  try {
    const language = localeSchema.parse(locale);
    const root =
      generation === undefined ? await readPublicRoot(runtimePublication().directory) : generation;
    if (!root) throw new Error('Confirmed portfolio unavailable.');
    const [
      profile,
      navigation,
      cases,
      featured,
      ptRoutes,
      enRoutes,
      ptProfile,
      enProfile,
      ptNavigation,
      enNavigation,
    ] = await Promise.all([
      getPublishedProfile(language, undefined, root),
      getPublishedNavigation(language, undefined, root),
      getPublishedCases(language, root),
      getFeaturedCases(language, root),
      getPublishedCaseRoutes('pt', root),
      getPublishedCaseRoutes('en', root),
      getPublishedProfile('pt', undefined, root),
      getPublishedProfile('en', undefined, root),
      getPublishedNavigation('pt', undefined, root),
      getPublishedNavigation('en', undefined, root),
    ]);
    if (!profile.ok || !navigation.ok || !cases.ok || !featured.ok || !ptRoutes.ok || !enRoutes.ok)
      throw new Error('Confirmed dependencies unavailable.');
    const allRoutes = [...ptRoutes.value, ...enRoutes.value];
    const routes = allRoutes.map((route) => ({
      ...route,
      canonical: route.path,
      alternates: Object.fromEntries(
        allRoutes
          .filter((other) => other.caseId === route.caseId)
          .map((other) => [other.locale, other.path]),
      ),
    }));
    const pagePaths: string[] = [];
    if (ptProfile.ok && ptNavigation.ok) pagePaths.push('/pt', '/pt/cases', '/pt/sobre');
    if (enProfile.ok && enNavigation.ok) pagePaths.push('/en', '/en/cases', '/en/about');
    return {
      ok: true,
      value: publishedPortfolioSchema.parse({
        generation: root.generation,
        locale: language,
        profile: profile.value,
        navigation: navigation.value,
        cases: cases.value,
        featured: featured.value,
        count: cases.value.length,
        routes,
        sitemap: [...new Set([...pagePaths, ...routes.map((route) => route.path)])],
      }),
    };
  } catch {
    return {
      ok: false,
      error: { code: 'unavailable', message: 'Confirmed portfolio unavailable.' },
    };
  }
}
