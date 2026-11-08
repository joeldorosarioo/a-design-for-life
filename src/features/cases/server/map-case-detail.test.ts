import { expect, it } from 'vitest';
import type { CaseContent } from '@/payload-types';
import { mapCaseDetail } from './map-case-detail';
import { caseCardDTOSchema } from '../contracts/case-dto.schema';
const sharedID = 'ba53e178-456a-437b-a2c1-771ce6b6b0af';
const firstKey = 'e7fda410-76ba-466a-910f-01662e4a840c';
const secondKey = '2cad5dcb-15ba-4f2e-b210-40df0b8723fe';
const document: CaseContent = {
  id: '0555b54d-a759-46a1-b82e-f3caee35534b',
  locale: 'pt',
  _status: 'published',
  createdAt: '',
  updatedAt: '',
  case: {
    id: sharedID,
    internalTitle: 'PRIVATE internal title',
    sortOrder: 0,
    featured: true,
    createdAt: '',
    updatedAt: '',
  },
  title: 'Synthetic localized title',
  summary: 'Synthetic summary',
  slug: 'synthetic-slug',
  sections: [
    {
      id: 'private-row-first',
      readingKey: firstKey,
      heading: 'Synthetic first',
      blocks: [
        {
          id: 'private-block-first',
          readingKey: 'dfce5dfd-ec81-4132-9f8d-0b8d9f7a7867',
          blockType: 'text',
        },
        {
          id: 'private-block-image',
          readingKey: '4878fdc4-9fc5-4860-8707-629509a6802e',
          blockType: 'image',
          image: {
            media: '3a7f8848-b305-47dd-8781-368c8ee21e3a',
            alt: 'Synthetic image description',
            decorative: false,
          },
        },
      ],
    },
    {
      id: 'private-row-second',
      readingKey: secondKey,
      heading: 'Synthetic second',
      blocks: [
        {
          id: 'private-block-second',
          readingKey: '0fa94f85-5fd2-471c-b767-7289cdd2c9f9',
          blockType: 'image-pair',
          presentation: 'comparison',
          firstLabel: 'Synthetic before',
          secondLabel: 'Synthetic after',
        },
      ],
    },
  ],
};
it('usa o título traduzido, deriva sumário e preserva três apresentações sem dados administrativos', () => {
  const dto = mapCaseDetail(document);
  expect(dto).toMatchObject({
    caseId: sharedID,
    title: 'Synthetic localized title',
    path: '/pt/cases/synthetic-slug',
    contents: [
      { readingKey: firstKey, label: 'Synthetic first', anchor: `section-${firstKey}` },
      { readingKey: secondKey, label: 'Synthetic second', anchor: `section-${secondKey}` },
    ],
    sections: [
      {
        readingKey: firstKey,
        blocks: [
          { type: 'text' },
          { type: 'image', image: { alt: 'Synthetic image description' } },
        ],
      },
      { readingKey: secondKey, blocks: [{ type: 'image-pair', presentation: 'comparison' }] },
    ],
  });
  const serialized = JSON.stringify(dto);
  for (const forbidden of [
    '_status',
    'createdAt',
    'updatedAt',
    'PRIVATE',
    'private-row',
    'private-block',
    document.id,
  ])
    expect(serialized).not.toContain(forbidden);
});
it('não retorna DTO público de case em rascunho', () => {
  expect(
    mapCaseDetail({ ...document, _status: 'draft', title: 'Private draft text' }),
  ).toBeUndefined();
});

it('deriva título completo e mantém as duas partes editoriais para cards e SEO', () => {
  const split = { ...document, title: 'Uma jornada', titleEmphasis: 'mais simples.' };
  const dto = mapCaseDetail(split);
  expect(caseCardDTOSchema.parse(dto).title).toBe('Uma jornada mais simples.');
  expect(dto).toMatchObject({
    title: 'Uma jornada mais simples.',
    titleParts: { normal: 'Uma jornada', emphasis: 'mais simples.' },
    seo: { title: 'Uma jornada mais simples.' },
  });
});

it('preserva identificação, manchete e notas, e deriva sumário das seções reais após reordenação', () => {
  const comparison = {
    readingKey: secondKey,
    presentation: 'comparison' as const,
    eyebrow: 'COMPARAÇÃO ILUSTRATIVA',
    heading: 'Uma mudança na ordem de leitura.',
    description: 'O conteúdo necessário permanece.',
    note: 'Exemplo visual, sem resultados de teste ou métricas associados.',
    blocks: [
      {
        blockType: 'text' as const,
        readingKey: 'dfce5dfd-ec81-4132-9f8d-0b8d9f7a7867',
        eyebrow: 'ANTES · CENÁRIO INICIAL',
        heading: 'Informações competem por atenção',
        note: 'Nota editorial',
      },
      {
        blockType: 'text' as const,
        readingKey: '0fa94f85-5fd2-471c-b767-7289cdd2c9f9',
        eyebrow: 'DEPOIS · PROPOSTA',
        heading: 'Cada etapa tem uma prioridade',
      },
    ],
  };
  const process = {
    readingKey: firstKey,
    presentation: 'process' as const,
    eyebrow: 'Processo',
    heading: 'Da leitura à proposta',
    blocks: [],
  };
  const dto = mapCaseDetail({ ...document, sections: [comparison, process] });
  expect(dto?.sections).toMatchObject([
    {
      readingKey: secondKey,
      presentation: 'comparison',
      eyebrow: 'COMPARAÇÃO ILUSTRATIVA',
      heading: 'Uma mudança na ordem de leitura.',
      description: 'O conteúdo necessário permanece.',
      note: 'Exemplo visual, sem resultados de teste ou métricas associados.',
      blocks: [
        {
          type: 'text',
          readingKey: 'dfce5dfd-ec81-4132-9f8d-0b8d9f7a7867',
          eyebrow: 'ANTES · CENÁRIO INICIAL',
          heading: 'Informações competem por atenção',
          note: 'Nota editorial',
        },
        {
          type: 'text',
          readingKey: '0fa94f85-5fd2-471c-b767-7289cdd2c9f9',
          eyebrow: 'DEPOIS · PROPOSTA',
          heading: 'Cada etapa tem uma prioridade',
        },
      ],
    },
    {
      readingKey: firstKey,
      presentation: 'process',
      eyebrow: 'Processo',
      heading: 'Da leitura à proposta',
      blocks: [],
    },
  ]);
  expect(dto?.contents).toEqual([
    { readingKey: secondKey, label: 'COMPARAÇÃO ILUSTRATIVA', anchor: `section-${secondKey}` },
    { readingKey: firstKey, label: 'Processo', anchor: `section-${firstKey}` },
  ]);
  const removed = mapCaseDetail({
    ...document,
    sections: [{ ...process, eyebrow: 'Processo revisto' }],
  });
  expect(removed?.contents).toEqual([
    { readingKey: firstKey, label: 'Processo revisto', anchor: `section-${firstKey}` },
  ]);
});

it.each([undefined, null])('mantém leitura legada sem metadados novos (%s)', (empty) => {
  const legacy = {
    ...document,
    title: '  Título legado completo  ',
    titleEmphasis: empty,
    sections: [
      {
        readingKey: firstKey,
        presentation: empty,
        eyebrow: empty,
        heading: 'Título legado',
        blocks: [
          {
            blockType: 'text' as const,
            readingKey: secondKey,
            eyebrow: empty,
            heading: empty,
            note: empty,
          },
        ],
      },
    ],
  };
  expect(mapCaseDetail(legacy)).toMatchObject({
    title: '  Título legado completo  ',
    titleParts: { normal: '  Título legado completo  ', emphasis: null },
    sections: [
      {
        presentation: 'narrative',
        eyebrow: null,
        description: null,
        note: null,
        blocks: [{ type: 'text', eyebrow: null, heading: null, note: null }],
      },
    ],
    contents: [{ readingKey: firstKey, label: 'Título legado', anchor: `section-${firstKey}` }],
  });
});
it('preserva título SEO explícito e usa manchete no sumário quando identificação está vazia', () => {
  expect(
    mapCaseDetail({
      ...document,
      titleEmphasis: 'ênfase',
      seo: { title: 'SEO explícito' },
      sections: [{ readingKey: firstKey, eyebrow: '  ', heading: 'Manchete efetiva' }],
    }),
  ).toMatchObject({
    seo: { title: 'SEO explícito' },
    contents: [{ readingKey: firstKey, label: 'Manchete efetiva' }],
  });
});
