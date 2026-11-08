import { expect, test } from '@playwright/test';
import sharp from 'sharp';
import { createEditorialPayloadFixture } from '../../testing/fixtures/editorial-payload';
import {
  casePublicationFixture,
  mediaMetadataFixture,
  observedRequest,
} from '../../testing/fixtures/editorial-lifecycle';
import { confirmTestPublication } from '../../testing/fixtures/confirmed-publication';

let fixture: Awaited<ReturnType<typeof createEditorialPayloadFixture>>;
test.beforeAll(async () => {
  fixture = await createEditorialPayloadFixture('e2-public-image-http');
});
test.afterAll(async () => {
  await fixture?.payload.destroy();
});

test('optimizes one original through Next, rechecks cache hits and denies every byte after withdrawal', async ({
  request,
}) => {
  const image = await mediaMetadataFixture(fixture.payload);
  const parent = await fixture.payload.create({
    collection: 'cases',
    data: { internalTitle: 'Synthetic image optimizer fixture' },
    req: await fixture.request(),
    overrideAccess: false,
  });
  const saved = await fixture.payload.create({
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
  await confirmTestPublication(saved, await fixture.request());
  const source = `/media/${image.id}/original`;
  const url = `/_next/image?url=${encodeURIComponent(source)}&w=64&q=75`;
  const options = {
    headers: { Accept: 'image/webp', 'If-None-Match': '*', Cookie: 'irrelevant=visitor' },
  };
  const first = await request.get(url, options);
  expect(first.status()).toBe(200);
  expect(first.headers()['content-type']).toContain('image/webp');
  expect(first.headers()['cache-control']).toContain('private');
  expect(first.headers()['cache-control']).toContain('no-store');
  expect(first.headers()['x-nextjs-cache']).toBe('MISS');
  expect(first.headers()['set-cookie']).toBeUndefined();
  const bytes = await first.body();
  expect((await sharp(bytes).metadata()).format).toBe('webp');
  expect(bytes.equals(await (await request.get(source)).body())).toBe(false);
  const hit = await request.get(url, options);
  expect(hit.status()).toBe(200);
  expect(hit.headers()['x-nextjs-cache']).toBe('HIT');
  expect(hit.headers()['cache-control']).toContain('no-store');
  expect(await hit.body()).toEqual(bytes);
  const head = await request.head(url, options);
  expect(head.status()).toBe(200);
  expect(await head.body()).toHaveLength(0);
  const withdrawn = await fixture.payload.update({
    collection: 'case-content',
    id: saved.id,
    data: { _status: 'draft' },
    req: await observedRequest('case-content', saved.id, await fixture.request()),
    overrideAccess: false,
  });
  await confirmTestPublication(withdrawn, await fixture.request());
  for (const method of ['GET', 'HEAD'] as const) {
    const revoked = await request.fetch(url, { method, ...options });
    expect(revoked.status()).toBe(404);
    expect(revoked.headers()['cache-control']).toContain('no-store');
    expect(await revoked.body()).toHaveLength(0);
  }
  expect((await request.get(source)).status()).toBe(404);
  const privateImage = await mediaMetadataFixture(fixture.payload);
  const privateUrl = `/_next/image?url=${encodeURIComponent(`/media/${privateImage.id}/original`)}&w=64&q=75`;
  const denied = await request.get(privateUrl, options);
  expect(denied.status()).toBe(404);
  expect(await denied.body()).toHaveLength(0);
  for (const sourceUrl of [
    'https://example.invalid/image.png',
    '/preview-media/00000000-0000-4000-8000-000000000001/original',
    source + '?anything=1',
  ]) {
    const invalid = await request.get(
      `/_next/image?url=${encodeURIComponent(sourceUrl)}&w=64&q=75`,
    );
    expect(invalid.status()).toBe(400);
    expect(await invalid.body()).toHaveLength(0);
  }
});
