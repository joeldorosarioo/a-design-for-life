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
