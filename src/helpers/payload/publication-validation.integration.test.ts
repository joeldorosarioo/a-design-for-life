import { afterAll, beforeAll, beforeEach, expect, it } from 'vitest';
import {
  clearStructuralFixture,
  createEditorialPayloadFixture,
} from '../../../testing/fixtures/editorial-payload';
import {
  casePublicationFixture,
  mediaMetadataFixture,
  observedRequest,
} from '../../../testing/fixtures/editorial-lifecycle';
import { editorialHead } from './editorial-revision';
let fixture: Awaited<ReturnType<typeof createEditorialPayloadFixture>>;
beforeAll(async () => {
  fixture = await createEditorialPayloadFixture('e1.4-effective-publication');
});
beforeEach(async () => {
  await clearStructuralFixture(fixture.payload);
});
afterAll(async () => {
  await fixture?.payload.destroy();
});
async function identity() {
  return fixture.payload.create({
    collection: 'cases',
    data: { internalTitle: 'Synthetic effective publication' },
    req: await fixture.request(),
    overrideAccess: false,
  });
}

it('native create with draft:true and explicit published status stays a private incomplete draft', async () => {
  const parent = await identity();
  const created = await fixture.payload.create({
    collection: 'case-content',
    data: { case: parent.id, locale: 'pt', _status: 'published' },
    draft: true,
    req: await fixture.request(),
    overrideAccess: false,
  });
  expect(created._status).toBe('draft');
  expect(
    (
      await fixture.payload.find({
        collection: 'case-content',
        where: { case: { equals: parent.id } },
        draft: false,
        depth: 0,
        overrideAccess: false,
      })
    ).totalDocs,
  ).toBe(0);
});
it('native update with draft:true cannot publish an incomplete case; ordinary draft saving remains allowed', async () => {
  const parent = await identity();
  const created = await fixture.payload.create({
    collection: 'case-content',
    data: { case: parent.id, locale: 'pt' },
    draft: true,
    req: await fixture.request(),
    overrideAccess: false,
  });
  const before = await editorialHead('case-content', created.id, await fixture.request());
  await expect(
    fixture.payload.update({
      collection: 'case-content',
      id: created.id,
      data: { _status: 'published' },
      draft: true,
      req: await observedRequest('case-content', created.id, await fixture.request()),
      overrideAccess: false,
    }),
  ).rejects.toMatchObject({
    status: 400,
    data: {
      errors: expect.arrayContaining([
        expect.objectContaining({ path: 'title' }),
        expect.objectContaining({ path: 'cover.media' }),
      ]),
    },
  });
  expect(
    (await editorialHead('case-content', created.id, await fixture.request())).editorialRevision,
  ).toBe(before.editorialRevision);
  expect(
    (
      await fixture.payload.find({
        collection: 'case-content',
        where: { case: { equals: parent.id } },
        draft: false,
        depth: 0,
        overrideAccess: false,
      })
    ).totalDocs,
  ).toBe(0);
  const saved = await fixture.payload.update({
    collection: 'case-content',
    id: created.id,
    data: { title: 'Still incomplete draft', _status: 'draft' },
    draft: true,
    req: await observedRequest('case-content', created.id, await fixture.request()),
    overrideAccess: false,
  });
  expect(saved).toMatchObject({ _status: 'draft', title: 'Still incomplete draft' });
});
it('invalid effective publication with draft:true preserves the previous public case, draft, head and versions', async () => {
  const parent = await identity();
  const image = await mediaMetadataFixture(fixture.payload);
  const published = await fixture.payload.create({
    collection: 'case-content',
    data: {
      ...casePublicationFixture(image.id),
      case: parent.id,
      locale: 'pt',
      _status: 'published',
    } as never,
    depth: 0,
    req: await fixture.request(),
    overrideAccess: false,
  });
  const draft = await fixture.payload.update({
    collection: 'case-content',
    id: published.id,
    data: { title: 'Private incomplete case', summary: '', _status: 'draft' },
    draft: true,
    depth: 0,
    req: await observedRequest('case-content', published.id, await fixture.request()),
    overrideAccess: false,
  });
  const before = await editorialHead('case-content', published.id, await fixture.request());
  const versionsBefore = await fixture.payload.findVersions({
    collection: 'case-content',
    where: { parent: { equals: published.id } },
    req: await fixture.request(),
    overrideAccess: false,
  });
  await expect(
    fixture.payload.update({
      collection: 'case-content',
      id: published.id,
      data: { _status: 'published' },
      draft: true,
      req: await observedRequest('case-content', published.id, await fixture.request()),
      overrideAccess: false,
    }),
  ).rejects.toMatchObject({
    status: 400,
    data: { errors: expect.arrayContaining([expect.objectContaining({ path: 'summary' })]) },
  });
  expect(
    (await editorialHead('case-content', published.id, await fixture.request())).editorialRevision,
  ).toBe(before.editorialRevision);
  expect(
    await fixture.payload.findByID({
      collection: 'case-content',
      id: published.id,
      draft: false,
      depth: 0,
      overrideAccess: false,
    }),
  ).toMatchObject({ _status: 'published', title: 'Synthetic title', summary: 'Synthetic summary' });
  expect(
    await fixture.payload.findByID({
      collection: 'case-content',
      id: published.id,
      draft: true,
      depth: 0,
      req: await fixture.request(),
      overrideAccess: false,
    }),
  ).toMatchObject({
    _status: 'draft',
    title: 'Private incomplete case',
    summary: '',
    editorialRevision: draft.editorialRevision,
  });
  expect(
    (
      await fixture.payload.findVersions({
        collection: 'case-content',
        where: { parent: { equals: published.id } },
        req: await fixture.request(),
        overrideAccess: false,
      })
    ).totalDocs,
  ).toBe(versionsBefore.totalDocs);
});
it.each(['site-navigation', 'professional-profiles'] as const)(
  'draft:true cannot bypass required fields when explicitly publishing %s',
  async (collection) => {
    const created = await fixture.payload.create({
      collection,
      data: { locale: 'pt' },
      draft: true,
      req: await fixture.request(),
      overrideAccess: false,
    });
    const before = await editorialHead(collection, created.id, await fixture.request());
    await expect(
      fixture.payload.update({
        collection,
        id: created.id,
        data: { _status: 'published' },
        draft: true,
        req: await observedRequest(collection, created.id, await fixture.request()),
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
      (await editorialHead(collection, created.id, await fixture.request())).editorialRevision,
    ).toBe(before.editorialRevision);
    expect(
      (await fixture.payload.find({ collection, draft: false, depth: 0, overrideAccess: false }))
        .totalDocs,
    ).toBe(0);
  },
);
it('valid explicit publication with draft:true retains the native published intent', async () => {
  const parent = await identity();
  const image = await mediaMetadataFixture(fixture.payload);
  const created = await fixture.payload.create({
    collection: 'case-content',
    data: {
      ...casePublicationFixture(image.id),
      case: parent.id,
      locale: 'pt',
      _status: 'draft',
    } as never,
    draft: true,
    req: await fixture.request(),
    overrideAccess: false,
  });
  const published = await fixture.payload.update({
    collection: 'case-content',
    id: created.id,
    data: { _status: 'published' },
    draft: true,
    req: await observedRequest('case-content', created.id, await fixture.request()),
    overrideAccess: false,
  });
  expect(published._status).toBe('published');
  expect(
    await fixture.payload.findByID({
      collection: 'case-content',
      id: created.id,
      draft: false,
      depth: 0,
      overrideAccess: false,
    }),
  ).toMatchObject({ _status: 'published', title: 'Synthetic title' });
});
