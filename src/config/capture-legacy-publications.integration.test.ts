import type { PublicationUpdate } from '@/payload-types';
import { bootstrapLegacyPublications } from './bootstrap-publications';
import { resolveCaseRoute } from '@/features/cases/server';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { createEditorialPayloadFixture } from '../../testing/fixtures/editorial-payload';
import {
  casePublicationFixture,
  mediaMetadataFixture,
  observedRequest,
  profilePublicationFixture,
  navigationFixture,
} from '../../testing/fixtures/editorial-lifecycle';
import { clearStructuralFixture } from '../../testing/fixtures/editorial-payload';
import { type PostgresAdapter } from '@payloadcms/db-postgres';
import * as editorialFieldsMigration from '../migrations/20261030_190345_e2_editorial_presentation_fields';
import { captureLegacyPublications } from './capture-legacy-publications';
let fixture: Awaited<ReturnType<typeof createEditorialPayloadFixture>>;
beforeAll(async () => {
  fixture = await createEditorialPayloadFixture('legacy-capture-boundary');
});

it('captures legacy structural publications before future nullable columns exist and keeps private versions intact', async () => {
  await clearStructuralFixture(fixture.payload);
  const image = await mediaMetadataFixture(fixture.payload);
  const pdf = await mediaMetadataFixture(fixture.payload, 'pdf');
  const profile = await fixture.payload.create({
    collection: 'professional-profiles',
    data: {
      ...profilePublicationFixture(image.id, pdf.id),
      locale: 'pt',
      _status: 'published',
    } as never,
    req: await fixture.request(),
    overrideAccess: false,
  });
  const navigation = await fixture.payload.create({
    collection: 'site-navigation',
    data: { ...navigationFixture(), locale: 'pt', _status: 'published' } as never,
    req: await fixture.request(),
    overrideAccess: false,
  });
  await fixture.payload.update({
    collection: 'professional-profiles',
    id: profile.id,
    draft: true,
    data: { identity: { name: 'PRIVATE newer structural profile' }, _status: 'draft' },
    req: await observedRequest('professional-profiles', profile.id, await fixture.request()),
    overrideAccess: false,
  });
  await fixture.payload.update({
    collection: 'site-navigation',
    id: navigation.id,
    draft: true,
    data: { header: { brandLabel: 'PRIVATE newer structural navigation' }, _status: 'draft' },
    req: await observedRequest('site-navigation', navigation.id, await fixture.request()),
    overrideAccess: false,
  });
  const ids = [profile.id, navigation.id];
  const versionIds = async () =>
    Promise.all(
      (['professional-profiles', 'site-navigation'] as const).map(async (collection, index) =>
        (
          await fixture.payload.findVersions({
            collection,
            where: { parent: { equals: ids[index] } },
            pagination: false,
            limit: 0,
            depth: 0,
            overrideAccess: false,
            req: await fixture.request(),
          })
        ).docs
          .map((version) => version.id)
          .sort(),
      ),
    );
  const before = await versionIds();
  for (const [collection, id] of [
    ['professional-profiles', profile.id],
    ['site-navigation', navigation.id],
  ] as const) {
    await fixture.payload.db.deleteMany({
      collection: 'publication-updates',
      where: { subjectId: { equals: id } },
    });
    await fixture.payload.db.updateOne({
      collection,
      id,
      select: { id: true },
      data: { latestPublicationIntent: null, publicConfirmed: false },
    });
  }
  const req = await fixture.request();
  const transaction = await fixture.payload.db.beginTransaction();
  if (!transaction) throw new Error('Native transaction required');
  req.transactionID = transaction;
  const db = (fixture.payload.db as unknown as PostgresAdapter).sessions[String(transaction)]!.db;
  try {
    await editorialFieldsMigration.down({ db, payload: fixture.payload, req });
    const operationsBeforeCapture = new Set(
      (
        await fixture.payload.db.find<PublicationUpdate>({
          collection: 'publication-updates',
          select: { id: true },
          pagination: false,
          limit: 0,
          req,
        })
      ).docs.map((operation) => operation.id),
    );
    const captured = await captureLegacyPublications(req);
    const allOperations = await fixture.payload.db.find<PublicationUpdate>({
      collection: 'publication-updates',
      select: { id: true },
      pagination: false,
      limit: 0,
      req,
    });
    // The migration also captures eligible cases left by unrelated feature suites.
    expect(
      allOperations.docs.filter((operation) => !operationsBeforeCapture.has(operation.id)),
    ).toHaveLength(captured);
    const operations = await fixture.payload.db.find<PublicationUpdate>({
      collection: 'publication-updates',
      where: { subjectId: { in: ids } },
      pagination: false,
      limit: 0,
      req,
    });
    expect(operations.docs).toHaveLength(2);
    expect(operations.docs.find((operation) => operation.subjectId === profile.id)).toMatchObject({
      targetRevision: profile.editorialRevision,
      target: {
        profile: {
          identity: { name: 'Synthetic name' },
          approach: { methods: [{ keywords: null }] },
          about: { journeyEyebrow: null, approachEyebrow: null, inMotionEyebrow: null },
        },
      },
    });
    expect(
      operations.docs.find((operation) => operation.subjectId === navigation.id),
    ).toMatchObject({
      targetRevision: navigation.editorialRevision,
      target: { navigation: { header: { brandLabel: 'Synthetic brandLabel' } } },
    });
    expect(JSON.stringify(operations.docs.map((operation) => operation.target))).not.toContain(
      'PRIVATE',
    );
    await editorialFieldsMigration.up({ db, payload: fixture.payload, req });
  } finally {
    await fixture.payload.db.rollbackTransaction(transaction);
    delete req.transactionID;
  }
  expect(await versionIds()).toEqual(before);
  expect(
    (
      await fixture.payload.findByID({
        collection: 'professional-profiles',
        id: profile.id,
        draft: true,
        depth: 0,
        overrideAccess: false,
        req: await fixture.request(),
      })
    ).identity?.name,
  ).toBe('PRIVATE newer structural profile');
  expect(
    (
      await fixture.payload.findByID({
        collection: 'site-navigation',
        id: navigation.id,
        draft: true,
        depth: 0,
        overrideAccess: false,
        req: await fixture.request(),
      })
    ).header?.brandLabel,
  ).toBe('PRIVATE newer structural navigation');
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
