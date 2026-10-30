import { confirmTestPublication } from '../../../../../testing/fixtures/confirmed-publication';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { createEditorialPayloadFixture } from '../../../../../testing/fixtures/editorial-payload';
import {
  casePublicationFixture,
  mediaMetadataFixture,
  observedRequest,
} from '../../../../../testing/fixtures/editorial-lifecycle';
import { editorialHead } from '@/helpers/payload/editorial-revision';
let fixture: Awaited<ReturnType<typeof createEditorialPayloadFixture>>;
beforeAll(async () => {
  fixture = await createEditorialPayloadFixture('e1.4-case-text-content');
});
afterAll(async () => {
  await fixture?.payload.destroy();
});
const element = { version: 1, direction: null, format: '', indent: 0 };
const leaf = (text: string) => ({
  type: 'text',
  version: 1,
  text,
  detail: 0,
  format: 0,
  mode: 'normal',
  style: '',
});
const paragraph = (children: unknown[]) => ({ ...element, type: 'paragraph', children });
const richText = (children: unknown[]) => ({ root: { ...element, type: 'root', children } });
async function identity() {
  return fixture.payload.create({
    collection: 'cases',
    data: { internalTitle: 'Synthetic case text characterization' },
    req: await fixture.request(),
    overrideAccess: false,
  });
}

it.each([
  { name: 'empty normal paragraph', content: richText([paragraph([])]) },
  { name: 'whitespace-only text leaf', content: richText([paragraph([leaf('   ')])]) },
])(
  'rejects publishing a case containing only an $name while drafts stay editable',
  async ({ content }) => {
    const image = await mediaMetadataFixture(fixture.payload);
    const createParent = await identity();
    const emptyBody = { sections: [{ blocks: [{ blockType: 'text', content }] }] };
    await expect(
      fixture.payload.create({
        collection: 'case-content',
        data: {
          ...casePublicationFixture(image.id),
          ...emptyBody,
          case: createParent.id,
          locale: 'pt',
          _status: 'published',
        } as never,
        req: await fixture.request(),
        overrideAccess: false,
      }),
    ).rejects.toMatchObject({
      status: 400,
      data: {
        errors: expect.arrayContaining([
          expect.objectContaining({ path: 'sections.0.blocks.0.content' }),
        ]),
      },
    });
    expect(
      (
        await fixture.payload.find({
          collection: 'case-content',
          where: { case: { equals: createParent.id } },
          draft: false,
          depth: 0,
          overrideAccess: false,
        })
      ).totalDocs,
    ).toBe(0);
    const updateParent = await identity();
    const published = await fixture.payload.create({
      collection: 'case-content',
      data: {
        ...casePublicationFixture(image.id),
        case: updateParent.id,
        locale: 'pt',
        _status: 'published',
      } as never,
      depth: 0,
      req: await fixture.request(),
      overrideAccess: false,
    });
    await confirmTestPublication(published, await fixture.request());
    const draft = await fixture.payload.update({
      collection: 'case-content',
      id: published.id,
      data: { ...emptyBody, title: 'Private empty narrative', _status: 'draft' } as never,
      draft: true,
      depth: 0,
      req: await observedRequest('case-content', published.id, await fixture.request()),
      overrideAccess: false,
    });
    expect(draft).toMatchObject({ _status: 'draft', title: 'Private empty narrative' });
    const before = await editorialHead('case-content', published.id, await fixture.request());
    const versionsBefore = await fixture.payload.findVersions({
      collection: 'case-content',
      where: { parent: { equals: published.id } },
      req: await fixture.request(),
      overrideAccess: false,
    });
    await expect(
      fixture.payload.update({
        collection: 'case-content',
        id: published.id,
        data: { _status: 'published' },
        req: await observedRequest('case-content', published.id, await fixture.request()),
        overrideAccess: false,
      }),
    ).rejects.toMatchObject({
      status: 400,
      data: {
        errors: expect.arrayContaining([
          expect.objectContaining({ path: 'sections.0.blocks.0.content' }),
        ]),
      },
    });
    expect(
      (await editorialHead('case-content', published.id, await fixture.request()))
        .editorialRevision,
    ).toBe(before.editorialRevision);
    expect(
      await fixture.payload.findByID({
        collection: 'case-content',
        id: published.id,
        draft: false,
        depth: 0,
        overrideAccess: false,
      }),
    ).toMatchObject({
      _status: 'published',
      title: 'Synthetic title',
      sections: [
        {
          blocks: [
            {
              blockType: 'text',
              content: { root: { children: [{ children: [{ text: 'Synthetic narrative' }] }] } },
            },
          ],
        },
      ],
    });
    expect(
      await fixture.payload.findByID({
        collection: 'case-content',
        id: published.id,
        draft: true,
        depth: 0,
        req: await fixture.request(),
        overrideAccess: false,
      }),
    ).toMatchObject({
      _status: 'draft',
      title: 'Private empty narrative',
      editorialRevision: draft.editorialRevision,
    });
    expect(
      (
        await fixture.payload.findVersions({
          collection: 'case-content',
          where: { parent: { equals: published.id } },
          req: await fixture.request(),
          overrideAccess: false,
        })
      ).totalDocs,
    ).toBe(versionsBefore.totalDocs);
  },
);
it('publishes meaningful text inside lists and typed links without trimming the stored text', async () => {
  const parent = await identity();
  const image = await mediaMetadataFixture(fixture.payload);
  const label = '  Meaningful linked narrative  ';
  const link = {
    ...element,
    type: 'link',
    version: 3,
    fields: {
      linkType: 'custom',
      destination: 'external',
      url: 'https://example.invalid/narrative',
    },
    children: [leaf(label)],
  };
  const list = {
    ...element,
    type: 'list',
    listType: 'bullet',
    tag: 'ul',
    start: 1,
    children: [{ ...element, type: 'listitem', value: 1, children: [paragraph([link])] }],
  };
  const published = await fixture.payload.create({
    collection: 'case-content',
    data: {
      ...casePublicationFixture(image.id),
      case: parent.id,
      locale: 'pt',
      _status: 'published',
      sections: [{ blocks: [{ blockType: 'text', content: richText([list]) }] }],
    } as never,
    depth: 0,
    req: await fixture.request(),
    overrideAccess: false,
  });
  await confirmTestPublication(published, await fixture.request());
  const publicDoc = await fixture.payload.findByID({
    collection: 'case-content',
    id: published.id,
    draft: false,
    depth: 0,
    overrideAccess: false,
  });
  expect(publicDoc._status).toBe('published');
  expect(JSON.stringify(publicDoc.sections)).toContain(label);
});
it('publishes a case with a valid single image block and no text block', async () => {
  const parent = await identity();
  const image = await mediaMetadataFixture(fixture.payload);
  // Editorial metadata fixture only: this does not upload, process or validate file bytes.
  const published = await fixture.payload.create({
    collection: 'case-content',
    data: {
      ...casePublicationFixture(image.id),
      case: parent.id,
      locale: 'pt',
      _status: 'published',
      sections: [
        {
          blocks: [
            {
              blockType: 'image',
              image: { media: image.id, decorative: false, alt: 'Synthetic image-only narrative' },
            },
          ],
        },
      ],
    } as never,
    depth: 0,
    req: await fixture.request(),
    overrideAccess: false,
  });
  await confirmTestPublication(published, await fixture.request());
  expect(
    await fixture.payload.findByID({
      collection: 'case-content',
      id: published.id,
      draft: false,
      depth: 0,
      overrideAccess: false,
    }),
  ).toMatchObject({
    _status: 'published',
    sections: [
      {
        blocks: [
          { blockType: 'image', image: { media: image.id, alt: 'Synthetic image-only narrative' } },
        ],
      },
    ],
  });
});
