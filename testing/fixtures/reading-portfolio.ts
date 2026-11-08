import { randomUUID } from 'node:crypto';
import type { CaseContent } from '../../src/payload-types';
import { releaseEditorialLease } from '../../src/helpers/payload/editorial-revision';
import { createPublicPortfolioFixture } from './public-portfolio';
import {
  casePublicationFixture,
  mediaMetadataFixture,
  observedRequest,
} from './editorial-lifecycle';
import { confirmTestPublication } from './confirmed-publication';

type Portfolio = Awaited<ReturnType<typeof createPublicPortfolioFixture>>;
export type ReadingLocale = 'pt' | 'en';

/** Installed only as test support. Every mutation uses the base fixture's guarded
 * Native request and publication coordinator; no SQL/FS shortcut grants content. */
export async function createReadingPortfolioFixture(key: string, serialRunner: boolean) {
  const portfolio = await createPublicPortfolioFixture(key, { serialRunner });
  try {
    const notices = {
      pt: {
        missing: `Synthetic PT ${portfolio.namespace} entire translation unavailable`,
        adjusted: `Synthetic PT ${portfolio.namespace} reading position adjusted`,
        failure: `Synthetic PT ${portfolio.namespace} language switch failed`,
      },
      en: {
        missing: `Synthetic EN ${portfolio.namespace} entire translation unavailable`,
        adjusted: `Synthetic EN ${portfolio.namespace} reading position adjusted`,
        failure: `Synthetic EN ${portfolio.namespace} language switch failed`,
      },
    };
    const imageEn = await mediaMetadataFixture(portfolio.payload);
    const tailKeys = Array.from({ length: 3 }, () => randomUUID());

    async function publishStructural(
      collection: 'professional-profiles' | 'site-navigation',
      id: string,
      data: Record<string, unknown>,
    ) {
      const req = await observedRequest(collection, id, await portfolio.request());
      const token = req.headers.get('x-editorial-lease');
      try {
        const saved = await portfolio.payload.update({
          collection,
          id,
          data: { ...data, _status: 'published' },
          draft: false,
          depth: 0,
          req,
          overrideAccess: false,
        });
        await confirmTestPublication(saved, await portfolio.request());
      } finally {
        if (token) await releaseEditorialLease(collection, id, token, await portfolio.request());
      }
    }

    // Obtain the exact singleton IDs created by the base fixture and verify their
    // namespace before updating. Never assume this worker's DB has no other cases.
    for (const locale of ['pt', 'en'] as const) {
      const profiles = await portfolio.payload.find({
        collection: 'professional-profiles',
        where: { locale: { equals: locale } },
        draft: false,
        depth: 0,
        limit: 2,
        req: await portfolio.request(),
        overrideAccess: false,
      });
      const profile = profiles.docs[0];
      if (profiles.totalDocs !== 1 || !profile?.home?.title?.includes(portfolio.namespace))
        throw new Error('Reading fixture does not own this profile singleton.');
      const paragraphs = Array.from(
        { length: locale === 'pt' ? 2 : 9 },
        (_, index) =>
          `Synthetic ${locale.toUpperCase()} ${portfolio.namespace} list introduction paragraph ${index + 1}. This is test material only.`,
      ).join('\n\n');
      await publishStructural('professional-profiles', profile.id, {
        // Spread every existing group so publication remains valid and old row
        // IDs/keys retain their identity. Tail rows leave room below the target.
        identity: profile.identity,
        homeProjects: profile.homeProjects,
        homeAbout: profile.homeAbout,
        contacts: profile.contacts,
        listing: { ...profile.listing, description: paragraphs },
        home:
          locale === 'en'
            ? {
                ...profile.home,
                portrait: { ...profile.home?.portrait, media: imageEn.id },
              }
            : profile.home,
        about:
          locale === 'en'
            ? {
                ...profile.about,
                portrait: { ...profile.about?.portrait, media: imageEn.id },
                deskPhotograph: {
                  ...profile.about?.deskPhotograph,
                  media: imageEn.id,
                },
                architecturePhotograph: {
                  ...profile.about?.architecturePhotograph,
                  media: imageEn.id,
                },
              }
            : profile.about,
        approach: {
          ...profile.approach,
          methods: [
            ...(profile.approach?.methods ?? []),
            ...tailKeys.map((readingKey, index) => ({
              readingKey,
              title: `Synthetic ${locale} ${portfolio.namespace} following method ${index + 1}`,
              description: paragraphs,
              keywords: `Synthetic ${locale} following content`,
            })),
          ],
        },
      });
      const navigations = await portfolio.payload.find({
        collection: 'site-navigation',
        where: { locale: { equals: locale } },
        draft: false,
        depth: 0,
        limit: 2,
        req: await portfolio.request(),
        overrideAccess: false,
      });
      const navigation = navigations.docs[0];
      if (
        navigations.totalDocs !== 1 ||
        !navigation?.header?.brandLabel?.includes(portfolio.namespace)
      )
        throw new Error('Reading fixture does not own this navigation singleton.');
      await publishStructural('site-navigation', navigation.id, {
        header: navigation.header,
        footer: navigation.footer,
        controls: navigation.controls,
        messages: {
          ...navigation.messages,
          translationUnavailable: notices[locale].missing,
          readingPositionAdjusted: notices[locale].adjusted,
          temporaryFailureDescription: notices[locale].failure,
        },
      });
    }

    const parents = await portfolio.payload.find({
      collection: 'cases',
      pagination: false,
      depth: 0,
      select: { sortOrder: true },
      req: await portfolio.request(),
      overrideAccess: false,
    });
    const firstOrder =
      Math.floor(Math.min(0, ...parents.docs.map((item) => item.sortOrder ?? 0))) - 100;
    if (!Number.isSafeInteger(firstOrder))
      throw new Error('Reading fixture requires safe synthetic case ordering.');
    for (const [name, offset] of [
      ['ptOnly', 0],
      ['first', 20],
      ['second', 30],
    ] as const) {
      const id = portfolio.cases[name].caseId;
      const req = await observedRequest('cases', id, await portfolio.request());
      const token = req.headers.get('x-editorial-lease');
      try {
        const saved = await portfolio.payload.update({
          collection: 'cases',
          id,
          data: { sortOrder: firstOrder + offset },
          depth: 0,
          req,
          overrideAccess: false,
        });
        await confirmTestPublication(saved, await portfolio.request());
      } finally {
        if (token) await releaseEditorialLease('cases', id, token, await portfolio.request());
      }
    }

    async function createSingleLocaleCase(
      name: string,
      publishedLocale: ReadingLocale,
      order: number,
    ) {
      const parent = await portfolio.payload.create({
        collection: 'cases',
        data: {
          internalTitle: `${portfolio.namespace} ${name}`,
          sortOrder: order,
          featured: true,
        },
        req: await portfolio.request(),
        depth: 0,
        overrideAccess: false,
      });
      await confirmTestPublication(parent, await portfolio.request());
      const locales = {} as Portfolio['cases']['first']['locales'];
      for (const locale of ['pt', 'en'] as const) {
        const published = locale === publishedLocale;
        const base = casePublicationFixture(imageEn.id);
        const slug = `${portfolio.namespace}-${name}-${locale}`;
        const title = `Synthetic ${locale.toUpperCase()} ${portfolio.namespace} ${name} ${published ? 'public' : 'PRIVATE'}`;
        const saved = await portfolio.payload.create({
          collection: 'case-content',
          data: {
            ...base,
            case: parent.id,
            locale,
            slug,
            title,
            sections: base.sections.map((section) => ({
              ...section,
              readingKey: randomUUID(),
              blocks: section.blocks.map((block) => ({
                ...block,
                readingKey: randomUUID(),
              })),
            })),
            _status: published ? 'published' : 'draft',
          },
          draft: !published,
          depth: 0,
          req: await portfolio.request(),
          overrideAccess: false,
        });
        if (published) await confirmTestPublication(saved, await portfolio.request());
        locales[locale] = {
          contentId: saved.id,
          slug,
          path: `/${locale}/cases/${slug}`,
          title,
          published,
        };
      }
      return { caseId: parent.id, locales };
    }
    // PT: [ptOnly, paddingPt, first, second, ...existing].
    // EN: [first, second, enOnly, ...existing]. The shared first card is the
    // first column of a different row, so a percentage/index/scrollY copy fails.
    const paddingPt = await createSingleLocaleCase('reading-padding-pt', 'pt', firstOrder + 10);
    const enOnly = await createSingleLocaleCase('reading-only-en', 'en', firstOrder + 40);

    async function publishSections(contentId: string, sections: CaseContent['sections']) {
      const ownedIds = Object.values(portfolio.cases).flatMap((item) =>
        Object.values(item.locales).map((item) => item.contentId),
      );
      if (!ownedIds.includes(contentId))
        throw new Error('Refusing to mutate another case fixture.');
      const req = await observedRequest('case-content', contentId, await portfolio.request());
      const token = req.headers.get('x-editorial-lease');
      try {
        const saved = await portfolio.payload.update({
          collection: 'case-content',
          id: contentId,
          data: { sections, _status: 'published' },
          draft: false,
          depth: 0,
          req,
          overrideAccess: false,
        });
        await confirmTestPublication(saved, await portfolio.request());
      } finally {
        if (token)
          await releaseEditorialLease('case-content', contentId, token, await portfolio.request());
      }
    }
    return {
      ...portfolio,
      notices,
      imageEnId: imageEn.id,
      paddingPt,
      enOnly,
      publishSections,
    };
  } catch (error) {
    try {
      await portfolio.destroy();
    } catch (cleanupError) {
      throw new AggregateError(
        [error, cleanupError],
        'Reading fixture setup and owned cleanup failed.',
      );
    }
    throw error;
  }
}
