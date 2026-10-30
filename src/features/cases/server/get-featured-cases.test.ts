import { randomUUID } from 'node:crypto';
import { expect, it } from 'vitest';
import { z } from 'zod';
import { mapCaseDetail } from './map-case-detail';
import { getFeaturedCases } from './get-featured-cases';
const entry = (value: unknown) => ({
  operationId: randomUUID(),
  targetRevision: randomUUID(),
  value: z.json().parse(value),
});
it('usa somente destaque compartilhado confirmado e tradução confirmada no idioma solicitado', async () => {
  const id = randomUUID();
  const contentId = randomUUID();
  const root = {
    generation: randomUUID(),
    subjects: {
      [`cases/${id}`]: entry({ kind: 'case-order', caseId: id, sortOrder: 0, featured: true }),
      [`case-content/${contentId}`]: entry({
        kind: 'case',
        caseId: id,
        contentId,
        locale: 'pt',
        slug: 'highlight',
        slugs: ['highlight'],
        detail: mapCaseDetail({
          id: contentId,
          case: id,
          locale: 'pt',
          _status: 'published',
          slug: 'highlight',
          title: 'Confirmed highlight',
          createdAt: '',
          updatedAt: '',
        }),
      }),
    },
  };
  expect(await getFeaturedCases('pt', root)).toMatchObject({
    ok: true,
    value: [{ title: 'Confirmed highlight' }],
  });
  expect(await getFeaturedCases('en', root)).toEqual({ ok: true, value: [] });
  root.subjects[`cases/${id}`] = entry({
    kind: 'case-order',
    caseId: id,
    sortOrder: 0,
    featured: false,
  });
  expect(await getFeaturedCases('pt', root)).toEqual({ ok: true, value: [] });
});
