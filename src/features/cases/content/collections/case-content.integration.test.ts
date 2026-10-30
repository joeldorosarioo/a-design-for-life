import { observedRequest } from '../../../../../testing/fixtures/editorial-lifecycle';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { caseEditorialError, translateCaseConflict } from '../../server/translate-case-conflict';

import { createEditorialPayloadFixture } from '../../../../../testing/fixtures/editorial-payload';

let fixture: Awaited<ReturnType<typeof createEditorialPayloadFixture>>;

beforeAll(async () => {
  fixture = await createEditorialPayloadFixture('e1.3-case-content');
});

afterAll(async () => {
  await fixture?.payload.destroy();
});

async function identity() {
  return fixture.payload.create({
    collection: 'cases',
    data: { internalTitle: 'Synthetic integration fixture' },
    overrideAccess: false,
    req: await fixture.request(),
  });
}

describe('identidade editorial de case no PostgreSQL real', () => {
  it('duas criações simultâneas do mesmo case/idioma mantêm uma tradução e permitem o outro idioma', async () => {
    const shared = await identity();

    const [reqA, reqB] = await Promise.all([fixture.request(), fixture.request()]);

    const results = await Promise.allSettled(
      [reqA, reqB].map((req) =>
        fixture.payload.create({
          collection: 'case-content',
          data: { case: shared.id, locale: 'pt', _status: 'draft' },
          draft: true,
          overrideAccess: false,
          req,
        }),
      ),
    );

    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);

    expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1);

    const rejected = results.find((result) => result.status === 'rejected');

    if (rejected?.status !== 'rejected') throw new Error('Expected database conflict');

    expect(translateCaseConflict(rejected.reason, reqA)).toMatchObject({
      code: 'translation-conflict',
      field: 'locale',
    });

    expect(
      await caseEditorialError({ error: rejected.reason, req: reqA, context: reqA.context }),
    ).toMatchObject({
      status: 409,
      response: {
        errors: [expect.objectContaining({ code: 'translation-conflict', path: 'locale' })],
      },
    });

    const english = await fixture.payload.create({
      collection: 'case-content',
      data: { case: shared.id, locale: 'en', _status: 'draft' },
      draft: true,
      overrideAccess: false,
      req: await fixture.request(),
    });

    expect(english.locale).toBe('en');

    const docs = await fixture.payload.find({
      collection: 'case-content',
      where: { case: { equals: shared.id } },
      draft: true,
      overrideAccess: false,
      req: await fixture.request(),
    });

    expect(docs.totalDocs).toBe(2);
  });
});

it('exige case e locale válidos mesmo no rascunho incompleto', async () => {
  const shared = await identity();

  for (const data of [{ locale: 'pt' }, { case: shared.id }, { case: shared.id, locale: 'fr' }]) {
    await expect(
      fixture.payload.create({
        collection: 'case-content',
        data: data as never,
        draft: true,
        overrideAccess: true,
        req: await fixture.request(),
      }),
    ).rejects.toMatchObject({ status: 400 });
  }
});

it('rejeita mudança de case ou idioma sem depender de colisão', async () => {
  const first = await identity();

  const other = await identity();

  const content = await fixture.payload.create({
    collection: 'case-content',
    data: { case: first.id, locale: 'pt' },
    draft: true,
    overrideAccess: false,
    req: await fixture.request(),
  });

  for (const data of [{ case: other.id }, { locale: 'en' }]) {
    await expect(
      fixture.payload.update({
        collection: 'case-content',
        id: content.id,
        data: data as never,
        draft: true,
        overrideAccess: true,
        req: await observedRequest('case-content', String(content.id), await fixture.request()),
      }),
    ).rejects.toMatchObject({ status: 400 });
  }

  const preserved = await fixture.payload.findByID({
    collection: 'case-content',
    id: content.id,
    depth: 0,
    draft: true,
    overrideAccess: false,
    req: await fixture.request(),
  });

  expect(preserved.case).toBe(first.id);

  expect(preserved.locale).toBe('pt');
});

it('rejeita estilo livre, embed, HTML e quarto tipo de bloco antes de sanitizar drafts', async () => {
  const shared = await identity();
  const text = {
    type: 'text',
    version: 1,
    text: 'Synthetic text',
    format: 0,
    detail: 0,
    mode: 'normal',
    style: '',
  };
  const paragraph = {
    type: 'paragraph',
    version: 1,
    direction: null,
    format: '',
    indent: 0,
    children: [text],
  };
  const content = (children: unknown[]) => ({
    root: { type: 'root', version: 1, direction: null, format: '', indent: 0, children },
  });
  const invalidBlocks = [
    {
      blockType: 'text',
      content: content([{ ...paragraph, children: [{ ...text, style: 'color:red' }] }]),
    },
    { blockType: 'text', content: content([{ type: 'html', html: '<script>alert(1)</script>' }]) },
    { blockType: 'text', content: content([{ type: 'embed', url: 'https://example.invalid' }]) },
    { blockType: 'carousel', slides: [] },
  ];
  for (const block of invalidBlocks) {
    await expect(
      fixture.payload.create({
        collection: 'case-content',
        data: {
          case: shared.id,
          locale: 'pt',
          sections: [{ heading: 'Synthetic section', blocks: [block] }],
        } as never,
        draft: true,
        overrideAccess: true,
        req: await fixture.request(),
      }),
    ).rejects.toMatchObject({ status: 400 });
  }
});

it('gera correspondências estáveis que sobrevivem a título, reordenação e tradução explícita', async () => {
  const shared = await identity();
  const content = await fixture.payload.create({
    collection: 'case-content',
    data: {
      case: shared.id,
      locale: 'pt',
      sections: [
        { heading: 'Synthetic first', blocks: [{ blockType: 'text' }] },
        {
          heading: 'Synthetic second',
          blocks: [{ blockType: 'image-pair', presentation: 'comparison' }],
        },
      ],
    },
    draft: true,
    overrideAccess: false,
    req: await fixture.request(),
  });
  const first = content.sections![0];
  const second = content.sections![1];
  expect(first.readingKey).toEqual(expect.stringMatching(/^[0-9a-f-]{36}$/));
  expect(first.blocks![0].readingKey).toEqual(expect.stringMatching(/^[0-9a-f-]{36}$/));
  const changed = await fixture.payload.update({
    collection: 'case-content',
    id: content.id,
    data: {
      sections: [
        { ...second, heading: 'Synthetic translated-size independent heading' },
        { ...first, heading: 'Synthetic renamed' },
      ],
    },
    draft: true,
    overrideAccess: false,
    req: await observedRequest('case-content', String(content.id), await fixture.request()),
  });
  expect(changed.sections!.map((section) => section.readingKey)).toEqual([
    second.readingKey,
    first.readingKey,
  ]);
  expect(changed.sections![1].blocks![0].readingKey).toBe(first.blocks![0].readingKey);
  const english = await fixture.payload.create({
    collection: 'case-content',
    data: {
      case: shared.id,
      locale: 'en',
      sections: [
        {
          readingKey: first.readingKey,
          heading: 'Synthetic English counterpart',
          blocks: first.blocks!.map((block) => {
            const copy = { ...block };
            delete copy.id;
            return copy;
          }),
        },
      ],
    },
    draft: true,
    overrideAccess: false,
    req: await fixture.request(),
  });
  expect(english.sections![0].readingKey).toBe(first.readingKey);
});

it('bloqueia substituir chave de leitura de linha existente', async () => {
  const shared = await identity();
  const current = await fixture.payload.create({
    collection: 'case-content',
    data: {
      case: shared.id,
      locale: 'pt',
      sections: [{ heading: 'Synthetic section', blocks: [{ blockType: 'text' }] }],
    },
    draft: true,
    overrideAccess: false,
    req: await fixture.request(),
  });
  const section = current.sections![0];
  await expect(
    fixture.payload.update({
      collection: 'case-content',
      id: current.id,
      data: { sections: [{ ...section, readingKey: 'd42b29dc-2e53-46b1-ac74-04161d94cadb' }] },
      draft: true,
      overrideAccess: true,
      req: await observedRequest('case-content', String(current.id), await fixture.request()),
    }),
  ).rejects.toMatchObject({ status: 400 });
});
it('bloqueia chaves repetidas entre seções e blocos do mesmo documento', async () => {
  const shared = await identity();
  const readingKey = 'd42b29dc-2e53-46b1-ac74-04161d94cadb';
  await expect(
    fixture.payload.create({
      collection: 'case-content',
      data: {
        case: shared.id,
        locale: 'pt',
        sections: [{ readingKey, blocks: [{ blockType: 'text', readingKey }] }],
      },
      draft: true,
      overrideAccess: true,
      req: await fixture.request(),
    }),
  ).rejects.toMatchObject({ status: 400 });
});
