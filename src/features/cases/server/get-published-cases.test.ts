import { randomUUID } from 'node:crypto';
import { expect, it } from 'vitest';
import { z } from 'zod';
import type { PublicRoot } from '@/helpers/payload/public-root';
import { getPublishedCases, getPublishedCaseRoutes } from './get-published-cases';
import { mapCaseDetail } from './map-case-detail';
const a = randomUUID();
const b = randomUUID();
const entry = (value: unknown) => ({
  operationId: randomUUID(),
  targetRevision: randomUUID(),
  value: z.json().parse(value),
});
function root(): PublicRoot {
  const caseValue = (caseId: string, locale: 'pt' | 'en', title: string, slug: string) => {
    const contentId = randomUUID();
    return [
      `case-content/${contentId}`,
      entry({
        kind: 'case',
        caseId,
        contentId,
        locale,
        slug,
        slugs: ['historic-' + slug, slug],
        detail: mapCaseDetail({
          id: contentId,
          case: caseId,
          locale,
          title,
          slug,
          _status: 'published',
          createdAt: '',
          updatedAt: '',
        }),
      }),
    ] as const;
  };
  return {
    generation: randomUUID(),
    subjects: Object.fromEntries([
      [`cases/${a}`, entry({ kind: 'case-order', caseId: a, sortOrder: 8, featured: false })],
      [`cases/${b}`, entry({ kind: 'case-order', caseId: b, sortOrder: 2, featured: true })],
      caseValue(a, 'pt', 'Confirmed A', 'case-a'),
      caseValue(b, 'pt', 'Confirmed B', 'case-b'),
      caseValue(a, 'en', 'Confirmed English A', 'english-a'),
    ]),
  };
}
it('filtra idioma e aplica ordem manual confirmada, preservando o contrato mínimo do card', async () => {
  const result = await getPublishedCases('pt', root());
  expect(result).toMatchObject({
    ok: true,
    value: [
      { title: 'Confirmed B', path: '/pt/cases/case-b' },
      { title: 'Confirmed A', path: '/pt/cases/case-a' },
    ],
  });
  if (result.ok)
    expect(Object.keys(result.value[0]).sort()).toEqual([
      'caseId',
      'cover',
      'locale',
      'path',
      'summary',
      'title',
    ]);
});
it('distingue agregado vazio confirmado de ausência de cobertura', async () => {
  const known = {
    generation: randomUUID(),
    subjects: {
      [`cases/${a}`]: entry({ kind: 'case-order', caseId: a, sortOrder: 1, featured: false }),
    },
  };
  expect(await getPublishedCases('pt', known)).toEqual({ ok: true, value: [] });
  for (const missing of [null, { generation: randomUUID(), subjects: {} }])
    expect(await getPublishedCases('pt', missing)).toMatchObject({
      ok: false,
      error: { code: 'unavailable' },
    });
});

it('deriva canonical, histórico e SEO só dos detalhes confirmados na ordem da geração', async () => {
  expect(await getPublishedCaseRoutes('pt', root())).toMatchObject({
    ok: true,
    value: [
      {
        caseId: b,
        locale: 'pt',
        path: '/pt/cases/case-b',
        history: ['/pt/cases/historic-case-b'],
        seo: { title: 'Confirmed B' },
      },
      {
        caseId: a,
        locale: 'pt',
        path: '/pt/cases/case-a',
        history: ['/pt/cases/historic-case-a'],
        seo: { title: 'Confirmed A' },
      },
    ],
  });
});
it('recusa cache com slug inválido em vez de projetar links ou histórico arbitrários', async () => {
  const invalid = root();
  for (const subject of Object.values(invalid.subjects)) {
    const value = subject.value;
    if (value && typeof value === 'object' && !Array.isArray(value) && value.kind === 'case')
      value.slugs = ['../outside'];
  }
  expect(await getPublishedCases('pt', invalid)).toMatchObject({
    ok: false,
    error: { code: 'unavailable' },
  });
});
