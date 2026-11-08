import { createHmac, randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { getPayload, createLocalReq } from 'payload';
import config from '@payload-config';
import type { Media } from '@/payload-types';
import { installPayloadProvider } from '@/helpers/payload/runtime';
import { installPublicationProvider } from '@/helpers/payload/publication-runtime';
import {
  readPublicRoot,
  withPublicRootWriter,
  type PublicRoot,
} from '@/helpers/payload/public-root';
import { portfolioPublicationCoordinator } from '@/config/publication';
import { createEditorialPayloadFixture } from '../../../../testing/fixtures/editorial-payload';
import {
  mediaMetadataFixture,
  casePublicationFixture,
  observedRequest,
} from '../../../../testing/fixtures/editorial-lifecycle';
import { confirmTestPublication } from '../../../../testing/fixtures/confirmed-publication';
import { handleNextImage } from './next-image-proxy';
import { resolveMediaAccess } from './resolve-media-access';
import { classifyMissingPublicMedia } from './classify-missing-public-media';

let fixture: Awaited<ReturnType<typeof createEditorialPayloadFixture>>;
let directory: string;
const secret = 'Synthetic-real-native-image-classification-secret-12345';
beforeAll(async () => {
  fixture = await createEditorialPayloadFixture('e2-image-coverage');
  const native = await getPayload({ config });
  installPayloadProvider(async () => native);
  directory = await mkdtemp(path.join(tmpdir(), 'portfolio-image-coverage-'));
  installPublicationProvider(() => portfolioPublicationCoordinator(directory));
  await withPublicRootWriter(directory, async (_, commit) =>
    commit({ generation: randomUUID(), subjects: {} }),
  );
});
afterAll(async () => {
  await fixture?.payload.destroy();
  if (directory?.startsWith(path.join(tmpdir(), 'portfolio-image-coverage-')))
    await rm(directory, { recursive: true, force: true });
});
function request(id: string, internal = false) {
  const query = `url=${encodeURIComponent(`/media/${id}/original`)}&w=64&q=75`;
  const headers = new Headers({ accept: 'image/webp' });
  if (internal) {
    const expires = Math.floor(Date.now() / 1000) + 30;
    const signature = createHmac('sha256', secret)
      .update(`portfolio-next-image-v1\n${expires}\nGET\n${query}\nimage/webp`)
      .digest('hex');
    headers.set('x-portfolio-image-authorization', `${expires}.${signature}`);
  }
  return new Request(`https://synthetic.invalid/_next/image?${query}`, { headers });
}
async function expectBoth(id: string, status: 404 | 503) {
  expect(
    await resolveMediaAccess(
      { mediaId: id, variant: 'original', preview: false },
      await createLocalReq({}, fixture.payload),
    ),
  ).toEqual({ ok: false, status });
  for (const internal of [false, true]) {
    const response = await handleNextImage(request(id, internal), {
      publicationDirectory: directory,
      internalOrigin: 'http://127.0.0.1:9',
      secret,
    });
    expect(response).not.toBeNull();
    expect(response!.status).toBe(status);
    expect(response!.headers.get('cache-control')).toBe('private, no-store');
    expect(await response!.text()).toBe('');
  }
}

it('uses the same captured root to classify real confirmed Native usages missing owner coverage as503', async () => {
  const image = await mediaMetadataFixture(fixture.payload);
  const parent = await fixture.payload.create({
    collection: 'cases',
    data: { internalTitle: 'Synthetic image coverage' },
    req: await fixture.request(),
    overrideAccess: false,
  });
  const published = await fixture.payload.create({
    collection: 'case-content',
    data: {
      ...casePublicationFixture(image.id),
      case: parent.id,
      locale: 'pt',
      _status: 'published',
    },
    req: await fixture.request(),
    overrideAccess: false,
  });
  await confirmTestPublication(published, await fixture.request());
  const confirmed = await readPublicRoot(directory);
  expect(confirmed).not.toBeNull();
  const owner = `case-content/${published.id}`;
  expect(confirmed!.subjects[owner]).toBeDefined();
  const originalMetadata = (await fixture.payload.db.findOne({
    collection: 'media',
    where: { id: { equals: image.id } },
    req: await fixture.request(),
  })) as Media;
  expect(originalMetadata.usages).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        collection: 'case-content',
        documentId: published.id,
        state: 'confirmed',
      }),
    ]),
  );
  try {
    for (const fault of ['absent-owner', 'uncovered-owner'] as const) {
      const subjects = { ...confirmed!.subjects };
      if (fault === 'absent-owner') delete subjects[owner];
      else subjects[owner] = { ...subjects[owner], value: {} };
      await withPublicRootWriter(directory, async (_, commit) =>
        commit({ generation: randomUUID(), subjects }),
      );
      await expectBoth(image.id, 503);
    }
  } finally {
    await withPublicRootWriter(directory, async (_, commit) =>
      commit({ ...(confirmed as PublicRoot), generation: randomUUID() }),
    );
  }
  const withdrawn = await fixture.payload.update({
    collection: 'case-content',
    id: published.id,
    data: { _status: 'draft' },
    req: await observedRequest('case-content', published.id, await fixture.request()),
    overrideAccess: false,
  });
  await confirmTestPublication(withdrawn, await fixture.request());
  const revoked = await readPublicRoot(directory);
  expect(revoked!.subjects[owner].value).toMatchObject({ media: [] });
  // Real Native DB fault fixture: restore only stale confirmed SQL usages after the
  // actual withdrawal root committed. Those metadata can classify, never grant bytes.
  await fixture.payload.db.updateOne({
    collection: 'media',
    where: { id: { equals: image.id } },
    data: { usages: originalMetadata.usages },
    req: await fixture.request(),
  });
  const stale = (await fixture.payload.db.findOne({
    collection: 'media',
    where: { id: { equals: image.id } },
    req: await fixture.request(),
  })) as Media;
  expect(stale.usages).toEqual(originalMetadata.usages);
  await expectBoth(image.id, 404);
  // Classification must use its captured generation, not reread a newer disk root.
  const missing = { ...revoked!, subjects: { ...revoked!.subjects } };
  delete missing.subjects[owner];
  await withPublicRootWriter(directory, async (_, commit) =>
    commit({ ...missing, generation: randomUUID() }),
  );
  expect(await classifyMissingPublicMedia(image.id, revoked, await fixture.request())).toBe(404);
  await withPublicRootWriter(directory, async (_, commit) =>
    commit({ ...revoked!, generation: randomUUID() }),
  );
  expect(await classifyMissingPublicMedia(image.id, missing, await fixture.request())).toBe(503);
});

it('keeps a healthy private or unknown resource indistinguishable as404 with real Native metadata', async () => {
  const image = await mediaMetadataFixture(fixture.payload);
  await expectBoth(image.id, 404);
  await expectBoth(randomUUID(), 404);
});
