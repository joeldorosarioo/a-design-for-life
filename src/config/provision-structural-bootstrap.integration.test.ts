import { readPublicRoot } from '@/helpers/payload/public-root';
import { runtimePublication } from '@/helpers/payload/publication-runtime';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { createLocalReq } from 'payload';
import {
  createEditorialPayloadFixture,
  clearStructuralFixture,
} from '../../testing/fixtures/editorial-payload';
import { provisionStructuralDocuments } from './provision-structural-documents';
let fixture: Awaited<ReturnType<typeof createEditorialPayloadFixture>>;
beforeAll(async () => {
  fixture = await createEditorialPayloadFixture('e1.3-trusted-provision');
  await clearStructuralFixture(fixture.payload);
});
afterAll(async () => {
  await fixture?.payload.destroy();
});
it('provisiona sem conta humana somente os quatro drafts pelo contexto interno restrito', async () => {
  const request = () =>
    createLocalReq({ context: { trustedStructuralProvisioning: true } }, fixture.payload);
  const confirmedBefore = await readPublicRoot(runtimePublication().directory);
  await expect(provisionStructuralDocuments(await request())).resolves.toBeUndefined();
  const before = [];
  for (const collection of ['site-navigation', 'professional-profiles'] as const) {
    const result = await fixture.payload.find({
      collection,
      draft: true,
      req: await request(),
      overrideAccess: false,
      sort: 'locale',
    });
    expect(result.totalDocs).toBe(2);
    expect(
      result.docs
        .map((doc) => [doc.locale, doc._status])
        .sort((a, b) => a[0]!.localeCompare(b[0]!)),
    ).toEqual([
      ['en', 'draft'],
      ['pt', 'draft'],
    ]);
    before.push(result.docs.map((doc) => [doc.id, doc.updatedAt]));
    await expect(
      fixture.payload.update({
        collection,
        id: result.docs[0].id,
        data: { locale: 'en' },
        req: await request(),
        overrideAccess: false,
      }),
    ).rejects.toMatchObject({ status: 403 });
  }
  await provisionStructuralDocuments(await request());
  const after = [];
  for (const collection of ['site-navigation', 'professional-profiles'] as const) {
    const result = await fixture.payload.find({
      collection,
      draft: true,
      req: await request(),
      overrideAccess: false,
      sort: 'locale',
    });
    after.push(result.docs.map((doc) => [doc.id, doc.updatedAt]));
    expect((await fixture.payload.find({ collection, overrideAccess: false })).totalDocs).toBe(0);
  }
  expect(after).toEqual(before);
  expect(await readPublicRoot(runtimePublication().directory)).toEqual(confirmedBefore);
  await expect(
    fixture.payload.create({
      collection: 'cases',
      data: { internalTitle: 'Denied' },
      req: await request(),
      overrideAccess: false,
    }),
  ).rejects.toMatchObject({ status: 403 });
  await expect(
    fixture.payload.create({
      collection: 'cases',
      data: { internalTitle: 'Denied privileged bootstrap' },
      req: await request(),
      overrideAccess: true,
    }),
  ).rejects.toMatchObject({ status: 403 });
  await expect(
    fixture.payload.create({
      collection: 'users',
      data: { email: 'denied@example.invalid', password: 'Synthetic-denied-password-123!' },
      req: await request(),
      overrideAccess: false,
    }),
  ).rejects.toMatchObject({ status: 403 });
  await expect(
    fixture.payload.create({
      collection: 'media',
      data: {},
      req: await request(),
      overrideAccess: false,
    }),
  ).rejects.toMatchObject({ status: 403 });
});
