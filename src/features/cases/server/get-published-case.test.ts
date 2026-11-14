import { randomUUID } from 'node:crypto';
import { expect, it } from 'vitest';
import { z } from 'zod';
import { mapCaseDetail } from './map-case-detail';
import { getPublishedCase } from './get-published-case';
const id = randomUUID();
const contentId = randomUUID();
const entry = (value: unknown) => ({
  operationId: randomUUID(),
  targetRevision: randomUUID(),
  value: z.json().parse(value),
});
it('retorna o detalhe completo confirmado e não inventa ausência para idioma/slug fora da geração', async () => {
  const root = {
    generation: randomUUID(),
    subjects: {
      [`cases/${id}`]: entry({ kind: 'case-order', caseId: id, sortOrder: 0, featured: false }),
      [`case-content/${contentId}`]: entry({
        kind: 'case',
        caseId: id,
        contentId,
        locale: 'pt',
        slug: 'current',
        slugs: ['old', 'current'],
        detail: mapCaseDetail({
          id: contentId,
          case: id,
          locale: 'pt',
          _status: 'published',
          slug: 'current',
          title: 'Confirmed',
          titleEmphasis: 'title',
          createdAt: '',
          updatedAt: '',
        }),
      }),
    },
  };
  expect(await getPublishedCase('pt', 'current', root)).toMatchObject({
    ok: true,
    value: { title: 'Confirmed title', seo: { title: 'Confirmed title' } },
  });
  for (const [locale, slug] of [
    ['en', 'current'],
    ['pt', 'old'],
    ['pt', 'unknown'],
  ] as const)
    expect(await getPublishedCase(locale, slug, root)).toMatchObject({
      ok: false,
      error: { code: 'unavailable' },
    });
});

it('supplies the confirmed cover dimensions from the selected generation', async () => {
  const mediaId = randomUUID();
  const detail = mapCaseDetail({
    id: contentId,
    case: id,
    locale: 'pt',
    _status: 'published',
    slug: 'current',
    title: 'Confirmed portrait cover',
    cover: { media: mediaId, decorative: false, alt: 'Portrait cover' },
    createdAt: '',
    updatedAt: '',
  });
  const root = {
    generation: randomUUID(),
    subjects: {
      [`cases/${id}`]: entry({ kind: 'case-order', caseId: id, sortOrder: 0, featured: false }),
      [`case-content/${contentId}`]: entry({
        kind: 'case',
        caseId: id,
        contentId,
        locale: 'pt',
        slug: 'current',
        detail,
        media: [
          {
            id: mediaId,
            manifest: {
              revision: randomUUID(),
              kind: 'image',
              variants: [],
              original: {
                variant: 'original',
                type: 'image/png',
                width: 1048,
                height: 1280,
                object: { key: 'a'.repeat(64), byteLength: 200, sha256: 'b'.repeat(64) },
              },
            },
          },
        ],
      }),
    },
  };
  expect(await getPublishedCase('pt', 'current', root)).toMatchObject({
    ok: true,
    value: { cover: { mediaId }, coverIntrinsicSize: { width: 1048, height: 1280 } },
  });
});

it('enriches legacy article and pair images from their pinned manifests without trusting embedded sizes', async () => {
  const singleId = randomUUID();
  const pairId = randomUUID();
  const detail = mapCaseDetail({
    id: contentId,
    case: id,
    locale: 'pt',
    _status: 'published',
    slug: 'current',
    title: 'Confirmed images',
    createdAt: '',
    updatedAt: '',
    sections: [
      {
        readingKey: randomUUID(),
        blocks: [
          {
            blockType: 'image',
            readingKey: randomUUID(),
            image: { media: singleId, alt: 'Square' },
          },
          {
            blockType: 'image-pair',
            readingKey: randomUUID(),
            first: { media: pairId, alt: 'Portrait' },
            second: { media: singleId, alt: 'Square again' },
          },
          { blockType: 'text', readingKey: randomUUID(), heading: 'Untouched text' },
        ],
      },
    ],
  })!;
  const first = detail.sections[0].blocks[0];
  if (first.type === 'image' && first.image)
    Object.assign(first.image, { intrinsicSize: { width: 1, height: 1 } });
  const media = [
    { id: singleId, width: 600, height: 600 },
    { id: pairId, width: 600, height: 900 },
  ].map(({ id: mediaId, width, height }) => ({
    id: mediaId,
    manifest: {
      revision: randomUUID(),
      kind: 'image',
      variants: [],
      original: {
        variant: 'original',
        type: 'image/png',
        width,
        height,
        object: { key: 'a'.repeat(64), byteLength: 200, sha256: 'b'.repeat(64) },
      },
    },
  }));
  const root = {
    generation: randomUUID(),
    subjects: {
      [`cases/${id}`]: entry({ kind: 'case-order', caseId: id, sortOrder: 0, featured: false }),
      [`case-content/${contentId}`]: entry({
        kind: 'case',
        caseId: id,
        contentId,
        locale: 'pt',
        slug: 'current',
        detail,
        media,
      }),
    },
  };
  const before = JSON.stringify(root);
  expect(await getPublishedCase('pt', 'current', root)).toMatchObject({
    ok: true,
    value: {
      sections: [
        {
          blocks: [
            { type: 'image', image: { intrinsicSize: { width: 600, height: 600 } } },
            {
              type: 'image-pair',
              first: { intrinsicSize: { width: 600, height: 900 } },
              second: { intrinsicSize: { width: 600, height: 600 } },
            },
            { type: 'text', heading: 'Untouched text' },
          ],
        },
      ],
    },
  });
  expect(JSON.stringify(root)).toBe(before);
});
