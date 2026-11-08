import { bootstrapLegacyPublications } from './bootstrap-publications';
import { resolveCaseRoute } from '@/features/cases/server';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { createEditorialPayloadFixture } from '../../testing/fixtures/editorial-payload';
import {
  casePublicationFixture,
  mediaMetadataFixture,
  observedRequest,
} from '../../testing/fixtures/editorial-lifecycle';
import { captureLegacyPublications } from './capture-legacy-publications';
let fixture: Awaited<ReturnType<typeof createEditorialPayloadFixture>>;
beforeAll(async () => {
  fixture = await createEditorialPayloadFixture('legacy-capture-boundary');
});
afterAll(async () => {
  await fixture?.payload.destroy();
});
it('captures the canonical previously published body while preserving a newer private draft', async () => {
  const parent = await fixture.payload.create({
    collection: 'cases',
    data: { internalTitle: 'Legacy canonical capture' },
    req: await fixture.request(),
    overrideAccess: false,
  });
  const media = await mediaMetadataFixture(fixture.payload);
  const published = await fixture.payload.create({
    collection: 'case-content',
    data: {
      ...casePublicationFixture(media.id),
      case: parent.id,
      locale: 'pt',
      slug: `legacy-${randomUUID()}`,
      title: 'Previously published baseline',
      _status: 'published',
    },
    req: await fixture.request(),
    overrideAccess: false,
  });
  const draft = await fixture.payload.update({
    collection: 'case-content',
    id: published.id,
    draft: true,
    data: { title: 'Newer private baseline draft', _status: 'draft' },
    req: await observedRequest('case-content', published.id, await fixture.request()),
    overrideAccess: false,
  });
  // A boundary fixture with the same additive-column values as an upgraded row.
  // The separate old-source upgrade harness proves real pre-migration data.
  for (const [collection, id] of [
    ['cases', parent.id],
    ['case-content', published.id],
  ] as const) {
    await fixture.payload.db.deleteMany({
      collection: 'publication-updates',
      where: { subjectId: { equals: id } },
    });
    await fixture.payload.db.updateOne({
      collection,
      where: { id: { equals: id } },
      data: { latestPublicationIntent: null, publicConfirmed: false },
    });
  }
  const req = await fixture.request();
  const tx = await fixture.payload.db.beginTransaction();
  if (!tx) throw new Error('Transaction required');
  req.transactionID = tx;
  try {
    await captureLegacyPublications(req);
    await fixture.payload.db.commitTransaction(tx);
  } catch (error) {
    await fixture.payload.db.rollbackTransaction(tx);
    throw error;
  } finally {
    delete req.transactionID;
  }
  const captured = await fixture.payload.find({
    collection: 'publication-updates',
    where: { subjectId: { equals: published.id } },
    overrideAccess: true,
  });
  expect(captured.totalDocs).toBe(1);
  expect(captured.docs[0]).toMatchObject({
    targetRevision: published.editorialRevision,
    state: 'update-pending',
    target: { kind: 'case', detail: { title: 'Previously published baseline' } },
  });
  expect(captured.docs[0]!.dependencies).toContain('legacy-bootstrap');
  await expect(
    fixture.payload.update({
      collection: 'cases',
      id: parent.id,
      data: { sortOrder: 99 },
      req: await observedRequest('cases', parent.id, await fixture.request()),
      overrideAccess: false,
    }),
  ).rejects.toMatchObject({ status: 503 });
  expect(
    await fixture.payload.findByID({
      collection: 'case-content',
      id: published.id,
      draft: true,
      req: await fixture.request(),
      overrideAccess: false,
    }),
  ).toMatchObject({
    title: 'Newer private baseline draft',
    editorialRevision: draft.editorialRevision,
  });
  await bootstrapLegacyPublications(await fixture.request());
  expect(await resolveCaseRoute('pt', published.slug!, fixture.payload)).toMatchObject({
    status: 200,
    case: { title: 'Previously published baseline' },
  });
  expect(await bootstrapLegacyPublications(await fixture.request())).toBe(0);
  expect(
    await fixture.payload.findByID({
      collection: 'case-content',
      id: published.id,
      draft: true,
      req: await fixture.request(),
      overrideAccess: false,
    }),
  ).toMatchObject({
    title: 'Newer private baseline draft',
    editorialRevision: draft.editorialRevision,
  });
  await expect(
    fixture.payload.update({
      collection: 'cases',
      id: parent.id,
      data: { sortOrder: 99 },
      req: await observedRequest('cases', parent.id, await fixture.request()),
      overrideAccess: false,
    }),
  ).resolves.toMatchObject({ sortOrder: 99 });
});
