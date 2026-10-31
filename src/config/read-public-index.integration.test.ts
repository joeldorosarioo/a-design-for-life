import { randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import {
  clearStructuralFixture,
  createEditorialPayloadFixture,
} from '../../testing/fixtures/editorial-payload';
import {
  casePublicationFixture,
  mediaMetadataFixture,
  navigationFixture,
  observedRequest,
  profilePublicationFixture,
} from '../../testing/fixtures/editorial-lifecycle';
import { confirmTestPublication } from '../../testing/fixtures/confirmed-publication';
import { releaseEditorialLease } from '@/helpers/payload/editorial-revision';
import { installPayloadProvider } from '@/helpers/payload/runtime';
import { installPublicationProvider } from '@/helpers/payload/publication-runtime';
import { readPublicRoot, type PublicRoot } from '@/helpers/payload/public-root';
import { publicRootDirectory } from '@/helpers/payload/public-root-directory';
import { readServerEnv } from './server-env';
import { portfolioPublicationCoordinator } from './publication';
import { buildPublicSitemap } from './build-public-index';
import { readPublicIndex } from './read-public-index';

// The integration project's existing fileParallelism:false and this sequential
// suite own one isolated fixture, preserving other cases and their order.
describe('confirmed public index from real Native publication', { concurrent: false }, () => {
  let fixture: Awaited<ReturnType<typeof createEditorialPayloadFixture>>;
  let directory: string;
  let defaultDirectory: string;
  let parentId: string;
  let ptCaseId: string;
  let enCaseId: string;
  let capturedCompleteRoot: PublicRoot;
  const suffix = randomUUID().slice(0, 8);
  const slug = { pt: `index-pt-${suffix}`, en: `index-en-${suffix}` };
  const nextDraftSlug = `private-index-pt-${suffix}`;
  const origin = 'https://synthetic-index.example.invalid';
  const structuralIds: {
    collection: 'professional-profiles' | 'site-navigation';
    locale: 'pt' | 'en';
    id: string;
  }[] = [];
  let priorCases: {
    id: string;
    sortOrder?: number | null;
    featured?: boolean | null;
  }[] = [];

  function assertIsolated() {
    const database = new URL(process.env.DATABASE_URI ?? 'file:///invalid');
    if (
      process.env.APP_ENV !== 'test' ||
      !['127.0.0.1', 'localhost', '[::1]'].includes(database.hostname) ||
      !/^\/adfl_test_[a-z0-9_]+$/.test(database.pathname) ||
      ['5432', '55432'].includes(database.port)
    )
      throw new Error('Index Native fixture requires the owned isolated test environment.');
  }
  const id = (collection: 'professional-profiles' | 'site-navigation', locale: 'pt' | 'en') => {
    const found = structuralIds.find(
      (item) => item.collection === collection && item.locale === locale,
    );
    if (!found) throw new Error('Owned structural fixture identity missing.');
    return found.id;
  };
  async function capture() {
    const root = await readPublicRoot(directory);
    if (!root) throw new Error('Real Native publication did not produce its confirmed Root.');
    return root;
  }
  const sitemap = (index: Awaited<ReturnType<typeof readPublicIndex>>) =>
    buildPublicSitemap({
      origin,
      indexable: true,
      pages: index.pages,
      cases: index.cases.map(({ caseId, locale, path }) => ({
        caseId,
        locale,
        path,
      })),
    });
  async function save(
    collection: 'professional-profiles' | 'site-navigation' | 'case-content',
    contentId: string,
    data: Record<string, unknown>,
    published = false,
  ) {
    const req = await observedRequest(collection, contentId, await fixture.request());
    const token = req.headers.get('x-editorial-lease');
    try {
      const saved = await fixture.payload.update({
        collection,
        id: contentId,
        data: {
          ...data,
          _status: published ? 'published' : 'draft',
        } as never,
        draft: !published,
        depth: 0,
        req,
        overrideAccess: false,
      });
      if (published) await confirmTestPublication(saved, await fixture.request());
      return saved;
    } finally {
      if (token) await releaseEditorialLease(collection, contentId, token, await fixture.request());
    }
  }

  beforeAll(async () => {
    assertIsolated();
    defaultDirectory = publicRootDirectory(readServerEnv(process.env));
    fixture = await createEditorialPayloadFixture(`e2-public-index-${suffix}`);
    installPayloadProvider(async () => fixture.payload);
    directory = await mkdtemp(path.join(tmpdir(), 'portfolio-index-native-'));
    installPublicationProvider(() => portfolioPublicationCoordinator(directory));
    priorCases = (
      await fixture.payload.find({
        collection: 'cases',
        depth: 0,
        pagination: false,
        limit: 0,
        overrideAccess: false,
        req: await fixture.request(),
      })
    ).docs.map(({ id, sortOrder, featured }) => ({
      id,
      sortOrder,
      featured,
    }));
    // Existing guarded support removes only the four structural singleton
    // fixtures; no case/order/history from any other serial file is deleted.
    await clearStructuralFixture(fixture.payload);
    const image = await mediaMetadataFixture(fixture.payload);
    const pdf = await mediaMetadataFixture(fixture.payload, 'pdf');
    for (const locale of ['pt', 'en'] as const) {
      const profile = await fixture.payload.create({
        collection: 'professional-profiles',
        data: {
          ...profilePublicationFixture(image.id, pdf.id),
          locale,
          _status: 'draft',
        } as never,
        draft: true,
        depth: 0,
        req: await fixture.request(),
        overrideAccess: false,
      });
      structuralIds.push({
        collection: 'professional-profiles',
        locale,
        id: profile.id,
      });
      const navigation = await fixture.payload.create({
        collection: 'site-navigation',
        data: { ...navigationFixture(), locale, _status: 'draft' } as never,
        draft: true,
        depth: 0,
        req: await fixture.request(),
        overrideAccess: false,
      });
      structuralIds.push({
        collection: 'site-navigation',
        locale,
        id: navigation.id,
      });
    }
    const parent = await fixture.payload.create({
      collection: 'cases',
      data: {
        internalTitle: `Synthetic index identity ${suffix}`,
        sortOrder: 123,
        featured: true,
      },
      req: await fixture.request(),
      overrideAccess: false,
    });
    parentId = parent.id;
    await confirmTestPublication(parent, await fixture.request());
    const pt = await fixture.payload.create({
      collection: 'case-content',
      data: {
        ...casePublicationFixture(image.id),
        case: parentId,
        locale: 'pt',
        slug: slug.pt,
        _status: 'published',
      },
      depth: 0,
      req: await fixture.request(),
      overrideAccess: false,
    });
    ptCaseId = pt.id;
    await confirmTestPublication(pt, await fixture.request());
    const en = await fixture.payload.create({
      collection: 'case-content',
      data: {
        ...casePublicationFixture(image.id),
        case: parentId,
        locale: 'en',
        slug: slug.en,
        _status: 'draft',
      },
      draft: true,
      depth: 0,
      req: await fixture.request(),
      overrideAccess: false,
    });
    enCaseId = en.id;
  });

  afterAll(async () => {
    try {
      if (fixture) {
        assertIsolated();
        for (const collection of ['professional-profiles', 'site-navigation'] as const) {
          const current = await fixture.payload.find({
            collection,
            draft: true,
            depth: 0,
            limit: 3,
            req: await fixture.request(),
            overrideAccess: false,
          });
          const expected = structuralIds
            .filter((item) => item.collection === collection)
            .map((item) => item.id)
            .sort();
          if (
            expected.length !== 2 ||
            current.totalDocs !== 2 ||
            JSON.stringify(current.docs.map((item) => item.id).sort()) !== JSON.stringify(expected)
          )
            throw new Error("Refusing to clear another fixture's structural identities.");
        }
        await clearStructuralFixture(fixture.payload);
        const remaining = await fixture.payload.find({
          collection: 'cases',
          depth: 0,
          pagination: false,
          limit: 0,
          req: await fixture.request(),
          overrideAccess: false,
        });
        for (const previous of priorCases)
          expect(remaining.docs.find((item) => item.id === previous.id)).toMatchObject(previous);
      }
    } finally {
      if (defaultDirectory)
        installPublicationProvider(() => portfolioPublicationCoordinator(defaultDirectory));
      installPayloadProvider(async () => {
        const [{ default: config }, { getPayload }] = await Promise.all([
          import('@payload-config'),
          import('payload'),
        ]);
        return getPayload({ config });
      });
      await fixture?.payload.destroy();
      if (directory) {
        const target = path.resolve(directory);
        if (
          path.dirname(target) !== path.resolve(tmpdir()) ||
          !path.basename(target).startsWith('portfolio-index-native-')
        )
          throw new Error('Invalid owned index reference cleanup path.');
        await rm(target, { recursive: true, force: true });
      }
    }
  });

  it('keeps an independently confirmed case while never-public structural pages and EN translation are absent', async () => {
    const index = await readPublicIndex(await capture());
    expect(index.pages).toEqual({ pt: false, en: false });
    expect(
      index.cases.find((item) => item.caseId === parentId && item.locale === 'pt'),
    ).toMatchObject({
      caseId: parentId,
      locale: 'pt',
      path: `/pt/cases/${slug.pt}`,
    });
    expect(index.cases.some((item) => item.caseId === parentId && item.locale === 'en')).toBe(
      false,
    );
    expect(
      sitemap(index).find((item) => item.url === `${origin}/pt/cases/${slug.pt}`)?.alternates,
    ).toEqual({ languages: { pt: `${origin}/pt/cases/${slug.pt}` } });
    expect(JSON.stringify(sitemap(index))).not.toContain(`/en/cases/${slug.en}`);
  });

  it('publishes PT structural paths and classifies private EN Profile absence using real count metadata', async () => {
    await save('professional-profiles', id('professional-profiles', 'pt'), {}, true);
    await save('site-navigation', id('site-navigation', 'pt'), {}, true);
    const root = await capture();
    const count = vi.spyOn(fixture.payload.db, 'count');
    const bodyFind = vi.spyOn(fixture.payload, 'find');
    const bodyById = vi.spyOn(fixture.payload, 'findByID');
    try {
      const index = await readPublicIndex(root);
      expect(index.pages).toEqual({ pt: true, en: false });
      expect(count).toHaveBeenCalled();
      expect(count.mock.calls.every(([args]) => args.collection === 'professional-profiles')).toBe(
        true,
      );
      expect(bodyFind).not.toHaveBeenCalled();
      expect(bodyById).not.toHaveBeenCalled();
      const entries = sitemap(index);
      expect(entries.find((item) => item.url === `${origin}/pt`)?.alternates).toEqual({
        languages: { pt: `${origin}/pt` },
      });
      expect(entries.some((item) => item.url === `${origin}/en`)).toBe(false);
      expect(
        entries.find((item) => item.url === `${origin}/pt/cases/${slug.pt}`)?.alternates,
      ).toEqual({ languages: { pt: `${origin}/pt/cases/${slug.pt}` } });
    } finally {
      count.mockRestore();
      bodyFind.mockRestore();
      bodyById.mockRestore();
    }
  });

  it('leaves captured output unchanged after genuine Native draft edits to a published profile and case slug', async () => {
    const root = await capture();
    const before = await readPublicIndex(root);
    await save('professional-profiles', id('professional-profiles', 'pt'), {
      home: { title: `Private draft index title ${suffix}` },
    });
    await save('case-content', ptCaseId, {
      title: `Private draft index case ${suffix}`,
      slug: nextDraftSlug,
    });
    expect(await capture()).toEqual(root);
    expect(await readPublicIndex(root)).toEqual(before);
    expect(JSON.stringify(sitemap(before))).not.toContain(nextDraftSlug);
  });

  it('uses only the supplied complete captured Root after current advances and never initializes a Native factory on the positive path', async () => {
    await save('professional-profiles', id('professional-profiles', 'en'), {}, true);
    await save('site-navigation', id('site-navigation', 'en'), {}, true);
    capturedCompleteRoot = await capture();
    await save('case-content', enCaseId, {}, true);
    const newer = await capture();
    expect(newer.generation).not.toBe(capturedCompleteRoot.generation);
    let nativeLoads = 0;
    installPayloadProvider(async () => {
      nativeLoads++;
      throw new Error('Positive confirmed reads must not initialize Native.');
    });
    try {
      const pinned = await readPublicIndex(capturedCompleteRoot);
      expect(pinned.pages).toEqual({ pt: true, en: true });
      expect(
        pinned.cases.find((item) => item.caseId === parentId && item.locale === 'pt')?.path,
      ).toBe(`/pt/cases/${slug.pt}`);
      expect(pinned.cases.some((item) => item.caseId === parentId && item.locale === 'en')).toBe(
        false,
      );
      expect(
        sitemap(pinned).find((item) => item.url === `${origin}/pt/cases/${slug.pt}`)?.alternates,
      ).toEqual({ languages: { pt: `${origin}/pt/cases/${slug.pt}` } });
      const current = await readPublicIndex(newer);
      expect(
        sitemap(current).find((item) => item.url === `${origin}/pt/cases/${slug.pt}`)?.alternates,
      ).toEqual({
        languages: {
          pt: `${origin}/pt/cases/${slug.pt}`,
          en: `${origin}/en/cases/${slug.en}`,
        },
      });
      expect(nativeLoads).toBe(0);
    } finally {
      installPayloadProvider(async () => fixture.payload);
    }
  });

  it('throws for real public intent with missing captured structural coverage rather than pretending never-published', async () => {
    const missing = structuredClone(await capture());
    delete missing.subjects[`professional-profiles/${id('professional-profiles', 'pt')}`];
    const count = vi.spyOn(fixture.payload.db, 'count');
    try {
      await expect(readPublicIndex(missing)).rejects.toThrow('Confirmed public index unavailable');
      expect(count).toHaveBeenCalled();
    } finally {
      count.mockRestore();
    }
  });

  it('rejects malformed or absent Root, duplicate structural locale and broken case aggregate without empty fallback', async () => {
    const root = await capture();
    const malformed = structuredClone(root);
    malformed.subjects[`professional-profiles/${id('professional-profiles', 'pt')}`].value = {
      kind: 'profile',
      locale: 'pt',
      profile: {},
    };
    const duplicate = structuredClone(root);
    duplicate.subjects[`professional-profiles/${randomUUID()}`] = structuredClone(
      duplicate.subjects[`professional-profiles/${id('professional-profiles', 'pt')}`],
    );
    const brokenCases = structuredClone(root);
    brokenCases.subjects[`case-content/${ptCaseId}`].value = {
      kind: 'case',
      locale: 'pt',
    };
    const noAggregate = structuredClone(root);
    for (const key of Object.keys(noAggregate.subjects))
      if (key.startsWith('cases/') || key.startsWith('case-content/'))
        delete noAggregate.subjects[key];
    let nativeLoads = 0;
    installPayloadProvider(async () => {
      nativeLoads++;
      throw new Error('Malformed positive coverage has no Native body fallback.');
    });
    try {
      for (const invalid of [
        null,
        { ...root, generation: 'invalid' },
        malformed,
        duplicate,
        brokenCases,
        noAggregate,
      ])
        await expect(readPublicIndex(invalid as never)).rejects.toThrow(
          'Confirmed public index unavailable',
        );
      expect(nativeLoads).toBe(0);
    } finally {
      installPayloadProvider(async () => fixture.payload);
    }
  });
});
