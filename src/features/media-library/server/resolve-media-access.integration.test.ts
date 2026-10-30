import type { Media } from '@/payload-types';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { createLocalReq } from 'payload';
import {
  createEditorialPayloadFixture,
  clearStructuralFixture,
} from '../../../../testing/fixtures/editorial-payload';
import {
  mediaMetadataFixture,
  casePublicationFixture,
  observedRequest,
} from '../../../../testing/fixtures/editorial-lifecycle';
import { resolveMediaAccess } from './resolve-media-access';
let fixture: Awaited<ReturnType<typeof createEditorialPayloadFixture>>;
beforeAll(async () => {
  fixture = await createEditorialPayloadFixture('e1.6-media-delivery');
});
afterAll(async () => {
  await fixture?.payload.destroy();
});
const delivery = async (id: string, preview = false, variant = 'original') =>
  resolveMediaAccess(
    { mediaId: id, variant, preview },
    preview ? await fixture.request() : await createLocalReq({}, fixture.payload),
  );
it('keeps unapproved originals/variants private and permits authenticated preview of real bytes', async () => {
  const media = await mediaMetadataFixture(fixture.payload);
  expect(await delivery(media.id)).toEqual({ ok: false, status: 404 });
  expect(await delivery(media.id, false, 'w16')).toEqual({ ok: false, status: 404 });
  const preview = await delivery(media.id, true);
  expect(preview.ok).toBe(true);
  if (preview.ok) expect(preview.value.bytes.byteLength).toBeGreaterThan(50);
  expect(
    await resolveMediaAccess(
      { mediaId: media.id, variant: 'original', preview: true },
      await createLocalReq({}, fixture.payload),
    ),
  ).toEqual({ ok: false, status: 401 });
});
it('publishing PT grants only its approved media, shares an asset with private EN, and protects trash/delete', async () => {
  const approved = await mediaMetadataFixture(fixture.payload);
  const enOnly = await mediaMetadataFixture(fixture.payload);
  const shared = await fixture.payload.create({
    collection: 'cases',
    data: { internalTitle: 'Synthetic media scopes' },
    req: await fixture.request(),
    overrideAccess: false,
  });
  const pt = await fixture.payload.create({
    collection: 'case-content',
    data: {
      case: shared.id,
      locale: 'pt',
      ...casePublicationFixture(approved.id),
      _status: 'published',
    },
    req: await fixture.request(),
    overrideAccess: false,
  });
  await fixture.payload.create({
    collection: 'case-content',
    data: {
      case: shared.id,
      locale: 'en',
      cover: { media: approved.id },
      seo: { image: { media: enOnly.id } },
      _status: 'draft',
    },
    draft: true,
    req: await fixture.request(),
    overrideAccess: false,
  });
  expect((await delivery(approved.id)).ok).toBe(true);
  expect((await delivery(approved.id, false, 'w16')).ok).toBe(true);
  expect(await delivery(enOnly.id)).toEqual({ ok: false, status: 404 });
  await expect(
    fixture.payload.update({
      collection: 'media',
      id: approved.id,
      data: { deletedAt: new Date().toISOString() },
      req: await fixture.request(),
      overrideAccess: false,
    }),
  ).rejects.toMatchObject({ status: 409 });
  await expect(
    fixture.payload.delete({
      collection: 'media',
      id: approved.id,
      req: await fixture.request(),
      overrideAccess: true,
    }),
  ).rejects.toMatchObject({ status: 409 });
  await fixture.payload.update({
    collection: 'case-content',
    id: pt.id,
    data: { _status: 'draft' },
    req: await observedRequest('case-content', pt.id, await fixture.request()),
    overrideAccess: false,
  });
  expect(await delivery(approved.id)).toEqual({ ok: false, status: 404 });
  expect(await delivery(approved.id, false, 'w16')).toEqual({ ok: false, status: 404 });
});
it('preserves the old published asset during draft edits and replaces only its owner publication', async () => {
  const old = await mediaMetadataFixture(fixture.payload);
  const next = await mediaMetadataFixture(fixture.payload);
  const shared = await fixture.payload.create({
    collection: 'cases',
    data: { internalTitle: 'Synthetic media revisions' },
    req: await fixture.request(),
    overrideAccess: false,
  });
  const pt = await fixture.payload.create({
    collection: 'case-content',
    data: {
      case: shared.id,
      locale: 'pt',
      ...casePublicationFixture(old.id),
      _status: 'published',
    },
    req: await fixture.request(),
    overrideAccess: false,
  });
  await fixture.payload.update({
    collection: 'case-content',
    id: pt.id,
    data: { cover: { media: next.id, alt: 'Synthetic new' }, _status: 'draft' },
    draft: true,
    req: await observedRequest('case-content', pt.id, await fixture.request()),
    overrideAccess: false,
  });
  expect((await delivery(old.id)).ok).toBe(true);
  expect(await delivery(next.id)).toEqual({ ok: false, status: 404 });
  await fixture.payload.update({
    collection: 'case-content',
    id: pt.id,
    data: { cover: { media: next.id, alt: 'Synthetic new' }, _status: 'published' },
    req: await observedRequest('case-content', pt.id, await fixture.request()),
    overrideAccess: false,
  });
  expect(await delivery(old.id)).toEqual({ ok: false, status: 404 });
  expect((await delivery(next.id)).ok).toBe(true);
  const retained = (await fixture.payload.db.findOne({
    collection: 'media',
    where: { id: { equals: old.id } },
    req: await fixture.request(),
  })) as Media | null;
  expect(retained?.usages).toEqual(
    expect.arrayContaining([expect.objectContaining({ state: 'retained', documentId: pt.id })]),
  );
});

it('checks every usage kind when the same PDF is submitted as both portrait and resume', async () => {
  await clearStructuralFixture(fixture.payload);
  const pdf = await mediaMetadataFixture(fixture.payload, 'pdf');
  await expect(
    fixture.payload.create({
      collection: 'professional-profiles',
      data: {
        locale: 'en',
        home: { portrait: { media: pdf.id } },
        resume: pdf.id,
        _status: 'draft',
      },
      draft: true,
      req: await fixture.request(),
      overrideAccess: false,
    }),
  ).rejects.toMatchObject({ status: 400 });
});
