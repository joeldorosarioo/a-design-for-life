import { afterAll, beforeAll, beforeEach, expect, it } from 'vitest';
import { z } from 'zod';
import {
  createEditorialPayloadFixture,
  clearStructuralFixture,
} from '../../../../testing/fixtures/editorial-payload';
import { observedRequest } from '../../../../testing/fixtures/editorial-lifecycle';

let fixture: Awaited<ReturnType<typeof createEditorialPayloadFixture>>;
const first = '11111111-1111-4111-8111-111111111111';
const second = '22222222-2222-4222-8222-222222222222';
beforeAll(async () => {
  fixture = await createEditorialPayloadFixture('e2-profile-reading-keys');
});
beforeEach(async () => {
  await clearStructuralFixture(fixture.payload);
});
afterAll(async () => {
  await fixture?.payload.destroy();
});

it('assigns and preserves Native draft row reading identities across rename and reorder', async () => {
  const created = await fixture.payload.create({
    collection: 'professional-profiles',
    data: {
      locale: 'pt',
      homeAbout: { trajectory: [{ title: 'First row' }, { title: 'Second row' }] },
      approach: { methods: [{ title: 'Method row' }] },
      _status: 'draft',
    },
    draft: true,
    overrideAccess: false,
    req: await fixture.request(),
  });
  const rows = created.homeAbout!.trajectory!;
  expect(rows.every((row) => z.uuid().safeParse(row.readingKey).success)).toBe(true);
  expect(z.uuid().safeParse(created.approach!.methods![0].readingKey).success).toBe(true);
  const changed = await fixture.payload.update({
    collection: 'professional-profiles',
    id: created.id,
    data: {
      homeAbout: {
        trajectory: [
          { id: rows[1].id, title: 'Renamed second' },
          { id: rows[0].id, title: 'Renamed first' },
        ],
      },
    },
    draft: true,
    overrideAccess: false,
    req: await observedRequest('professional-profiles', created.id, await fixture.request()),
  });
  expect(changed.homeAbout!.trajectory!.map((row) => row.readingKey)).toEqual([
    rows[1].readingKey,
    rows[0].readingKey,
  ]);
});

it('rejects Native changes and duplicates while allowing explicit cross-locale correspondence', async () => {
  const created = await fixture.payload.create({
    collection: 'professional-profiles',
    data: {
      locale: 'pt',
      approach: { methods: [{ readingKey: first, title: 'PT method' }] },
      _status: 'draft',
    },
    draft: true,
    overrideAccess: false,
    req: await fixture.request(),
  });
  await expect(
    fixture.payload.update({
      collection: 'professional-profiles',
      id: created.id,
      data: {
        approach: {
          methods: [
            { id: created.approach!.methods![0].id, readingKey: second, title: 'Renamed method' },
          ],
        },
      },
      draft: true,
      overrideAccess: false,
      req: await observedRequest('professional-profiles', created.id, await fixture.request()),
    }),
  ).rejects.toMatchObject({
    status: 400,
    data: {
      errors: expect.arrayContaining([
        expect.objectContaining({
          path: 'approach.methods.0.readingKey',
          message: 'Chave de leitura não pode ser alterada.',
        }),
      ]),
    },
  });
  await expect(
    fixture.payload.update({
      collection: 'professional-profiles',
      id: created.id,
      data: { homeAbout: { trajectory: [{ readingKey: first, title: 'Duplicate row' }] } },
      draft: true,
      overrideAccess: false,
      req: await observedRequest('professional-profiles', created.id, await fixture.request()),
    }),
  ).rejects.toMatchObject({
    status: 400,
    data: {
      errors: expect.arrayContaining([
        expect.objectContaining({
          path: 'approach.methods.0.readingKey',
          message: 'Chave de leitura repetida neste documento.',
        }),
      ]),
    },
  });
  const en = await fixture.payload.create({
    collection: 'professional-profiles',
    data: {
      locale: 'en',
      approach: { methods: [{ readingKey: first, title: 'EN method' }] },
      _status: 'draft',
    },
    draft: true,
    overrideAccess: false,
    req: await fixture.request(),
  });
  expect(en.approach!.methods![0].readingKey).toBe(first);
});
