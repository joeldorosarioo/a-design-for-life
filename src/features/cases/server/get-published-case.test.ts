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
