import 'server-only';
import { buildPublicSitemap, renderPublicSitemap } from './build-public-index';
import { z } from 'zod';
import { getPublishedCaseRoutes, publishedCaseRouteSchema } from '@/features/cases/server';
import { getPublishedProfile } from '@/features/professional-profile/server';
import { getPublishedNavigation, resolveNavigation } from '@/features/site-navigation/server';
import { localeSchema, type Locale } from '@/helpers/i18n/locale.schema';
import { publicRootSchema, type PublicRoot } from '@/helpers/payload/public-root';
import { publishedReadStatus } from '@/helpers/payload/published-read-response';
import { runtimePayload } from '@/helpers/payload/runtime';
import type { Result } from '@/helpers/payload/editorial-result.schema';

export type PublishedCaseRoute = z.infer<typeof publishedCaseRouteSchema>;
export type PublicIndex = {
  pages: Record<Locale, boolean>;
  cases: PublishedCaseRoute[];
};

function structuralCoverage(root: PublicRoot) {
  const coverage = {
    profile: new Set<Locale>(),
    navigation: new Set<Locale>(),
  };
  for (const [key, subject] of Object.entries(root.subjects)) {
    const prefix = key.startsWith('professional-profiles/')
      ? 'professional-profiles/'
      : key.startsWith('site-navigation/')
        ? 'site-navigation/'
        : null;
    if (!prefix) continue;
    z.uuid().parse(key.slice(prefix.length));
    const kind = prefix === 'professional-profiles/' ? 'profile' : 'navigation';
    // Validate public envelopes, never Native bodies or a live content fallback.
    // Each feature getter owns the complete confirmed-body contract.
    const envelope = z.object({ kind: z.literal(kind), locale: localeSchema }).parse(subject.value);
    if (coverage[kind].has(envelope.locale))
      throw new Error('Duplicate confirmed structural owner.');
    coverage[kind].add(envelope.locale);
  }
  return coverage;
}

/** The caller captures Root once. This operation never reselects current. */
export async function readPublicIndex(root: PublicRoot): Promise<PublicIndex> {
  try {
    publicRootSchema.parse(root);
    const coverage = structuralCoverage(root);
    const [ptRoutes, enRoutes] = await Promise.all([
      getPublishedCaseRoutes('pt', root),
      getPublishedCaseRoutes('en', root),
    ]);
    if (!ptRoutes.ok || !enRoutes.ok) throw new Error('Confirmed case coverage unavailable.');
    const cases = [...ptRoutes.value, ...enRoutes.value].map((route) =>
      publishedCaseRouteSchema.parse(route),
    );
    const identities = new Set<string>();
    const paths = new Set<string>();
    for (const route of cases) {
      const identity = `${route.caseId}/${route.locale}`;
      if (identities.has(identity) || paths.has(route.path))
        throw new Error('Ambiguous confirmed case routes.');
      identities.add(identity);
      paths.add(route.path);
    }
    let payload: ReturnType<typeof runtimePayload> | undefined;
    async function neverPublished(
      result: Result<unknown>,
      collection: 'professional-profiles' | 'site-navigation',
      locale: Locale,
    ) {
      payload ??= runtimePayload();
      const status = await publishedReadStatus(
        result,
        { collection, where: { locale: { equals: locale } } },
        await payload,
      );
      if (status !== 404)
        throw new Error(
          'Missing confirmed structural coverage has a public intent or unavailable origin.',
        );
      return false;
    }
    async function pagesFor(locale: Locale): Promise<boolean> {
      const profile = await getPublishedProfile(locale, undefined, root);
      if (!coverage.profile.has(locale)) {
        if (profile.ok) throw new Error('Unexpected profile coverage.');
        // Profile is the first page dependency. A healthy never-public Profile
        // excludes this locale's pages; do not demand an irresolvable Nav DTO.
        return neverPublished(profile, 'professional-profiles', locale);
      }
      if (!profile.ok) throw new Error('Confirmed profile is corrupt.');
      const navigation = await getPublishedNavigation(locale, undefined, root);
      if (!coverage.navigation.has(locale)) {
        if (navigation.ok) throw new Error('Unexpected navigation coverage.');
        return neverPublished(navigation, 'site-navigation', locale);
      }
      if (!navigation.ok) throw new Error('Confirmed navigation is corrupt.');
      resolveNavigation({
        locale,
        profile: profile.value,
        navigation: navigation.value,
      });
      return true;
    }
    const [pt, en] = await Promise.all([pagesFor('pt'), pagesFor('en')]);
    return { pages: { pt, en }, cases };
  } catch {
    // An incomplete/broken Root or failed origin classification must be non-2xx
    // at the metadata route. Never replace it with a plausible empty sitemap.
    throw new Error('Confirmed public index unavailable.');
  }
}

export async function readPublicSitemap(root: PublicRoot, origin: string): Promise<string> {
  const index = await readPublicIndex(root);
  return renderPublicSitemap(
    buildPublicSitemap({
      origin,
      indexable: true,
      pages: index.pages,
      cases: index.cases.map(({ caseId, locale, path }) => ({ caseId, locale, path })),
    }),
  );
}
