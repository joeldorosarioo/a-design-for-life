import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { clearStructuralFixture, createEditorialPayloadFixture } from './editorial-payload';
import {
  casePublicationFixture,
  mediaMetadataFixture,
  navigationFixture,
  observedRequest,
  profilePublicationFixture,
} from './editorial-lifecycle';
import { confirmTestPublication } from './confirmed-publication';
import { releaseEditorialLease } from '../../src/helpers/payload/editorial-revision';
import { publicRootDirectory } from '../../src/helpers/payload/public-root-directory';
import { ensureProfileDrafts } from '../../src/features/professional-profile/server';
import { ensureNavigationDrafts } from '../../src/features/site-navigation/server';

type Locale = 'pt' | 'en';
type CaseName = 'first' | 'second' | 'ptOnly';
type PublicCaseFixture = {
  caseId: string;
  locales: Record<
    Locale,
    { contentId: string; slug: string; path: string; title: string; published: boolean }
  >;
};

function assertOwnedSerialEnvironment(serialRunner: boolean) {
  const database = new URL(process.env.DATABASE_URI ?? 'file:///invalid');
  const local = ['127.0.0.1', 'localhost', '[::1]'].includes(database.hostname);
  if (
    !serialRunner ||
    !local ||
    process.env.APP_ENV !== 'test' ||
    !database.pathname.startsWith('/adfl_test_') ||
    ['5432', '55432'].includes(database.port)
  )
    throw new Error(
      'Public portfolio fixtures require one serial worker and an owned isolated test DB.',
    );
  const directory = publicRootDirectory({
    APP_ENV: process.env.APP_ENV,
    DATABASE_URI: process.env.DATABASE_URI!,
    SITE_ORIGIN: process.env.SITE_ORIGIN!,
  });
  const relative = path.relative(path.resolve('.work/publication'), directory);
  if (
    !relative ||
    relative === '..' ||
    relative.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relative)
  )
    throw new Error('Public portfolio fixture requires its isolated publication namespace.');
}

/**
 * Serial native fixture for public-page and later language-reading journeys.
 * It replaces only the four structural singleton fixtures through existing guarded
 * support; all cases from other serial suites are preserved. Callers must prove
 * workers === 1 and fullyParallel === false before passing serialRunner: true.
 */
export async function createPublicPortfolioFixture(
  key: string,
  options: { serialRunner: boolean },
) {
  assertOwnedSerialEnvironment(options.serialRunner);
  const editor = await createEditorialPayloadFixture(key);
  const namespace = `public-${randomUUID().slice(0, 8)}`;
  const readingKeys = {
    trajectory: randomUUID(),
    method: randomUUID(),
    context: randomUUID(),
    narrative: randomUUID(),
    imagePair: randomUUID(),
    comparison: randomUUID(),
    before: randomUUID(),
    after: randomUUID(),
  };
  const localeCopy = (locale: Locale) => {
    const prefix = `Synthetic ${locale.toUpperCase()} ${namespace}`;
    return {
      locale,
      prefix,
      brand: `${prefix} portfolio`,
      projects: `${prefix} projects`,
      about: `${prefix} about`,
      resume: `${prefix} resume`,
      contact: `${prefix} contact`,
      openMenu: `${prefix} open menu`,
      closeMenu: `${prefix} close menu`,
      newTab: `${prefix} opens a new tab`,
      contents: `${prefix} contents`,
      readCase: `${prefix} read case`,
      homeTitle: `${prefix} home`,
      homeEmphasis: `${prefix} editorial emphasis`,
      aboutTitle: `${prefix} about page`,
      listingTitle: `${prefix} case list`,
      contextHeading: `${prefix} context heading`,
      comparisonHeading: `${prefix} comparison heading`,
      homePath: `/${locale}`,
      aboutPath: locale === 'pt' ? '/pt/sobre' : '/en/about',
      listingPath: `/${locale}/cases`,
    };
  };
  const copy = { pt: localeCopy('pt'), en: localeCopy('en') };
  const cases = {} as Record<CaseName, PublicCaseFixture>;
  const ownedEnvironment = {
    database: process.env.DATABASE_URI,
    origin: process.env.SITE_ORIGIN,
  };
  const ownedStructuralIds: {
    collection: 'professional-profiles' | 'site-navigation';
    id: string;
  }[] = [];
  let disposed = false;

  async function destroy() {
    if (disposed) return;
    try {
      assertOwnedSerialEnvironment(options.serialRunner);
      if (
        process.env.DATABASE_URI !== ownedEnvironment.database ||
        process.env.SITE_ORIGIN !== ownedEnvironment.origin ||
        ownedStructuralIds.length !== 4
      )
        throw new Error('Refusing teardown outside the four owned structural fixtures.');
      for (const collection of ['professional-profiles', 'site-navigation'] as const) {
        const current = await editor.payload.find({
          collection,
          draft: true,
          limit: 3,
          depth: 0,
          req: await editor.request(),
          overrideAccess: false,
        });
        const expected = ownedStructuralIds
          .filter((item) => item.collection === collection)
          .map((item) => item.id)
          .sort();
        const actual = current.docs.map((item) => item.id).sort();
        if (
          current.totalDocs !== 2 ||
          expected.length !== 2 ||
          actual.length !== expected.length ||
          actual.some((id, index) => id !== expected[index])
        )
          throw new Error('Refusing to clear structural documents owned by another fixture.');
      }
      // The serial runner and exact four IDs establish ownership before the
      // existing writer-protected cleanup. It preserves every case subject.
      await clearStructuralFixture(editor.payload);
    } finally {
      disposed = true;
      await editor.payload.destroy();
    }
  }

  async function publishStructural(
    collection: 'professional-profiles' | 'site-navigation',
    id: string,
    data: Record<string, unknown>,
  ) {
    const req = await observedRequest(collection, id, await editor.request());
    const token = req.headers.get('x-editorial-lease');
    try {
      const saved = await editor.payload.update({
        collection,
        id,
        data: { ...data, _status: 'published' },
        draft: false,
        depth: 0,
        req,
        overrideAccess: false,
      });
      await confirmTestPublication(saved, await editor.request());
    } finally {
      if (token) await releaseEditorialLease(collection, id, token, await editor.request());
    }
  }

  function narrative(locale: Locale, suffix: string, paragraphs = locale === 'pt' ? 6 : 22) {
    const base = casePublicationFixture('00000000-0000-4000-8000-000000000001').sections[0]
      .blocks[0].content;
    const paragraph = base.root.children[0];
    const leaf = paragraph.children[0];
    return {
      root: {
        ...base.root,
        children: Array.from({ length: paragraphs }, (_, index) => ({
          ...paragraph,
          children: [
            {
              ...leaf,
              text: `${copy[locale].prefix} ${suffix} paragraph ${index + 1}. Synthetic test narrative only; no professional outcome is asserted.`,
            },
          ],
        })),
      },
    };
  }

  try {
    // Existing support enforces APP_ENV, database prefix and writer/root ownership.
    // This operation preserves every case and its confirmed publication subjects.
    await clearStructuralFixture(editor.payload);
    await ensureProfileDrafts(await editor.request());
    await ensureNavigationDrafts(await editor.request());
    for (const collection of ['professional-profiles', 'site-navigation'] as const) {
      const created = await editor.payload.find({
        collection,
        draft: true,
        limit: 3,
        depth: 0,
        req: await editor.request(),
        overrideAccess: false,
      });
      if (
        created.totalDocs !== 2 ||
        created.docs.length !== 2 ||
        new Set(created.docs.map((item) => item.locale)).size !== 2
      )
        throw new Error('Expected exactly the two provisioned locale fixtures.');
      for (const item of created.docs) ownedStructuralIds.push({ collection, id: item.id });
    }
    const image = await mediaMetadataFixture(editor.payload);
    const pdfs = {
      pt: await mediaMetadataFixture(editor.payload, 'pdf'),
      en: await mediaMetadataFixture(editor.payload, 'pdf'),
    };
    const locales = {
      pt: { ...copy.pt, resumeId: pdfs.pt.id, resumeHref: `/media/${pdfs.pt.id}/original` },
      en: { ...copy.en, resumeId: pdfs.en.id, resumeHref: `/media/${pdfs.en.id}/original` },
    };

    for (const locale of ['pt', 'en'] as const) {
      const text = copy[locale];
      const profile = profilePublicationFixture(image.id, pdfs[locale].id);
      const group = (name: string) => profile[name] as Record<string, unknown>;
      const paragraphs = Array.from(
        { length: locale === 'pt' ? 2 : 9 },
        (_, index) =>
          `${text.prefix} synthetic editorial paragraph ${index + 1}. This is test material, not a professional biography or claim.`,
      ).join('\n\n');
      const profileData = {
        ...profile,
        identity: { name: `${text.prefix} identity`, role: `${text.prefix} role` },
        home: {
          ...group('home'),
          title: text.homeTitle,
          titleEmphasis: text.homeEmphasis,
          description: paragraphs,
        },
        listing: {
          eyebrow: `${text.prefix} listing eyebrow`,
          title: text.listingTitle,
          description: `${text.prefix} published studies introduction`,
        },
        homeAbout: {
          ...group('homeAbout'),
          trajectory: [
            {
              readingKey: readingKeys.trajectory,
              period: `${text.prefix} period`,
              title: `${text.prefix} trajectory item`,
              description: paragraphs,
            },
          ],
        },
        approach: {
          ...group('approach'),
          methods: [
            {
              readingKey: readingKeys.method,
              title: `${text.prefix} method item`,
              description: paragraphs,
              keywords: `${text.prefix} keywords`,
            },
          ],
        },
        about: {
          ...group('about'),
          title: text.aboutTitle,
          description: `${text.prefix} about introduction`,
          introduction: paragraphs,
          journey: paragraphs,
          approach: paragraphs,
          inMotion: paragraphs,
        },
        contacts: {
          email: `synthetic-${locale}-${namespace}@example.invalid`,
          linkedin: `https://www.linkedin.com/in/synthetic-${locale}-${namespace}`,
        },
      };
      const navigation = navigationFixture();
      const navGroup = (name: string) => navigation[name] as Record<string, unknown>;
      const navigationData = {
        ...navigation,
        header: {
          brandLabel: text.brand,
          projectsLabel: text.projects,
          aboutLabel: text.about,
          resumeLabel: text.resume,
          contactLabel: text.contact,
        },
        footer: {
          ...navGroup('footer'),
          emailLabel: `${text.prefix} email`,
          linkedinLabel: `${text.prefix} LinkedIn`,
          resumeLabel: text.resume,
        },
        controls: {
          ...navGroup('controls'),
          caseLinkLabel: text.readCase,
          homeLabel: `${text.prefix} home link`,
          casesLabel: text.projects,
          contentsLabel: text.contents,
          openMenuLabel: text.openMenu,
          closeMenuLabel: text.closeMenu,
          newTabLabel: text.newTab,
        },
      };
      for (const [collection, data] of [
        ['professional-profiles', profileData],
        ['site-navigation', navigationData],
      ] as const) {
        const current = await editor.payload.find({
          collection,
          where: { locale: { equals: locale } },
          draft: true,
          limit: 1,
          depth: 0,
          req: await editor.request(),
          overrideAccess: false,
        });
        if (!current.docs[0]) throw new Error('Expected provisioned structural fixture.');
        await publishStructural(collection, current.docs[0].id, data);
      }
    }

    // Creation order intentionally differs from editorial order.
    for (const [name, sortOrder] of [
      ['second', 20],
      ['first', 10],
      ['ptOnly', 30],
    ] as const) {
      const parent = await editor.payload.create({
        collection: 'cases',
        data: { internalTitle: `${namespace} synthetic ${name}`, sortOrder, featured: true },
        depth: 0,
        req: await editor.request(),
        overrideAccess: false,
      });
      await confirmTestPublication(parent, await editor.request());
      const translations = {} as PublicCaseFixture['locales'];
      for (const locale of ['pt', 'en'] as const) {
        const text = copy[locale];
        const published = name !== 'ptOnly' || locale === 'pt';
        const slug = `${namespace}-${name.toLowerCase()}-${locale}`;
        const title = `${text.prefix} ${name} ${published ? 'published study' : 'PRIVATE translation'}`;
        const base = casePublicationFixture(image.id);
        const saved = await editor.payload.create({
          collection: 'case-content',
          data: {
            ...base,
            case: parent.id,
            locale,
            slug,
            title,
            eyebrow: `${text.prefix} study eyebrow`,
            introduction: `${text.prefix} detail opening`,
            scope: `${text.prefix} synthetic scope`,
            contextNote: `${text.prefix} synthetic test case only`,
            sections: [
              {
                readingKey: readingKeys.context,
                presentation: 'narrative',
                heading: text.contextHeading,
                blocks: [
                  {
                    blockType: 'text',
                    readingKey: readingKeys.narrative,
                    content: narrative(locale, name),
                  },
                  {
                    blockType: 'image-pair',
                    readingKey: readingKeys.imagePair,
                    presentation: 'pair',
                    firstLabel: `${text.prefix} first image`,
                    secondLabel: `${text.prefix} second image`,
                    first: {
                      media: image.id,
                      decorative: false,
                      alt: `${text.prefix} first paired image`,
                    },
                    second: {
                      media: image.id,
                      decorative: false,
                      alt: `${text.prefix} second paired image`,
                    },
                  },
                ],
              },
              {
                readingKey: readingKeys.comparison,
                presentation: 'comparison',
                heading: text.comparisonHeading,
                note: `${text.prefix} no measured result is claimed`,
                blocks: [
                  {
                    blockType: 'text',
                    readingKey: readingKeys.before,
                    heading: `${text.prefix} before heading`,
                    content: narrative(locale, 'before', 1),
                  },
                  {
                    blockType: 'text',
                    readingKey: readingKeys.after,
                    heading: `${text.prefix} after heading`,
                    content: narrative(locale, 'after', 1),
                  },
                ],
              },
            ],
            _status: published ? 'published' : 'draft',
          },
          draft: !published,
          depth: 0,
          req: await editor.request(),
          overrideAccess: false,
        });
        if (published) await confirmTestPublication(saved, await editor.request());
        translations[locale] = {
          contentId: saved.id,
          slug,
          path: `/${locale}/cases/${slug}`,
          title,
          published,
        };
      }
      cases[name] = { caseId: parent.id, locales: translations };
    }
    return {
      ...editor,
      namespace,
      readingKeys,
      locales,
      cases,
      destroy,
    };
  } catch (error) {
    try {
      await destroy();
    } catch (cleanupError) {
      throw new AggregateError(
        [error, cleanupError],
        'Portfolio fixture setup and guarded cleanup failed.',
      );
    }
    throw error;
  }
}
