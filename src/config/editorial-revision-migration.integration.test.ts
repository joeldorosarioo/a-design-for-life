import { confirmTestPublication } from '../../testing/fixtures/confirmed-publication';
import { readPublicRoot } from '@/helpers/payload/public-root';
import { runtimePublication } from '@/helpers/payload/publication-runtime';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { createEditorialPayloadFixture } from '../../testing/fixtures/editorial-payload';
import {
  casePublicationFixture,
  mediaMetadataFixture,
  observedRequest,
} from '../../testing/fixtures/editorial-lifecycle';
import * as leases from '../migrations/20261030_040829_editorial_revision_and_leases';
import * as snapshots from '../migrations/20261030_042607_editorial_snapshot_revision';
import { acquireEditorialLease, editorialHead } from '../helpers/payload/editorial-revision';
let fixture: Awaited<ReturnType<typeof createEditorialPayloadFixture>>;
beforeAll(async () => {
  fixture = await createEditorialPayloadFixture('e1.4-migration');
});
afterAll(async () => {
  await fixture?.payload.destroy();
});
it('native migration roundtrip backfills independent head/content markers for pre-existing publication and latest draft', async () => {
  const parent = await fixture.payload.create({
    collection: 'cases',
    data: { internalTitle: 'Legacy metadata' },
    req: await fixture.request(),
    overrideAccess: false,
  });
  const media = await mediaMetadataFixture(fixture.payload);
  const doc = await fixture.payload.create({
    collection: 'case-content',
    data: {
      ...casePublicationFixture(media.id),
      case: parent.id,
      locale: 'pt',
      _status: 'published',
    } as never,
    req: await fixture.request(),
    overrideAccess: false,
  });
  await confirmTestPublication(doc, await fixture.request());
  const confirmedBefore = await readPublicRoot(runtimePublication().directory);
  expect(confirmedBefore?.subjects[`case-content/${doc.id}`]).toBeDefined();
  await fixture.payload.update({
    collection: 'case-content',
    id: doc.id,
    data: { title: 'Legacy private draft', _status: 'draft' },
    draft: true,
    req: await observedRequest('case-content', doc.id, await fixture.request()),
    overrideAccess: false,
  });
  const req = await fixture.request();
  const args = { db: fixture.payload.db.drizzle, payload: fixture.payload, req };
  // DDL runs only in the suite-owned tmpfs DB. The native migrations touch technical markers only.
  await snapshots.down(args);
  await leases.down(args);
  await leases.up(args);
  await snapshots.up(args);
  const publicDoc = await fixture.payload.findByID({
    collection: 'case-content',
    id: doc.id,
    draft: false,
    depth: 0,
    req: await fixture.request(),
    overrideAccess: false,
  });
  const draft = await fixture.payload.findByID({
    collection: 'case-content',
    id: doc.id,
    draft: true,
    depth: 0,
    req: await fixture.request(),
    overrideAccess: false,
  });
  const head = await editorialHead('case-content', doc.id, await fixture.request());
  expect(publicDoc.title).toBe('Synthetic title');
  expect(draft.title).toBe('Legacy private draft');
  expect(draft.editorialRevision).toBe(head.editorialRevision);
  expect(publicDoc.editorialRevision).not.toBe(head.editorialRevision);
  const lease = await acquireEditorialLease('case-content', doc.id, await fixture.request());
  expect(lease.editable).toBe(true);
  const updated = await fixture.payload.update({
    collection: 'case-content',
    id: doc.id,
    data: {
      title: 'Migrated editor can save',
      editorialRevision: draft.editorialRevision,
      leaseToken: lease.token,
    },
    draft: true,
    req: await fixture.request(),
    overrideAccess: false,
  });
  expect(updated.title).toBe('Migrated editor can save');
  expect(await readPublicRoot(runtimePublication().directory)).toEqual(confirmedBefore);
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
  ).toBe('Synthetic title');
});
