import { afterAll, beforeAll, expect, it, vi } from 'vitest';
import { createLocalReq } from 'payload';
import type { Media } from '@/payload-types';
import { createEditorialPayloadFixture } from '../../../../testing/fixtures/editorial-payload';
import {
  mediaMetadataFixture,
  casePublicationFixture,
  observedRequest,
} from '../../../../testing/fixtures/editorial-lifecycle';
import { resolveMediaAccess } from './resolve-media-access';
let fixture: Awaited<ReturnType<typeof createEditorialPayloadFixture>>;
beforeAll(async () => {
  fixture = await createEditorialPayloadFixture('e1.6-media-row-races');
});
afterAll(async () => {
  await fixture?.payload.destroy();
});
function barrier() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
async function draft(mediaId: string, locale: 'pt' | 'en' = 'pt', caseId?: string) {
  const shared =
    caseId ??
    (
      await fixture.payload.create({
        collection: 'cases',
        data: { internalTitle: 'Synthetic transactional media' },
        req: await fixture.request(),
        overrideAccess: false,
      })
    ).id;
  return fixture.payload.create({
    collection: 'case-content',
    data: { case: shared, locale, ...casePublicationFixture(mediaId), _status: 'draft' },
    draft: true,
    req: await fixture.request(),
    overrideAccess: false,
  });
}
async function publish(id: string) {
  return fixture.payload.update({
    collection: 'case-content',
    id,
    data: { _status: 'published' },
    req: await observedRequest('case-content', id, await fixture.request()),
    overrideAccess: false,
  });
}
async function publicMedia(id: string) {
  return resolveMediaAccess(
    { mediaId: id, variant: 'original', preview: false },
    await createLocalReq({}, fixture.payload),
  );
}
it('publication holding the actual Media row makes concurrent trash lose without exposing a deleted asset', async () => {
  const media = await mediaMetadataFixture(fixture.payload);
  const content = await draft(media.id);
  const held = barrier(),
    release = barrier(),
    trashAttempt = barrier();
  let stopped = false;
  const update = fixture.payload.db.updateOne.bind(fixture.payload.db);
  const spy = vi.spyOn(fixture.payload.db, 'updateOne').mockImplementation(async (args) => {
    if (args.collection === 'media' && 'usages' in args.data && !stopped) {
      stopped = true;
      const saved = await update(args);
      held.resolve();
      await release.promise;
      return saved;
    }
    if (args.collection === 'media' && !('usages' in args.data) && stopped) trashAttempt.resolve();
    return update(args);
  });
  try {
    const publication = publish(content.id);
    await held.promise;
    const deletion = fixture.payload
      .update({
        collection: 'media',
        id: media.id,
        data: { deletedAt: new Date().toISOString() },
        req: await fixture.request(),
        overrideAccess: false,
      })
      .then(
        () => ({ status: 200 }),
        (error: unknown) => error,
      );
    await trashAttempt.promise;
    release.resolve();
    await publication;
    expect(await deletion).toMatchObject({ status: 409 });
    expect((await publicMedia(media.id)).ok).toBe(true);
    const row = (await fixture.payload.db.findOne({
      collection: 'media',
      where: { id: { equals: media.id } },
      req: await fixture.request(),
    })) as Media | null;
    expect(row?.deletedAt).toBeNull();
  } finally {
    release.resolve();
    spy.mockRestore();
  }
});
it('trash holding the actual Media row makes publication roll back and preserves recoverable bytes', async () => {
  const media = await mediaMetadataFixture(fixture.payload);
  const content = await draft(media.id);
  const held = barrier(),
    release = barrier(),
    publicationAttempt = barrier();
  let stopped = false;
  const update = fixture.payload.db.updateOne.bind(fixture.payload.db);
  const spy = vi.spyOn(fixture.payload.db, 'updateOne').mockImplementation(async (args) => {
    if (args.collection === 'media' && !('usages' in args.data) && !stopped) {
      stopped = true;
      const saved = await update(args);
      held.resolve();
      await release.promise;
      return saved;
    }
    if (args.collection === 'media' && 'usages' in args.data && stopped)
      publicationAttempt.resolve();
    return update(args);
  });
  try {
    const deletion = fixture.payload.update({
      collection: 'media',
      id: media.id,
      data: { deletedAt: new Date().toISOString() },
      req: await fixture.request(),
      overrideAccess: false,
    });
    await held.promise;
    const publication = publish(content.id).then(
      () => ({ status: 200 }),
      (error: unknown) => error,
    );
    await publicationAttempt.promise;
    release.resolve();
    await deletion;
    expect(await publication).toMatchObject({ status: 400 });
    expect(await publicMedia(media.id)).toEqual({ ok: false, status: 404 });
    const published = await fixture.payload.find({
      collection: 'case-content',
      where: { and: [{ id: { equals: content.id } }, { _status: { equals: 'published' } }] },
      draft: false,
      req: await fixture.request(),
      overrideAccess: false,
    });
    expect(published.totalDocs).toBe(0);
    await fixture.payload.update({
      collection: 'media',
      id: media.id,
      trash: true,
      data: { deletedAt: null },
      req: await fixture.request(),
      overrideAccess: false,
    });
    expect(
      (
        await resolveMediaAccess(
          { mediaId: media.id, variant: 'original', preview: true },
          await fixture.request(),
        )
      ).ok,
    ).toBe(true);
  } finally {
    release.resolve();
    spy.mockRestore();
  }
});
it('rolls back written Media usages with the native editorial transaction when publication fails later', async () => {
  const media = await mediaMetadataFixture(fixture.payload);
  const content = await draft(media.id);
  let failed = false;
  const update = fixture.payload.db.updateOne.bind(fixture.payload.db);
  const spy = vi.spyOn(fixture.payload.db, 'updateOne').mockImplementation(async (args) => {
    const result = await update(args);
    if (args.collection === 'media' && 'usages' in args.data && !failed) {
      failed = true;
      throw new Error('Synthetic post-usage transaction failure');
    }
    return result;
  });
  try {
    await expect(publish(content.id)).rejects.toThrow('Synthetic post-usage transaction failure');
  } finally {
    spy.mockRestore();
  }
  expect(await publicMedia(media.id)).toEqual({ ok: false, status: 404 });
  const row = (await fixture.payload.db.findOne({
    collection: 'media',
    where: { id: { equals: media.id } },
    req: await fixture.request(),
  })) as Media | null;
  expect(row?.usages).not.toEqual(
    expect.arrayContaining([expect.objectContaining({ state: 'confirmed' })]),
  );
  expect((await publish(content.id))._status).toBe('published');
  expect((await publicMedia(media.id)).ok).toBe(true);
});
it('allows a draft to remove a trashed prior reference while retaining its recoverable usage history', async () => {
  const previous = await mediaMetadataFixture(fixture.payload);
  const replacement = await mediaMetadataFixture(fixture.payload);
  const content = await draft(previous.id);
  await fixture.payload.update({
    collection: 'media',
    id: previous.id,
    data: { deletedAt: new Date().toISOString() },
    req: await fixture.request(),
    overrideAccess: false,
  });
  const changed = await fixture.payload.update({
    collection: 'case-content',
    id: content.id,
    draft: true,
    data: {
      cover: { media: replacement.id, alt: 'Synthetic replacement image' },
      seo: { image: { media: replacement.id, alt: 'Synthetic replacement image' } },
      _status: 'draft',
    },
    req: await observedRequest('case-content', content.id, await fixture.request()),
    overrideAccess: false,
    depth: 0,
  });
  expect(changed.cover?.media).toBe(replacement.id);
  expect(await publicMedia(previous.id)).toEqual({ ok: false, status: 404 });
  expect(await publicMedia(replacement.id)).toEqual({ ok: false, status: 404 });
  const prior = (await fixture.payload.db.findOne({
    collection: 'media',
    where: { id: { equals: previous.id } },
    req: await fixture.request(),
  })) as Media | null;
  expect(prior?.usages).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ documentId: content.id, state: 'retained' }),
    ]),
  );
  expect(prior?.deletedAt).toBeTruthy();
  await publish(content.id);
  expect((await publicMedia(replacement.id)).ok).toBe(true);
  expect(await publicMedia(previous.id)).toEqual({ ok: false, status: 404 });
});
