import { afterAll, beforeAll, beforeEach, expect, it } from 'vitest';
import {
  createEditorialPayloadFixture,
  clearStructuralFixture,
} from '../../../testing/fixtures/editorial-payload';
import {
  mediaMetadataFixture,
  observedRequest,
} from '../../../testing/fixtures/editorial-lifecycle';
import type { Media } from '@/payload-types';
import { readPublicRoot } from './public-root';
import { runtimePublication } from './publication-runtime';

let fixture: Awaited<ReturnType<typeof createEditorialPayloadFixture>>;
beforeAll(async () => {
  fixture = await createEditorialPayloadFixture('native-null-group-clears');
});
beforeEach(async () => {
  await clearStructuralFixture(fixture.payload);
});
afterAll(async () => {
  await fixture?.payload.destroy();
});

async function createWithImage() {
  const media = await mediaMetadataFixture(fixture.payload);
  const image = {
    media: media.id,
    decorative: false,
    alt: 'Synthetic original alt',
    caption: 'Synthetic caption',
  };
  const profile = await fixture.payload.create({
    collection: 'professional-profiles',
    data: { locale: 'pt', _status: 'draft', seo: { homeTitle: 'Unrelated retained title', image } },
    draft: true,
    overrideAccess: false,
    req: await fixture.request(),
  });
  return { profile, media, image };
}

it('creates accepted null named groups through real Native validation', async () => {
  const profile = await fixture.payload.create({
    collection: 'professional-profiles',
    // The strict wire schema accepts null groups; Payload's generated Local API
    // type models groups as objects, so deliberately submit this wire input.
    data: {
      locale: 'pt',
      _status: 'draft',
      identity: null,
      home: null,
      seo: { image: null },
    } as never,
    draft: true,
    overrideAccess: false,
    req: await fixture.request(),
  });
  expect(profile.identity?.name).toBeNull();
  expect(profile.home?.title).toBeNull();
  expect(profile.seo?.image).toMatchObject({
    media: null,
    decorative: false,
    alt: null,
    caption: null,
  });
  expect(await readPublicRoot(runtimePublication().directory)).toBeNull();
});

it('clears a populated group without retaining media or replacing unrelated sibling data', async () => {
  const { profile, media } = await createWithImage();
  const observed = await observedRequest(
    'professional-profiles',
    profile.id,
    await fixture.request(),
  );
  const saved = await fixture.payload.update({
    collection: 'professional-profiles',
    id: profile.id,
    data: { seo: { image: null } } as never,
    draft: true,
    overrideAccess: false,
    req: observed,
  });
  expect(saved.seo).toMatchObject({
    homeTitle: 'Unrelated retained title',
    image: { media: null, decorative: false, alt: null, caption: null },
  });
  const fresh = await fixture.payload.findByID({
    collection: 'professional-profiles',
    id: profile.id,
    draft: true,
    depth: 0,
    overrideAccess: false,
    req: await fixture.request(),
  });
  expect(fresh.seo?.image).toMatchObject({
    media: null,
    decorative: false,
    alt: null,
    caption: null,
  });
  const receipt = await fixture.payload.db.findOne<Media>({
    collection: 'media',
    where: { id: { equals: media.id } },
    req: await fixture.request(),
  });
  expect(receipt?.usages).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ documentId: profile.id, state: 'retained' }),
    ]),
  );
  for (const state of ['draft', 'pending', 'confirmed'])
    expect(receipt?.usages).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ documentId: profile.id, state })]),
    );
  await expect(
    fixture.payload.update({
      collection: 'professional-profiles',
      id: profile.id,
      data: { seo: { homeTitle: 'Stale rejected' } },
      draft: true,
      overrideAccess: false,
      req: observed,
    }),
  ).rejects.toMatchObject({ status: 409 });
  expect(await readPublicRoot(runtimePublication().directory)).toBeNull();
});

it('preserves omitted groups and their real draft media usage', async () => {
  const { profile, media, image } = await createWithImage();
  const saved = await fixture.payload.update({
    collection: 'professional-profiles',
    id: profile.id,
    data: { seo: { homeTitle: 'Changed only title' } },
    draft: true,
    overrideAccess: false,
    req: await observedRequest('professional-profiles', profile.id, await fixture.request()),
  });
  const imageValue = saved.seo?.image;
  expect(typeof imageValue?.media === 'object' ? imageValue.media?.id : imageValue?.media).toBe(
    media.id,
  );
  expect(imageValue).toMatchObject({
    decorative: image.decorative,
    alt: image.alt,
    caption: image.caption,
  });
  const receipt = await fixture.payload.db.findOne<Media>({
    collection: 'media',
    where: { id: { equals: media.id } },
    req: await fixture.request(),
  });
  expect(receipt?.usages).toEqual(
    expect.arrayContaining([expect.objectContaining({ documentId: profile.id, state: 'draft' })]),
  );
});

it('rejects unknown input before group encoding and preserves the previously saved draft', async () => {
  const { profile, media } = await createWithImage();
  await expect(
    fixture.payload.update({
      collection: 'professional-profiles',
      id: profile.id,
      data: { seo: { image: null, unexpected: 'rejected' } } as never,
      draft: true,
      overrideAccess: false,
      req: await observedRequest('professional-profiles', profile.id, await fixture.request()),
    }),
  ).rejects.toMatchObject({ name: 'ValidationError' });
  const fresh = await fixture.payload.findByID({
    collection: 'professional-profiles',
    id: profile.id,
    draft: true,
    depth: 0,
    overrideAccess: false,
    req: await fixture.request(),
  });
  expect(fresh.seo?.image?.media).toBe(media.id);
});
