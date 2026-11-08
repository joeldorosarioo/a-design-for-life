import { expect, it } from 'vitest';
import { extractCaseMedia } from './extract-case-media';

const coverId = 'ba53e178-456a-437b-a2c1-771ce6b6b0af';
const seoId = 'e7fda410-76ba-466a-910f-01662e4a840c';
const singleId = '2cad5dcb-15ba-4f2e-b210-40df0b8723fe';
const firstId = '0555b54d-a759-46a1-b82e-f3caee35534b';
const secondId = '3a7f8848-b305-47dd-8781-368c8ee21e3a';

it('extracts each approved case image slot in deterministic document order', () => {
  expect(
    extractCaseMedia({
      cover: { media: coverId, alt: 'Synthetic cover' },
      seo: { image: { media: { id: seoId, filename: 'synthetic.png' } } },
      sections: [
        { blocks: [{ blockType: 'image', image: { media: singleId } }] },
        {
          blocks: [
            { blockType: 'image-pair', first: { media: firstId }, second: { media: secondId } },
          ],
        },
      ],
    }),
  ).toEqual([
    { mediaId: coverId, kind: 'image' },
    { mediaId: seoId, kind: 'image' },
    { mediaId: singleId, kind: 'image' },
    { mediaId: firstId, kind: 'image' },
    { mediaId: secondId, kind: 'image' },
  ]);
});

it('canonicalizes populated and direct UUIDs before deduplicating repeated image references', () => {
  expect(
    extractCaseMedia({
      cover: { media: coverId.toUpperCase() },
      seo: { image: { media: { id: coverId } } },
      sections: [
        {
          blocks: [
            { blockType: 'image', image: { media: { id: singleId.toUpperCase() } } },
            { blockType: 'image-pair', first: { media: coverId }, second: { media: singleId } },
          ],
        },
      ],
    }),
  ).toEqual([
    { mediaId: coverId, kind: 'image' },
    { mediaId: singleId, kind: 'image' },
  ]);
});

it('leaves incomplete draft slots without references and accepts native empty array sentinels', () => {
  expect(
    extractCaseMedia({
      cover: { alt: 'Unfinished cover', media: '' },
      seo: { image: { media: null } },
      sections: [
        { blocks: 0 },
        { blocks: [{ blockType: 'image' }, { blockType: 'image-pair', first: {}, second: null }] },
      ],
    }),
  ).toEqual([]);
  expect(extractCaseMedia({ sections: 0 })).toEqual([]);
  expect(extractCaseMedia({})).toEqual([]);
  expect(extractCaseMedia(null)).toEqual([]);
  expect(extractCaseMedia(undefined)).toEqual([]);
});

it('ignores file-shaped values outside the explicit case image slots', () => {
  expect(
    extractCaseMedia({
      case: { id: coverId, cover: { media: seoId } },
      media: coverId,
      resume: seoId,
      sections: [
        {
          media: singleId,
          blocks: [
            {
              blockType: 'text',
              image: { media: 'not-a-relation-slot' },
              content: {
                root: {
                  children: [
                    { type: 'text', text: coverId, media: singleId },
                    { type: 'link', fields: { destination: 'case', case: coverId, media: seoId } },
                    { type: 'link', fields: { destination: 'resume', id: firstId } },
                  ],
                },
              },
            },
            { blockType: 'unknown', image: { media: secondId } },
          ],
        },
      ],
    }),
  ).toEqual([]);
});

it.each([
  'not-a-uuid',
  ' ba53e178-456a-437b-a2c1-771ce6b6b0af ',
  0,
  12,
  false,
  [[]],
  {},
  { id: null },
  { id: 'not-a-uuid' },
  { id: 12 },
])('rejects a malformed nonempty case relationship %j at its approved path', (media) => {
  expect(() => extractCaseMedia({ cover: { media } })).toThrow(/cover\.media/);
});

it.each([
  [{ seo: { image: { media: 'invalid' } } }, /seo\.image\.media/],
  [
    { sections: [{ blocks: [{ blockType: 'image', image: { media: 'invalid' } }] }] },
    /sections\.0\.blocks\.0\.image\.media/,
  ],
  [
    { sections: [{ blocks: [{ blockType: 'image-pair', first: { media: 'invalid' } }] }] },
    /sections\.0\.blocks\.0\.first\.media/,
  ],
  [
    { sections: [{ blocks: [{ blockType: 'image-pair', second: { media: 'invalid' } }] }] },
    /sections\.0\.blocks\.0\.second\.media/,
  ],
])('reports the failing nested case relationship in %j', (document, path) => {
  expect(() => extractCaseMedia(document)).toThrow(path);
});

it.each([
  [{ cover: coverId }, /cover/],
  [{ seo: [] }, /seo/],
  [{ sections: 1 }, /sections/],
  [{ sections: 'not-an-array' }, /sections/],
  [{ sections: [{ blocks: 1 }] }, /sections\.0\.blocks/],
  [{ sections: [{ blocks: {} }] }, /sections\.0\.blocks/],
  [{ sections: [{ blocks: [{ blockType: 'image', image: 0 }] }] }, /image/],
])('does not silently ignore a malformed approved case container %j', (document, path) => {
  expect(() => extractCaseMedia(document)).toThrow(path);
});
