import { afterAll, beforeAll, expect, it } from 'vitest';
import { createEditorialPayloadFixture } from '../../../../../testing/fixtures/editorial-payload';
let fixture: Awaited<ReturnType<typeof createEditorialPayloadFixture>>;
beforeAll(async () => {
  fixture = await createEditorialPayloadFixture('e1.4-publication');
});
afterAll(async () => {
  await fixture?.payload.destroy();
});
it('rejects incomplete publication with individual field errors instead of exposing an empty case', async () => {
  const shared = await fixture.payload.create({
    collection: 'cases',
    data: { internalTitle: 'Synthetic lifecycle' },
    overrideAccess: false,
    req: await fixture.request(),
  });
  await expect(
    fixture.payload.create({
      collection: 'case-content',
      data: { case: shared.id, locale: 'pt', _status: 'published' },
      overrideAccess: false,
      req: await fixture.request(),
    }),
  ).rejects.toMatchObject({
    status: 400,
    data: {
      errors: expect.arrayContaining([
        expect.objectContaining({ path: 'title' }),
        expect.objectContaining({ path: 'summary' }),
        expect.objectContaining({ path: 'cover.media' }),
        expect.objectContaining({ path: 'role' }),
        expect.objectContaining({ path: 'slug' }),
        expect.objectContaining({ path: 'sections' }),
      ]),
    },
  });
  const publicDocs = await fixture.payload.find({
    collection: 'case-content',
    where: { case: { equals: shared.id } },
    overrideAccess: false,
    draft: false,
    depth: 0,
  });
  expect(publicDocs.totalDocs).toBe(0);
});

import {
  navigationFixture,
  observedRequest,
  mediaMetadataFixture,
  casePublicationFixture,
} from '../../../../../testing/fixtures/editorial-lifecycle';
import { clearStructuralFixture } from '../../../../../testing/fixtures/editorial-payload';
it('navigation publication is independent and normal draft save preserves the published document', async () => {
  await clearStructuralFixture(fixture.payload);
  const pt = await fixture.payload.create({
    collection: 'site-navigation',
    data: { locale: 'pt' },
    draft: true,
    overrideAccess: false,
    req: await fixture.request(),
  });
  const en = await fixture.payload.create({
    collection: 'site-navigation',
    data: { locale: 'en' },
    draft: true,
    overrideAccess: false,
    req: await fixture.request(),
  });
  await fixture.payload.update({
    collection: 'site-navigation',
    id: pt.id,
    data: { ...navigationFixture(), _status: 'published' },
    req: await observedRequest('site-navigation', pt.id, await fixture.request()),
    overrideAccess: false,
  });
  const publicDocs = await fixture.payload.find({
    collection: 'site-navigation',
    draft: false,
    overrideAccess: false,
    depth: 0,
  });
  expect(publicDocs.docs.map((doc) => doc.locale)).toEqual(['pt']);
  await fixture.payload.update({
    collection: 'site-navigation',
    id: pt.id,
    data: { header: { brandLabel: '' }, _status: 'draft' },
    draft: true,
    req: await observedRequest('site-navigation', pt.id, await fixture.request()),
    overrideAccess: false,
  });
  expect(
    (
      await fixture.payload.findByID({
        collection: 'site-navigation',
        id: pt.id,
        draft: false,
        depth: 0,
        overrideAccess: false,
      })
    ).header?.brandLabel,
  ).toBe('Synthetic brandLabel');
  expect(
    (
      await fixture.payload.findByID({
        collection: 'site-navigation',
        id: en.id,
        draft: true,
        req: await fixture.request(),
        overrideAccess: false,
      })
    )._status,
  ).toBe('draft');
  await expect(
    fixture.payload.update({
      collection: 'site-navigation',
      id: pt.id,
      data: { _status: 'draft' },
      req: await observedRequest('site-navigation', pt.id, await fixture.request()),
      overrideAccess: false,
    }),
  ).rejects.toMatchObject({ status: 400 });
});
it('case PT publishes independently, draft and invalid publication preserve public content, withdrawal is allowed', async () => {
  const shared = await fixture.payload.create({
    collection: 'cases',
    data: { internalTitle: 'Synthetic publication' },
    req: await fixture.request(),
    overrideAccess: false,
  });
  const media = await mediaMetadataFixture(fixture.payload);
  const pt = await fixture.payload.create({
    collection: 'case-content',
    data: { case: shared.id, locale: 'pt' },
    draft: true,
    req: await fixture.request(),
    overrideAccess: false,
  });
  const en = await fixture.payload.create({
    collection: 'case-content',
    data: { case: shared.id, locale: 'en' },
    draft: true,
    req: await fixture.request(),
    overrideAccess: false,
  });
  const firstPublication = await fixture.payload.update({
    collection: 'case-content',
    id: pt.id,
    data: { ...casePublicationFixture(media.id), _status: 'published' } as never,
    req: await observedRequest('case-content', pt.id, await fixture.request()),
    overrideAccess: false,
  });
  const publicDocs = await fixture.payload.find({
    collection: 'case-content',
    where: { case: { equals: shared.id } },
    draft: false,
    overrideAccess: false,
    depth: 0,
  });
  expect(publicDocs.docs.map((doc) => doc.locale)).toEqual(['pt']);
  await fixture.payload.update({
    collection: 'case-content',
    id: pt.id,
    data: { title: 'Incomplete draft', summary: '', _status: 'draft' },
    draft: true,
    req: await observedRequest('case-content', pt.id, await fixture.request()),
    overrideAccess: false,
  });
  expect(
    (
      await fixture.payload.findByID({
        collection: 'case-content',
        id: pt.id,
        draft: false,
        overrideAccess: false,
        depth: 0,
      })
    ).title,
  ).toBe('Synthetic title');
  const olderPublic = await fixture.payload.findByID({
    collection: 'case-content',
    id: pt.id,
    draft: false,
    depth: 0,
    overrideAccess: false,
    req: await fixture.request(),
  });
  expect(olderPublic.editorialRevision).toBe(firstPublication.editorialRevision);
  await expect(
    fixture.payload.update({
      collection: 'case-content',
      id: pt.id,
      draft: true,
      data: {
        title: 'Old published form',
        editorialRevision: olderPublic.editorialRevision,
        leaseToken: olderPublic.leaseToken,
      },
      req: await fixture.request(),
      overrideAccess: false,
    }),
  ).rejects.toMatchObject({ code: 'stale-revision' });
  await expect(
    fixture.payload.update({
      collection: 'case-content',
      id: pt.id,
      data: { summary: '', _status: 'published' },
      req: await observedRequest('case-content', pt.id, await fixture.request()),
      overrideAccess: false,
    }),
  ).rejects.toMatchObject({
    status: 400,
    data: { errors: expect.arrayContaining([expect.objectContaining({ path: 'summary' })]) },
  });
  expect(
    (
      await fixture.payload.findByID({
        collection: 'case-content',
        id: pt.id,
        draft: false,
        overrideAccess: false,
        depth: 0,
      })
    ).title,
  ).toBe('Synthetic title');
  await fixture.payload.update({
    collection: 'case-content',
    id: en.id,
    data: { ...casePublicationFixture(media.id), _status: 'published' } as never,
    req: await observedRequest('case-content', en.id, await fixture.request()),
    overrideAccess: false,
  });
  await fixture.payload.update({
    collection: 'case-content',
    id: pt.id,
    data: { _status: 'draft' },
    req: await observedRequest('case-content', pt.id, await fixture.request()),
    overrideAccess: false,
  });
  expect(
    (
      await fixture.payload.find({
        collection: 'case-content',
        where: { case: { equals: shared.id } },
        draft: false,
        overrideAccess: false,
        depth: 0,
      })
    ).docs.map((doc) => doc.locale),
  ).toEqual(['en']);
  expect(
    (
      await fixture.payload.findByID({
        collection: 'case-content',
        id: en.id,
        draft: true,
        req: await fixture.request(),
        overrideAccess: false,
      })
    )._status,
  ).toBe('published');
});

import { restoreCaseDraft } from '../../server/restore-case-draft';
import { publishCase } from '../../server/publish-case';
it('restores old published and draft versions only as new drafts without changing identity or the other locale', async () => {
  const shared = await fixture.payload.create({
    collection: 'cases',
    data: { internalTitle: 'Synthetic restore' },
    req: await fixture.request(),
    overrideAccess: false,
  });
  const media = await mediaMetadataFixture(fixture.payload);
  const doc = await fixture.payload.create({
    collection: 'case-content',
    data: { case: shared.id, locale: 'pt' },
    draft: true,
    req: await fixture.request(),
    overrideAccess: false,
  });
  const english = await fixture.payload.create({
    collection: 'case-content',
    data: { case: shared.id, locale: 'en', title: 'English untouched' },
    draft: true,
    req: await fixture.request(),
    overrideAccess: false,
  });
  await fixture.payload.update({
    collection: 'case-content',
    id: doc.id,
    data: { ...casePublicationFixture(media.id), _status: 'published' } as never,
    req: await observedRequest('case-content', doc.id, await fixture.request()),
    overrideAccess: false,
  });
  const versions = await fixture.payload.findVersions({
    collection: 'case-content',
    where: { parent: { equals: doc.id } },
    sort: 'createdAt',
    limit: 100,
    depth: 0,
    overrideAccess: false,
    req: await fixture.request(),
  });
  const oldDraft = versions.docs.find((v) => v.version._status === 'draft')!;
  const oldPublished = versions.docs.find((v) => v.version._status === 'published')!;
  await fixture.payload.update({
    collection: 'case-content',
    id: doc.id,
    data: { title: 'Latest public title', _status: 'published' },
    req: await observedRequest('case-content', doc.id, await fixture.request()),
    overrideAccess: false,
  });
  for (const version of [oldPublished, oldDraft]) {
    const req = await observedRequest('case-content', doc.id, await fixture.request());
    const expectedRevision = req.headers.get('x-editorial-revision')!;
    const result = await restoreCaseDraft(
      { contentId: doc.id, versionId: version.id, expectedRevision },
      req,
    );
    expect(result).toMatchObject({ ok: true, value: { revision: expect.any(String) } });
    const draft = await fixture.payload.findByID({
      collection: 'case-content',
      id: doc.id,
      draft: true,
      depth: 0,
      overrideAccess: false,
      req: await fixture.request(),
    });
    expect(draft).toMatchObject({
      _status: 'draft',
      case: shared.id,
      locale: 'pt',
      title: version.version.title ?? null,
    });
    expect(draft.editorialRevision).not.toBe(expectedRevision);
    expect(
      (
        await fixture.payload.findByID({
          collection: 'case-content',
          id: doc.id,
          draft: false,
          depth: 0,
          overrideAccess: false,
        })
      ).title,
    ).toBe('Latest public title');
    expect(
      (
        await fixture.payload.findByID({
          collection: 'case-content',
          id: english.id,
          draft: true,
          depth: 0,
          overrideAccess: false,
          req: await fixture.request(),
        })
      ).title,
    ).toBe('English untouched');
  }
  await expect(
    fixture.payload.restoreVersion({
      collection: 'case-content',
      id: oldPublished.id,
      draft: true,
      overrideAccess: true,
      req: await observedRequest('case-content', doc.id, await fixture.request()),
    }),
  ).rejects.toMatchObject({ status: 400 });
  const req = await observedRequest('case-content', doc.id, await fixture.request());
  expect(
    await publishCase(
      { contentId: doc.id, expectedRevision: req.headers.get('x-editorial-revision')! },
      req,
    ),
  ).toMatchObject({ ok: false, error: { code: 'invalid-input' } });
  expect(
    (
      await fixture.payload.findByID({
        collection: 'case-content',
        id: doc.id,
        draft: false,
        depth: 0,
        overrideAccess: false,
      })
    ).title,
  ).toBe('Latest public title');
});

it('draft writes serialize on the authoritative main head with one version winner and validation rollback', async () => {
  const shared = await fixture.payload.create({
    collection: 'cases',
    data: { internalTitle: 'Draft CAS' },
    req: await fixture.request(),
    overrideAccess: false,
  });
  const doc = await fixture.payload.create({
    collection: 'case-content',
    data: { case: shared.id, locale: 'pt' },
    draft: true,
    req: await fixture.request(),
    overrideAccess: false,
  });
  const before = await fixture.payload.findVersions({
    collection: 'case-content',
    where: { parent: { equals: doc.id } },
    req: await fixture.request(),
    overrideAccess: false,
  });
  const requests = await Promise.all([fixture.request(), fixture.request()]);
  for (const req of requests)
    req.headers = new Headers({
      'x-editorial-revision': doc.editorialRevision!,
      'x-editorial-lease': doc.leaseToken!,
    });
  const results = await Promise.allSettled(
    requests.map((req, index) =>
      fixture.payload.update({
        collection: 'case-content',
        id: doc.id,
        data: { title: `Draft winner ${index}`, _status: 'draft' },
        draft: true,
        req,
        overrideAccess: false,
      }),
    ),
  );
  expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
  expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1);
  const after = await fixture.payload.findVersions({
    collection: 'case-content',
    where: { parent: { equals: doc.id } },
    req: await fixture.request(),
    overrideAccess: false,
  });
  expect(after.totalDocs).toBe(before.totalDocs + 1);
  const invalid = await observedRequest('case-content', doc.id, await fixture.request());
  const expected = invalid.headers.get('x-editorial-revision');
  await expect(
    fixture.payload.update({
      collection: 'case-content',
      id: doc.id,
      data: { _status: 'published' },
      req: invalid,
      overrideAccess: false,
    }),
  ).rejects.toMatchObject({ status: 400 });
  const current = await fixture.payload.findByID({
    collection: 'case-content',
    id: doc.id,
    draft: true,
    depth: 0,
    req: await fixture.request(),
    overrideAccess: false,
  });
  expect(current.editorialRevision).toBe(expected);
});
it('publication rejects missing active typed-link target and missing image-use alt on their exact paths', async () => {
  const shared = await fixture.payload.create({
    collection: 'cases',
    data: { internalTitle: 'Publication boundaries' },
    req: await fixture.request(),
    overrideAccess: false,
  });
  const media = await mediaMetadataFixture(fixture.payload);
  const data = casePublicationFixture(media.id);
  const paragraph = data.sections[0].blocks[0].content.root.children[0];
  const link = {
    type: 'link',
    version: 3,
    direction: null,
    format: '',
    indent: 0,
    fields: { linkType: 'custom', destination: 'page' },
    children: [paragraph.children[0]],
  };
  const linked = {
    ...data,
    sections: [
      {
        blocks: [
          {
            blockType: 'text',
            content: {
              root: {
                ...data.sections[0].blocks[0].content.root,
                children: [{ ...paragraph, children: [link] }],
              },
            },
          },
        ],
      },
    ],
  };
  for (const [value, path] of [
    [linked, 'sections.0.blocks.0.content.root.children.0.children.0.fields.page'],
    [{ ...data, cover: { media: media.id, decorative: false, alt: '' } }, 'cover.alt'],
    [
      { ...data, cover: { media: media.id, decorative: true, alt: 'Incorrect decorative text' } },
      'cover.alt',
    ],
    [{ ...data, slug: 'INVALID slug' }, 'slug'],
  ] as const) {
    await expect(
      fixture.payload.create({
        collection: 'case-content',
        data: { ...value, case: shared.id, locale: 'pt', _status: 'published' } as never,
        req: await fixture.request(),
        overrideAccess: false,
      }),
    ).rejects.toMatchObject({
      status: 400,
      data: { errors: expect.arrayContaining([expect.objectContaining({ path })]) },
    });
  }
});
it.each(['site-navigation', 'professional-profiles'] as const)(
  'requires global fields before first publication of %s',
  async (collection) => {
    await clearStructuralFixture(fixture.payload);
    const doc = await fixture.payload.create({
      collection,
      data: { locale: 'pt' },
      draft: true,
      req: await fixture.request(),
      overrideAccess: false,
    });
    await expect(
      fixture.payload.update({
        collection,
        id: doc.id,
        data: { _status: 'published' },
        req: await observedRequest(collection, doc.id, await fixture.request()),
        overrideAccess: false,
      }),
    ).rejects.toMatchObject({
      status: 400,
      data: {
        errors: expect.arrayContaining([
          expect.objectContaining({
            path: collection === 'site-navigation' ? 'header.brandLabel' : 'identity.name',
          }),
        ]),
      },
    });
    expect(
      (await fixture.payload.find({ collection, draft: false, depth: 0, overrideAccess: false }))
        .totalDocs,
    ).toBe(0);
  },
);

it('the publication command respects its expected revision and never fetches a missing caller lease', async () => {
  const shared = await fixture.payload.create({
    collection: 'cases',
    data: { internalTitle: 'Command provenance' },
    req: await fixture.request(),
    overrideAccess: false,
  });
  const media = await mediaMetadataFixture(fixture.payload);
  const original = await fixture.payload.create({
    collection: 'case-content',
    data: { case: shared.id, locale: 'pt' },
    draft: true,
    req: await fixture.request(),
    overrideAccess: false,
  });
  const draft = await fixture.payload.update({
    collection: 'case-content',
    id: original.id,
    data: { ...casePublicationFixture(media.id), _status: 'draft' } as never,
    draft: true,
    req: await observedRequest('case-content', original.id, await fixture.request()),
    overrideAccess: false,
  });
  expect(
    await publishCase(
      { contentId: draft.id, expectedRevision: original.editorialRevision! },
      await observedRequest('case-content', draft.id, await fixture.request()),
    ),
  ).toMatchObject({ ok: false, error: { code: 'stale-revision' } });
  expect(
    await publishCase(
      { contentId: draft.id, expectedRevision: draft.editorialRevision! },
      await fixture.request(),
    ),
  ).toMatchObject({ ok: false, error: { code: 'locked' } });
});

import { profilePublicationFixture } from '../../../../../testing/fixtures/editorial-lifecycle';
import {
  publishProfile,
  restoreProfileDraft,
  getPublishedProfile,
} from '@/features/professional-profile/server';
it('profile publications, drafts, permanent structural publication and recovery remain local to the chosen locale', async () => {
  await clearStructuralFixture(fixture.payload);
  const image = await mediaMetadataFixture(fixture.payload);
  const pdf = await mediaMetadataFixture(fixture.payload, 'pdf');
  const pt = await fixture.payload.create({
    collection: 'professional-profiles',
    data: { locale: 'pt' },
    draft: true,
    req: await fixture.request(),
    overrideAccess: false,
  });
  const en = await fixture.payload.create({
    collection: 'professional-profiles',
    data: { locale: 'en' },
    draft: true,
    req: await fixture.request(),
    overrideAccess: false,
  });
  const filled = await fixture.payload.update({
    collection: 'professional-profiles',
    id: pt.id,
    data: { ...profilePublicationFixture(image.id, pdf.id), _status: 'draft' },
    draft: true,
    req: await observedRequest('professional-profiles', pt.id, await fixture.request()),
    overrideAccess: false,
  });
  const result = await publishProfile(
    { contentId: pt.id, expectedRevision: filled.editorialRevision! },
    await observedRequest('professional-profiles', pt.id, await fixture.request()),
  );
  expect(result).toMatchObject({
    ok: true,
    value: { contentId: pt.id, locale: 'pt', status: 'published', revision: expect.any(String) },
  });
  const versions = await fixture.payload.findVersions({
    collection: 'professional-profiles',
    where: { parent: { equals: pt.id } },
    limit: 100,
    depth: 0,
    req: await fixture.request(),
    overrideAccess: false,
  });
  const published = versions.docs.find((v) => v.version._status === 'published')!;
  await expect(
    fixture.payload.update({
      collection: 'professional-profiles',
      id: pt.id,
      data: { _status: 'draft' },
      req: await observedRequest('professional-profiles', pt.id, await fixture.request()),
      overrideAccess: true,
    }),
  ).rejects.toMatchObject({ status: 400 });
  await fixture.payload.update({
    collection: 'professional-profiles',
    id: pt.id,
    data: { identity: { name: '' }, _status: 'draft' },
    draft: true,
    req: await observedRequest('professional-profiles', pt.id, await fixture.request()),
    overrideAccess: false,
  });
  expect(await getPublishedProfile('pt', fixture.payload)).toMatchObject({
    ok: true,
    value: { locale: 'pt', identity: { name: 'Synthetic name' } },
  });
  expect(await getPublishedProfile('en', fixture.payload)).toMatchObject({
    ok: false,
    error: { code: 'unavailable' },
  });
  const req = await observedRequest('professional-profiles', pt.id, await fixture.request());
  expect(
    await restoreProfileDraft(
      {
        contentId: pt.id,
        versionId: published.id,
        expectedRevision: req.headers.get('x-editorial-revision')!,
      },
      req,
    ),
  ).toMatchObject({ ok: true });
  expect(
    await fixture.payload.findByID({
      collection: 'professional-profiles',
      id: pt.id,
      draft: true,
      depth: 0,
      req: await fixture.request(),
      overrideAccess: false,
    }),
  ).toMatchObject({ _status: 'draft', locale: 'pt', identity: { name: 'Synthetic name' } });
  expect(
    (
      await fixture.payload.findByID({
        collection: 'professional-profiles',
        id: en.id,
        draft: true,
        depth: 0,
        req: await fixture.request(),
        overrideAccess: false,
      })
    )._status,
  ).toBe('draft');
  expect(await getPublishedProfile('pt', fixture.payload)).toMatchObject({
    ok: true,
    value: { identity: { name: 'Synthetic name' } },
  });
});

it('normalizes only the native empty row count for arrays while draft/publication rules stay intact', async () => {
  const shared = await fixture.payload.create({
    collection: 'cases',
    data: { internalTitle: 'Native empty count' },
    req: await fixture.request(),
    overrideAccess: false,
  });
  const doc = await fixture.payload.create({
    collection: 'case-content',
    data: { case: shared.id, locale: 'pt' },
    draft: true,
    req: await fixture.request(),
    overrideAccess: false,
  });
  expect(
    await fixture.payload.update({
      collection: 'case-content',
      id: doc.id,
      data: { sections: 0 } as never,
      draft: true,
      req: await observedRequest('case-content', doc.id, await fixture.request()),
      overrideAccess: false,
    }),
  ).toMatchObject({ sections: [] });
  await expect(
    fixture.payload.update({
      collection: 'case-content',
      id: doc.id,
      data: { sections: 1 } as never,
      draft: true,
      req: await observedRequest('case-content', doc.id, await fixture.request()),
      overrideAccess: false,
    }),
  ).rejects.toMatchObject({ status: 400 });
  await expect(
    fixture.payload.update({
      collection: 'case-content',
      id: doc.id,
      data: { sections: 0, _status: 'published' } as never,
      req: await observedRequest('case-content', doc.id, await fixture.request()),
      overrideAccess: false,
    }),
  ).rejects.toMatchObject({ status: 400 });
});
