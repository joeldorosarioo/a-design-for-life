import { afterAll, beforeAll, expect, it } from 'vitest';
import { createEditorialPayloadFixture } from '../../../../../testing/fixtures/editorial-payload';

let fixture: Awaited<ReturnType<typeof createEditorialPayloadFixture>>;
beforeAll(async () => {
  fixture = await createEditorialPayloadFixture('e1.3-private-media-stub');
});
afterAll(async () => {
  await fixture?.payload.destroy();
});

it('não libera upload pela preparação de schema nem com acesso privilegiado', async () => {
  const bytes = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6RCEAAAAASUVORK5CYII=',
    'base64',
  );
  await expect(
    fixture.payload.create({
      collection: 'media',
      data: {},
      file: { data: bytes, size: bytes.byteLength, name: 'synthetic.png', mimetype: 'image/png' },
      req: await fixture.request(),
      overrideAccess: true,
    }),
  ).rejects.toMatchObject({ status: 403 });
});
