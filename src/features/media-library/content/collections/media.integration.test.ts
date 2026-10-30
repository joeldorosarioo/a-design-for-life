import { afterAll, beforeAll, expect, it } from 'vitest';
import { createEditorialPayloadFixture } from '../../../../../testing/fixtures/editorial-payload';
let fixture: Awaited<ReturnType<typeof createEditorialPayloadFixture>>;
beforeAll(async () => {
  fixture = await createEditorialPayloadFixture('e1.6-invalid-native-media');
});
afterAll(async () => {
  await fixture?.payload.destroy();
});
it('rejects a PNG signature without decodable pixels even with privileged local access and persists no media', async () => {
  const bytes = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const before = await fixture.payload.count({
    collection: 'media',
    req: await fixture.request(),
    overrideAccess: false,
  });
  await expect(
    fixture.payload.create({
      collection: 'media',
      data: {},
      file: { data: bytes, size: bytes.byteLength, name: 'synthetic.png', mimetype: 'image/png' },
      req: await fixture.request(),
      overrideAccess: true,
    }),
  ).rejects.toMatchObject({ status: 400 });
  expect(
    (
      await fixture.payload.count({
        collection: 'media',
        req: await fixture.request(),
        overrideAccess: false,
      })
    ).totalDocs,
  ).toBe(before.totalDocs);
});
