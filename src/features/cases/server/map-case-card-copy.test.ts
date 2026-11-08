import { randomUUID } from 'node:crypto';
import { expect, it } from 'vitest';
import type { CaseContent } from '@/payload-types';
import type { PublicRoot } from '@/helpers/payload/public-root';
import { caseInputSchema } from '../contracts/case.schema';
import { mapCaseCardPresentation, mapCaseDetail } from './map-case-detail';
import { getPublishedCases, getPublishedCaseRoutes } from './get-published-cases';
import { getFeaturedCases } from './get-featured-cases';

const document: CaseContent = {
  id: randomUUID(),
  case: randomUUID(),
  locale: 'pt',
  _status: 'published',
  createdAt: '',
  updatedAt: '',
  title: 'Detail title',
  titleEmphasis: 'detail emphasis',
  eyebrow: 'Detail eyebrow',
  slug: 'synthetic-card-copy',
  summary: 'Synthetic summary',
};
const path = '/pt/cases/synthetic-card-copy';

it('uses independently edited card copy without changing the detail or SEO', () => {
  const edited = { ...document, cardTitle: 'Card title', cardEyebrow: 'Card eyebrow' };
  expect(mapCaseCardPresentation(edited, path)).toMatchObject({
    title: 'Card title',
    eyebrow: 'Card eyebrow',
  });
  expect(mapCaseDetail(edited)).toMatchObject({
    title: 'Detail title detail emphasis',
    eyebrow: 'Detail eyebrow',
    seo: { title: 'Detail title detail emphasis' },
  });
});

it.each([undefined, null, '', ' \n\t '])(
  'falls back for absent or blank optional copy: %j',
  (value) => {
    const edited = { ...document, cardTitle: value, cardEyebrow: value };
    expect(mapCaseCardPresentation(edited, path)).toMatchObject({
      title: 'Detail title detail emphasis',
      eyebrow: 'Detail eyebrow',
    });
  },
);

it('resolves each optional field independently and preserves authored copy', () => {
  const edited = {
    ...document,
    cardTitle: '  Authored card title\nsecond line  ',
    cardEyebrow: null,
  };
  expect(mapCaseCardPresentation(edited, path)).toMatchObject({
    title: edited.cardTitle,
    eyebrow: 'Detail eyebrow',
  });
});

it('accepts plain optional Native fields in the strict input contract', () => {
  expect(caseInputSchema.safeParse({ cardTitle: 'Card', cardEyebrow: 'Eyebrow' }).success).toBe(
    true,
  );
  expect(caseInputSchema.safeParse({ cardTitle: null, cardEyebrow: null }).success).toBe(true);
  for (const bad of [23, {}, []])
    expect(caseInputSchema.safeParse({ cardTitle: bad }).success).toBe(false);
  expect(caseInputSchema.safeParse({ cardTitle: 'Card', arbitrary: 'not allowed' }).success).toBe(
    false,
  );
});

function root(card?: unknown): PublicRoot {
  const caseId = typeof document.case === 'string' ? document.case : document.case.id;
  const entry = (value: unknown) => ({
    operationId: randomUUID(),
    targetRevision: randomUUID(),
    value: JSON.parse(JSON.stringify(value)),
  });
  return {
    generation: randomUUID(),
    subjects: {
      [`cases/${caseId}`]: entry({ kind: 'case-order', caseId, featured: true, sortOrder: 1 }),
      [`case-content/${document.id}`]: entry({
        kind: 'case',
        contentId: document.id,
        caseId,
        locale: 'pt',
        slug: document.slug,
        detail: mapCaseDetail(document),
        ...(card === undefined ? {} : { card }),
      }),
    },
  };
}

it('reads the confirmed card projection for listing and highlights, retaining detail SEO', async () => {
  const card = {
    ...mapCaseCardPresentation(document, path),
    title: 'Confirmed card title',
    eyebrow: 'Confirmed card eyebrow',
  };
  const captured = root(card);
  for (const getter of [getPublishedCases, getFeaturedCases])
    expect(await getter('pt', captured)).toMatchObject({
      ok: true,
      value: [{ title: card.title, eyebrow: card.eyebrow }],
    });
  expect(await getPublishedCaseRoutes('pt', captured)).toMatchObject({
    ok: true,
    value: [{ seo: { title: 'Detail title detail emphasis' } }],
  });
});

it('retains legacy confirmed snapshots without an independent card projection', async () => {
  for (const getter of [getPublishedCases, getFeaturedCases])
    expect(await getter('pt', root())).toMatchObject({
      ok: true,
      value: [{ title: 'Detail title detail emphasis', eyebrow: 'Detail eyebrow' }],
    });
});

it.each(['caseId', 'locale', 'path'] as const)(
  'rejects a confirmed card with mismatched %s instead of linking another body',
  async (key) => {
    const card = {
      ...mapCaseCardPresentation(document, path),
      [key]: key === 'caseId' ? randomUUID() : key === 'locale' ? 'en' : '/pt/cases/another-case',
    };
    for (const getter of [getPublishedCases, getFeaturedCases])
      expect(await getter('pt', root(card))).toMatchObject({
        ok: false,
        error: { code: 'unavailable' },
      });
  },
);

it('rejects a malformed provided projection instead of silently reverting to the detail', async () => {
  for (const getter of [getPublishedCases, getFeaturedCases])
    expect(await getter('pt', root({ title: 7 }))).toMatchObject({
      ok: false,
      error: { code: 'unavailable' },
    });
});
