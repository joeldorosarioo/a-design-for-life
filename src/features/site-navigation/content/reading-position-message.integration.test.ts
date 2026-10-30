import { afterAll, beforeAll, beforeEach, expect, it } from 'vitest';
import {
  createEditorialPayloadFixture,
  clearStructuralFixture,
} from '../../../../testing/fixtures/editorial-payload';
import {
  navigationFixture,
  observedRequest,
} from '../../../../testing/fixtures/editorial-lifecycle';

let fixture: Awaited<ReturnType<typeof createEditorialPayloadFixture>>;
beforeAll(async () => {
  fixture = await createEditorialPayloadFixture('e2-reading-adjustment-message');
});
beforeEach(async () => {
  await clearStructuralFixture(fixture.payload);
});
afterAll(async () => {
  await fixture?.payload.destroy();
});

it('persists the plain adjustment message in Native current and version data without changing another locale', async () => {
  const created = await fixture.payload.create({
    collection: 'site-navigation',
    data: {
      locale: 'pt',
      messages: { readingPositionAdjusted: 'Synthetic PT adjustment notice' },
      _status: 'draft',
    } as never,
    draft: true,
    overrideAccess: false,
    req: await fixture.request(),
  });
  const en = await fixture.payload.create({
    collection: 'site-navigation',
    data: { locale: 'en', _status: 'draft' },
    draft: true,
    overrideAccess: false,
    req: await fixture.request(),
  });
  expect(created.messages).toMatchObject({
    readingPositionAdjusted: 'Synthetic PT adjustment notice',
  });
  const versions = await fixture.payload.findVersions({
    collection: 'site-navigation',
    where: { parent: { equals: created.id } },
    sort: '-createdAt',
    overrideAccess: false,
    req: await fixture.request(),
  });
  expect(versions.docs[0].version.messages).toMatchObject({
    readingPositionAdjusted: 'Synthetic PT adjustment notice',
  });
  expect(en.messages ?? {}).not.toMatchObject({
    readingPositionAdjusted: 'Synthetic PT adjustment notice',
  });
});

it('requires the reviewed adjustment message on a new Native publication', async () => {
  const created = await fixture.payload.create({
    collection: 'site-navigation',
    data: { locale: 'pt', _status: 'draft' },
    draft: true,
    overrideAccess: false,
    req: await fixture.request(),
  });
  const data = navigationFixture();
  delete (data.messages as Record<string, unknown>).readingPositionAdjusted;
  await expect(
    fixture.payload.update({
      collection: 'site-navigation',
      id: created.id,
      data: { ...data, _status: 'published' },
      overrideAccess: false,
      req: await observedRequest('site-navigation', created.id, await fixture.request()),
    }),
  ).rejects.toMatchObject({
    data: {
      errors: expect.arrayContaining([
        expect.objectContaining({ path: 'messages.readingPositionAdjusted' }),
      ]),
    },
  });
});
