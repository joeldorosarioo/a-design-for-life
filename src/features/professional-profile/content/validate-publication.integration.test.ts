import { confirmTestPublication } from '../../../../testing/fixtures/confirmed-publication';
import { afterAll, beforeAll, beforeEach, expect, it } from 'vitest';
import {
  clearStructuralFixture,
  createEditorialPayloadFixture,
} from '../../../../testing/fixtures/editorial-payload';
import {
  mediaMetadataFixture,
  observedRequest,
  profilePublicationFixture,
} from '../../../../testing/fixtures/editorial-lifecycle';
import { editorialHead } from '@/helpers/payload/editorial-revision';

let fixture: Awaited<ReturnType<typeof createEditorialPayloadFixture>>;
beforeAll(async () => {
  fixture = await createEditorialPayloadFixture('e1.4-profile-seo-alt');
});
beforeEach(async () => {
  await clearStructuralFixture(fixture.payload);
});
afterAll(async () => {
  await fixture?.payload.destroy();
});

it.each([
  { name: 'informative image without alt', decorative: false, alt: '' },
  { name: 'decorative image with nonempty alt', decorative: true, alt: 'Invalid decorative alt' },
])(
  'rejects publishing profile SEO $name while preserving its public document, draft and head',
  async ({ decorative, alt }) => {
    // Metadata-only fixtures exercise editorial references; they do not upload or validate bytes.
    const image = await mediaMetadataFixture(fixture.payload);
    const pdf = await mediaMetadataFixture(fixture.payload, 'pdf');
    const published = await fixture.payload.create({
      collection: 'professional-profiles',
      data: {
        ...profilePublicationFixture(image.id, pdf.id),
        locale: 'pt',
        identity: { name: 'Original public profile', role: 'Synthetic role' },
        seo: { image: { media: image.id, decorative: false, alt: 'Original public SEO alt' } },
        _status: 'published',
      },
      depth: 0,
      req: await fixture.request(),
      overrideAccess: false,
    });
    await confirmTestPublication(published, await fixture.request());
    const draft = await fixture.payload.update({
      collection: 'professional-profiles',
      id: published.id,
      data: {
        identity: { name: 'Private draft profile' },
        seo: { image: { media: image.id, decorative, alt } },
        _status: 'draft',
      },
      draft: true,
      depth: 0,
      req: await observedRequest('professional-profiles', published.id, await fixture.request()),
      overrideAccess: false,
    });
    expect(draft).toMatchObject({
      _status: 'draft',
      identity: { name: 'Private draft profile' },
      seo: { image: { media: image.id, decorative, alt } },
    });
    const headBefore = await editorialHead(
      'professional-profiles',
      published.id,
      await fixture.request(),
    );
    const versionsBefore = await fixture.payload.findVersions({
      collection: 'professional-profiles',
      where: { parent: { equals: published.id } },
      depth: 0,
      req: await fixture.request(),
      overrideAccess: false,
    });
    await expect(
      fixture.payload.update({
        collection: 'professional-profiles',
        id: published.id,
        data: { _status: 'published' },
        req: await observedRequest('professional-profiles', published.id, await fixture.request()),
        overrideAccess: false,
      }),
    ).rejects.toMatchObject({
      status: 400,
      data: {
        errors: expect.arrayContaining([expect.objectContaining({ path: 'seo.image.alt' })]),
      },
    });
    expect(
      (await editorialHead('professional-profiles', published.id, await fixture.request()))
        .editorialRevision,
    ).toBe(headBefore.editorialRevision);
    expect(
      await fixture.payload.findByID({
        collection: 'professional-profiles',
        id: published.id,
        depth: 0,
        draft: false,
        overrideAccess: false,
      }),
    ).toMatchObject({
      _status: 'published',
      identity: { name: 'Original public profile' },
      seo: { image: { media: image.id, decorative: false, alt: 'Original public SEO alt' } },
    });
    expect(
      await fixture.payload.findByID({
        collection: 'professional-profiles',
        id: published.id,
        depth: 0,
        draft: true,
        req: await fixture.request(),
        overrideAccess: false,
      }),
    ).toMatchObject({
      _status: 'draft',
      editorialRevision: draft.editorialRevision,
      identity: { name: 'Private draft profile' },
      seo: { image: { media: image.id, decorative, alt } },
    });
    const versionsAfter = await fixture.payload.findVersions({
      collection: 'professional-profiles',
      where: { parent: { equals: published.id } },
      depth: 0,
      req: await fixture.request(),
      overrideAccess: false,
    });
    expect(versionsAfter.totalDocs).toBe(versionsBefore.totalDocs);
  },
);

it('does not require the optional profile SEO image before publication', async () => {
  const image = await mediaMetadataFixture(fixture.payload);
  const pdf = await mediaMetadataFixture(fixture.payload, 'pdf');
  const published = await fixture.payload.create({
    collection: 'professional-profiles',
    data: { ...profilePublicationFixture(image.id, pdf.id), locale: 'pt', _status: 'published' },
    req: await fixture.request(),
    overrideAccess: false,
  });
  expect(published).toMatchObject({ locale: 'pt', _status: 'published' });
  await confirmTestPublication(published, await fixture.request());
});
