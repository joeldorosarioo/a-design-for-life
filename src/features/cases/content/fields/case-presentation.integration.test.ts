import { afterAll, beforeAll, expect, it } from 'vitest';
import { retryPublicationUpdate } from '@/helpers/payload/publication-updates';
import { createEditorialPayloadFixture } from '../../../../../testing/fixtures/editorial-payload';
let fixture: Awaited<ReturnType<typeof createEditorialPayloadFixture>>;
beforeAll(async () => {
  fixture = await createEditorialPayloadFixture('e1.8-case-presentation');
});
afterAll(async () => {
  await fixture?.payload.destroy();
});

it('persiste título e cartões textuais distintos da comparação também no histórico nativo', async () => {
  const shared = await fixture.payload.create({
    collection: 'cases',
    data: { internalTitle: 'Private illustrative editorial model' },
    overrideAccess: false,
    req: await fixture.request(),
  });
  const expected = {
    title: 'Uma jornada',
    titleEmphasis: 'mais simples.',
    _status: 'draft' as const,
    contextNote: 'Case ilustrativo. Estrutura editorial, sem experiência profissional factual.',
    sections: [
      {
        presentation: 'comparison',
        eyebrow: 'COMPARAÇÃO ILUSTRATIVA',
        heading: 'Uma mudança na ordem de leitura.',
        description: 'O conteúdo necessário permanece. A hierarquia passa a orientar o percurso.',
        note: 'Exemplo visual, sem resultados de teste ou métricas associados.',
        blocks: [
          {
            blockType: 'text',
            eyebrow: 'ANTES · CENÁRIO INICIAL',
            heading: 'Informações competem por atenção',
            note: 'Nota do primeiro cartão',
          },
          {
            blockType: 'text',
            eyebrow: 'DEPOIS · PROPOSTA',
            heading: 'Cada etapa tem uma prioridade',
          },
        ],
      },
    ],
  };
  const draft = await fixture.payload.create({
    collection: 'case-content',
    data: { ...expected, case: shared.id, locale: 'pt' } as never,
    draft: true,
    depth: 0,
    overrideAccess: false,
    req: await fixture.request(),
  });
  const reread = await fixture.payload.findByID({
    collection: 'case-content',
    id: draft.id,
    draft: true,
    depth: 0,
    overrideAccess: false,
    req: await fixture.request(),
  });
  expect(reread).toMatchObject(expected);
  const versions = await fixture.payload.findVersions({
    collection: 'case-content',
    where: { parent: { equals: draft.id } },
    depth: 0,
    overrideAccess: false,
    req: await fixture.request(),
  });
  expect(versions.docs[0].version).toMatchObject(expected);
  expect(
    (
      await fixture.payload.find({
        collection: 'case-content',
        where: { id: { equals: draft.id } },
        draft: false,
        overrideAccess: false,
      })
    ).totalDocs,
  ).toBe(0);
});

import { illustrativeCaseDraft, editorialText } from './case-presentation.fixture';
import { caseInputSchema } from '../../contracts/case.schema';
import { mapCaseDetail } from '../../server/map-case-detail';
import { restoreCaseDraft } from '../../server/restore-case-draft';
import {
  casePublicationFixture,
  mediaMetadataFixture,
  observedRequest,
} from '../../../../../testing/fixtures/editorial-lifecycle';

async function identity() {
  return fixture.payload.create({
    collection: 'cases',
    data: { internalTitle: 'Synthetic E1.8 editorial proof' },
    overrideAccess: false,
    req: await fixture.request(),
  });
}

it('relê o modelo Figma integral em draft com listas reais e os três tipos armazenados com mídia real', async () => {
  const shared = await identity();
  const media = await mediaMetadataFixture(fixture.payload);
  const source = illustrativeCaseDraft();
  expect(caseInputSchema.safeParse(source).success).toBe(true);
  const image = {
    media: media.id,
    decorative: false,
    alt: 'Mídia sintética de teste; não é um resultado profissional',
  };
  const draft = await fixture.payload.create({
    collection: 'case-content',
    data: {
      ...source,
      case: shared.id,
      cover: image,
      sections: [
        ...source.sections!,
        {
          heading: 'Demonstração técnica das mídias permitidas',
          blocks: [
            { blockType: 'image', image },
            {
              blockType: 'image-pair',
              presentation: 'pair',
              first: image,
              second: image,
              firstLabel: 'Primeira mídia sintética',
              secondLabel: 'Segunda mídia sintética',
            },
          ],
        },
      ],
    } as never,
    draft: true,
    depth: 0,
    overrideAccess: false,
    req: await fixture.request(),
  });
  const reread = await fixture.payload.findByID({
    collection: 'case-content',
    id: draft.id,
    draft: true,
    depth: 0,
    overrideAccess: false,
    req: await fixture.request(),
  });
  const kinds = reread
    .sections!.flatMap((section) => section.blocks ?? [])
    .map((block) => block.blockType);
  expect([...new Set(kinds)].sort()).toEqual(['image', 'image-pair', 'text']);
  expect(reread.contextNote).toBe(
    'Case ilustrativo. Cenário, comparação e processo servem como estrutura editorial; valide e substitua pelo conteúdo do seu projeto.',
  );
  const comparison = reread.sections!.find((section) => section.presentation === 'comparison')!;
  expect(comparison.blocks).toHaveLength(2);
  expect(comparison.blocks!.map((block) => block.blockType)).toEqual(['text', 'text']);
  expect(comparison).toMatchObject({
    eyebrow: 'COMPARAÇÃO ILUSTRATIVA',
    note: 'Exemplo visual, sem resultados de teste ou métricas associados.',
    blocks: [
      {
        readingKey: '3a0cb6b9-6b38-4e6f-b95a-754c14f4cd8a',
        eyebrow: 'ANTES · CENÁRIO INICIAL',
        content: {
          root: {
            children: [
              {
                type: 'paragraph',
                children: [
                  {
                    text: 'Conteúdo de várias etapas aparece ao mesmo tempo, com ações de peso semelhante.',
                  },
                ],
              },
              {
                type: 'list',
                listType: 'bullet',
                children: [
                  { children: [{ text: 'Instruções separadas dos campos' }] },
                  { children: [{ text: 'Próxima ação com pouca distinção' }] },
                  { children: [{ text: 'Progresso sem indicação clara' }] },
                ],
              },
            ],
          },
        },
      },
      { readingKey: '76ece55e-646d-420a-bf74-d0b5d5198b7f', eyebrow: 'DEPOIS · PROPOSTA' },
    ],
  });
  expect(reread.sections!.at(-1)).toMatchObject({
    blocks: [
      { blockType: 'image', image },
      { blockType: 'image-pair', first: image, second: image },
    ],
  });
  expect(mapCaseDetail(reread)).toBeUndefined();
  expect(
    (
      await fixture.payload.find({
        collection: 'case-content',
        where: { id: { equals: draft.id } },
        draft: false,
        overrideAccess: false,
      })
    ).totalDocs,
  ).toBe(0);
});

it('mantém UUIDs dos dois cartões ao renomear, reordenar e traduzir com outra ordem de seções e blocos', async () => {
  const shared = await identity();
  const draft = await fixture.payload.create({
    collection: 'case-content',
    data: { ...illustrativeCaseDraft(), case: shared.id } as never,
    draft: true,
    depth: 0,
    overrideAccess: false,
    req: await fixture.request(),
  });
  const sections = draft.sections!;
  const comparison = sections.find((section) => section.presentation === 'comparison')!;
  const reordered = [comparison, ...sections.filter((section) => section !== comparison)].map(
    (section) => ({
      ...section,
      heading: `Revisado: ${section.heading}`,
      presentation:
        section.presentation === 'process' ? ('learnings' as const) : section.presentation,
      blocks: [...(section.blocks ?? [])].reverse(),
    }),
  );
  const changed = await fixture.payload.update({
    collection: 'case-content',
    id: draft.id,
    data: { titleEmphasis: 'ênfase revisada', sections: reordered },
    draft: true,
    depth: 0,
    overrideAccess: false,
    req: await observedRequest('case-content', draft.id, await fixture.request()),
  });
  expect(changed.sections![0]).toMatchObject({
    readingKey: 'fffb7adb-c07c-4fa9-a497-66119d8165c3',
    heading: 'Revisado: Uma mudança na ordem de leitura.',
  });
  expect(
    changed.sections!.find(
      (section) => section.readingKey === '50201f81-7491-4812-9321-f73a289324c4',
    ),
  ).toMatchObject({
    presentation: 'learnings',
    blocks: [
      { readingKey: '6856ca7e-7981-482e-b14f-94023d71762c' },
      { readingKey: 'bb72532f-4581-41cd-b15b-39b4c2a35dfa' },
      { readingKey: 'e2c4809a-e4b2-4a7c-b07c-70e68f3caf3e' },
    ],
  });
  expect(changed.sections![0].blocks!.map((block) => block.readingKey)).toEqual([
    '76ece55e-646d-420a-bf74-d0b5d5198b7f',
    '3a0cb6b9-6b38-4e6f-b95a-754c14f4cd8a',
  ]);
  const englishSections = [...changed.sections!].reverse().map((section) => ({
    ...section,
    id: undefined,
    heading: `English counterpart of ${section.readingKey}`,
    blocks: [...(section.blocks ?? [])].reverse().map((block) => ({
      ...block,
      id: undefined,
      ...(block.blockType === 'text'
        ? { heading: 'A longer synthetic English counterpart with explicit identity' }
        : {}),
    })),
  }));
  const english = await fixture.payload.create({
    collection: 'case-content',
    data: {
      case: shared.id,
      locale: 'en',
      title: 'Synthetic translation',
      sections: englishSections,
    },
    draft: true,
    depth: 0,
    overrideAccess: false,
    req: await fixture.request(),
  });
  const translatedComparison = english.sections!.find(
    (section) => section.readingKey === 'fffb7adb-c07c-4fa9-a497-66119d8165c3',
  )!;
  expect(english.sections!.at(-1)?.readingKey).toBe('fffb7adb-c07c-4fa9-a497-66119d8165c3');
  expect(translatedComparison.blocks!.map((block) => block.readingKey)).toEqual([
    '3a0cb6b9-6b38-4e6f-b95a-754c14f4cd8a',
    '76ece55e-646d-420a-bf74-d0b5d5198b7f',
  ]);
  const originalAfterTranslation = await fixture.payload.findByID({
    collection: 'case-content',
    id: draft.id,
    draft: true,
    depth: 0,
    overrideAccess: false,
    req: await fixture.request(),
  });
  expect(originalAfterTranslation.sections).toEqual(changed.sections);
  for (const replacement of [
    { ...changed.sections![0], readingKey: crypto.randomUUID() },
    {
      ...changed.sections![0],
      blocks: changed.sections![0].blocks!.map((block, index) =>
        index === 0 ? { ...block, readingKey: crypto.randomUUID() } : block,
      ),
    },
  ]) {
    await expect(
      fixture.payload.update({
        collection: 'case-content',
        id: draft.id,
        data: { sections: [replacement] },
        draft: true,
        overrideAccess: false,
        req: await observedRequest('case-content', draft.id, await fixture.request()),
      }),
    ).rejects.toMatchObject({ status: 400 });
  }
});

it.each([
  { presentation: 'columns' },
  { presentation: 'comparison', columns: 2 },
  { presentation: 'process', className: 'grid' },
  { blocks: [{ blockType: 'comparison', cards: [] }] },
  { blocks: [{ blockType: 'text', style: 'color:red' }] },
  {
    blocks: [
      {
        blockType: 'text',
        content: {
          root: {
            type: 'root',
            version: 1,
            direction: null,
            format: '',
            indent: 0,
            children: [{ type: 'html', html: '<b>Free HTML</b>' }],
          },
        },
      },
    ],
  },
])(
  'recusa preset, quarto tipo e estilo/HTML livres antes de sanitizar o draft: %j',
  async (section) => {
    const shared = await identity();
    await expect(
      fixture.payload.create({
        collection: 'case-content',
        data: { case: shared.id, locale: 'pt', sections: [section] } as never,
        draft: true,
        overrideAccess: false,
        req: await fixture.request(),
      }),
    ).rejects.toMatchObject({ status: 400 });
  },
);

it('rejeita comparação incompleta ao publicar e preserva publicação anterior e outro idioma', async () => {
  const shared = await identity();
  const media = await mediaMetadataFixture(fixture.payload);
  const published = await fixture.payload.create({
    collection: 'case-content',
    data: {
      ...casePublicationFixture(media.id),
      case: shared.id,
      locale: 'pt',
      _status: 'published',
    } as never,
    depth: 0,
    overrideAccess: false,
    req: await fixture.request(),
  });
  const english = await fixture.payload.create({
    collection: 'case-content',
    data: {
      ...casePublicationFixture(media.id),
      title: 'Synthetic English public title',
      case: shared.id,
      locale: 'en',
      _status: 'published',
    } as never,
    depth: 0,
    overrideAccess: false,
    req: await fixture.request(),
  });
  await confirmPublic(published);
  await confirmPublic(english);
  const originalPortuguese = mapCaseDetail(
    await fixture.payload.findByID({
      collection: 'case-content',
      id: published.id,
      draft: false,
      depth: 0,
      overrideAccess: false,
    }),
  );
  expect(originalPortuguese).toBeDefined();
  const originalEnglish = await fixture.payload.findByID({
    collection: 'case-content',
    id: english.id,
    draft: false,
    depth: 0,
    overrideAccess: false,
  });
  const text = {
    blockType: 'text' as const,
    content: editorialText('Synthetic publication comparison'),
  };
  const image = {
    blockType: 'image' as const,
    image: { media: media.id, alt: 'Synthetic image', decorative: false },
  };
  for (const blocks of [[text], [text, text, text], [image, text]]) {
    await fixture.payload.update({
      collection: 'case-content',
      id: published.id,
      data: {
        _status: 'draft',
        title: 'Private comparison draft',
        sections: [{ presentation: 'comparison', blocks }],
      },
      draft: true,
      depth: 0,
      overrideAccess: false,
      req: await observedRequest('case-content', published.id, await fixture.request()),
    });
    await expect(
      fixture.payload.update({
        collection: 'case-content',
        id: published.id,
        data: { _status: 'published' },
        depth: 0,
        overrideAccess: false,
        req: await observedRequest('case-content', published.id, await fixture.request()),
      }),
    ).rejects.toMatchObject({
      status: 400,
      data: {
        errors: expect.arrayContaining([expect.objectContaining({ path: 'sections.0.blocks' })]),
      },
    });
    const currentPublic = await fixture.payload.findByID({
      collection: 'case-content',
      id: published.id,
      draft: false,
      depth: 0,
      overrideAccess: false,
    });
    expect(currentPublic.title).toBe('Synthetic title');
    expect(mapCaseDetail(currentPublic)).toEqual(originalPortuguese);
    expect(
      await fixture.payload.findByID({
        collection: 'case-content',
        id: english.id,
        draft: false,
        depth: 0,
        overrideAccess: false,
      }),
    ).toEqual(originalEnglish);
  }
  const valid = await fixture.payload.update({
    collection: 'case-content',
    id: published.id,
    data: {
      _status: 'published',
      title: 'Synthetic valid comparison',
      sections: [{ presentation: 'comparison', blocks: [text, text] }],
    },
    depth: 0,
    overrideAccess: false,
    req: await observedRequest('case-content', published.id, await fixture.request()),
  });
  await confirmPublic(valid);
  expect(
    (
      await fixture.payload.findByID({
        collection: 'case-content',
        id: valid.id,
        draft: false,
        depth: 0,
        overrideAccess: false,
      })
    ).title,
  ).toBe('Synthetic valid comparison');
  expect(valid.sections![0].blocks!.map((block) => block.blockType)).toEqual(['text', 'text']);
});

it('restaura versões com campos nulos como draft e mantém o título completo legado e ambas publicações', async () => {
  const shared = await identity();
  const media = await mediaMetadataFixture(fixture.payload);
  const old = casePublicationFixture(media.id);
  const pt = await fixture.payload.create({
    collection: 'case-content',
    data: {
      ...old,
      title: 'Legacy complete title',
      titleEmphasis: null,
      case: shared.id,
      locale: 'pt',
      _status: 'published',
      sections: old.sections.map((section) => ({
        ...section,
        presentation: null,
        eyebrow: null,
        description: null,
        note: null,
        blocks: section.blocks.map((block) => ({
          ...block,
          eyebrow: null,
          heading: null,
          note: null,
        })),
      })),
    } as never,
    depth: 0,
    overrideAccess: false,
    req: await fixture.request(),
  });
  await confirmPublic(pt);
  const versions = await fixture.payload.findVersions({
    collection: 'case-content',
    where: { parent: { equals: pt.id } },
    sort: '-createdAt',
    depth: 0,
    overrideAccess: false,
    req: await fixture.request(),
  });
  const legacyVersion = versions.docs.find(
    (version) => version.version.title === 'Legacy complete title',
  )!;
  expect(legacyVersion.version).toMatchObject({
    titleEmphasis: null,
    sections: [{ presentation: null, eyebrow: null }],
  });
  const latest = await fixture.payload.update({
    collection: 'case-content',
    id: pt.id,
    data: {
      title: 'Current',
      titleEmphasis: 'public title',
      sections: [
        {
          ...pt.sections![0],
          presentation: 'process',
          eyebrow: 'Process',
          description: 'Current description',
        },
      ],
      _status: 'published',
    },
    depth: 0,
    overrideAccess: false,
    req: await observedRequest('case-content', pt.id, await fixture.request()),
  });
  const english = await fixture.payload.create({
    collection: 'case-content',
    data: {
      ...casePublicationFixture(media.id),
      title: 'English public',
      titleEmphasis: 'counterpart',
      case: shared.id,
      locale: 'en',
      _status: 'published',
    } as never,
    depth: 0,
    overrideAccess: false,
    req: await fixture.request(),
  });
  await confirmPublic(latest);
  await confirmPublic(english);
  const currentPortuguese = mapCaseDetail(
    await fixture.payload.findByID({
      collection: 'case-content',
      id: pt.id,
      draft: false,
      depth: 0,
      overrideAccess: false,
    }),
  );
  expect(currentPortuguese).toBeDefined();
  const englishPublic = await fixture.payload.findByID({
    collection: 'case-content',
    id: english.id,
    draft: false,
    depth: 0,
    overrideAccess: false,
  });
  const req = await observedRequest('case-content', pt.id, await fixture.request());
  expect(
    await restoreCaseDraft(
      {
        contentId: pt.id,
        versionId: legacyVersion.id,
        expectedRevision: req.headers.get('x-editorial-revision')!,
      },
      req,
    ),
  ).toMatchObject({ ok: true });
  const restored = await fixture.payload.findByID({
    collection: 'case-content',
    id: pt.id,
    draft: true,
    depth: 0,
    overrideAccess: false,
    req: await fixture.request(),
  });
  expect(restored).toMatchObject({
    _status: 'draft',
    case: shared.id,
    locale: 'pt',
    title: 'Legacy complete title',
    titleEmphasis: null,
    sections: [{ presentation: null, eyebrow: null }],
  });
  expect(restored.sections![0].readingKey).toBe(pt.sections![0].readingKey);
  expect(restored.sections![0].blocks![0].readingKey).toBe(pt.sections![0].blocks![0].readingKey);
  const stillPublic = await fixture.payload.findByID({
    collection: 'case-content',
    id: pt.id,
    draft: false,
    depth: 0,
    overrideAccess: false,
  });
  expect(stillPublic).toMatchObject({
    title: 'Current',
    titleEmphasis: 'public title',
  });
  expect(mapCaseDetail(stillPublic)).toEqual(currentPortuguese);
  expect(mapCaseDetail(stillPublic)).toMatchObject({ title: 'Current public title' });
  expect(
    await fixture.payload.findByID({
      collection: 'case-content',
      id: english.id,
      draft: false,
      depth: 0,
      overrideAccess: false,
    }),
  ).toEqual(englishPublic);
});

async function confirmPublic(document: {
  latestPublicationIntent?: string | null;
  editorialRevision?: string | null;
}) {
  if (!document.latestPublicationIntent || !document.editorialRevision)
    throw new Error('Expected persisted publication intent and revision');
  expect(
    await retryPublicationUpdate(document.latestPublicationIntent, await fixture.request()),
  ).toMatchObject({
    ok: true,
    value: { state: 'public', targetRevision: document.editorialRevision },
  });
}
