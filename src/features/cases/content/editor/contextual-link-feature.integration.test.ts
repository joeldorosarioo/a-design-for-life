import { observedRequest } from '../../../../../testing/fixtures/editorial-lifecycle';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { afterAll, beforeAll, expect, it } from 'vitest';
import type { FormState, Field } from 'payload';
import { reduceFieldsToValues } from 'payload/shared';
import type { LexicalRichTextAdapter } from '@payloadcms/richtext-lexical';
import { createEditorialPayloadFixture } from '../../../../../testing/fixtures/editorial-payload';
import { contextualLinkFieldsSchema } from '../../contracts/contextual-link.schema';
const require = createRequire(import.meta.url);
const lexicalRequire = createRequire(require.resolve('@payloadcms/richtext-lexical'));
let fixture: Awaited<ReturnType<typeof createEditorialPayloadFixture>>;
beforeAll(async () => {
  fixture = await createEditorialPayloadFixture('e1.3-native-link-form');
});
afterAll(async () => {
  await fixture?.payload.destroy();
});
it.each([
  { destination: 'page', page: 'home' },
  { destination: 'page', page: 'cases' },
  { destination: 'page', page: 'about' },
  { destination: 'case', case: 'actual-case' },
  { destination: 'resume' },
  { destination: 'contact' },
  { destination: 'external', url: 'https://example.invalid/synthetic' },
])('o formulário nativo serializa destino aceito pelo servidor: %j', async (target) => {
  const shared = await fixture.payload.create({
    collection: 'cases',
    data: { internalTitle: 'Synthetic native link consumer' },
    req: await fixture.request(),
    overrideAccess: false,
  });
  if (target.destination === 'case') target.case = shared.id;
  const editor = fixture.payload.config.editor as LexicalRichTextAdapter;
  const fields = editor.editorConfig.resolvedFeatureMap.get('link')!.sanitizedServerFeatureProps
    .fields as Field[];
  const { fieldSchemasToFormState } = await import(
    pathToFileURL(lexicalRequire.resolve('@payloadcms/ui/forms/fieldSchemasToFormState')).href
  );
  const state: FormState = await fieldSchemasToFormState({
    collectionSlug: 'case-content',
    fields,
    data: { text: 'Synthetic link', linkType: 'custom', newTab: false, ...target },
    fieldSchemaMap: undefined,
    operation: 'create',
    permissions: {},
    preferences: {},
    renderAllFields: false,
    req: await fixture.request(),
    schemaPath: '',
  });
  const values = reduceFieldsToValues(state, true);
  delete values.text;
  expect(contextualLinkFieldsSchema.safeParse(values).success).toBe(true);
  const text = {
    type: 'text',
    version: 1,
    text: 'Synthetic native link',
    detail: 0,
    mode: 'normal',
    format: 0,
    style: '',
  };
  const link = {
    type: 'link',
    version: 3,
    format: '',
    indent: 0,
    direction: null,
    fields: values,
    children: [text],
  };
  const content = {
    root: {
      type: 'root',
      version: 1,
      format: '',
      indent: 0,
      direction: null,
      children: [
        { type: 'paragraph', version: 1, format: '', indent: 0, direction: null, children: [link] },
      ],
    },
  };
  await expect(
    fixture.payload.create({
      collection: 'case-content',
      data: {
        case: shared.id,
        locale: 'en',
        sections: [{ blocks: [{ blockType: 'text', content }] }],
      } as never,
      draft: true,
      req: await fixture.request(),
      overrideAccess: false,
    }),
  ).resolves.toMatchObject({ _status: 'draft' });
});

it('salva destino de link ainda incompleto como draft sem aceitar protocolo perigoso', async () => {
  const shared = await fixture.payload.create({
    collection: 'cases',
    data: { internalTitle: 'Synthetic incomplete link fixture' },
    req: await fixture.request(),
    overrideAccess: false,
  });
  const text = {
    type: 'text',
    version: 1,
    text: 'Synthetic link',
    detail: 0,
    mode: 'normal',
    format: 0,
    style: '',
  };
  const link = {
    type: 'link',
    version: 3,
    format: '',
    indent: 0,
    direction: null,
    fields: { linkType: 'custom', destination: 'external', newTab: false, url: '' },
    children: [text],
  };
  const content = {
    root: {
      type: 'root',
      version: 1,
      format: '',
      indent: 0,
      direction: null,
      children: [
        { type: 'paragraph', version: 1, format: '', indent: 0, direction: null, children: [link] },
      ],
    },
  };
  const result = fixture.payload.create({
    collection: 'case-content',
    data: {
      case: shared.id,
      locale: 'pt',
      sections: [{ blocks: [{ blockType: 'text', content }] }],
    } as never,
    draft: true,
    req: await fixture.request(),
    overrideAccess: false,
  });
  await expect(result).resolves.toMatchObject({ _status: 'draft' });
});

it('recarrega link external→page sem URL inativa persistida e rejeita protocolo ativo perigoso', async () => {
  const shared = await fixture.payload.create({
    collection: 'cases',
    data: { internalTitle: 'Synthetic link switch reload' },
    req: await fixture.request(),
    overrideAccess: false,
  });
  const editor = fixture.payload.config.editor as LexicalRichTextAdapter;
  const fields = editor.editorConfig.resolvedFeatureMap.get('link')!.sanitizedServerFeatureProps
    .fields as Field[];
  const { fieldSchemasToFormState } = await import(
    pathToFileURL(lexicalRequire.resolve('@payloadcms/ui/forms/fieldSchemasToFormState')).href
  );
  const serialize = async (data: Record<string, unknown>, operation: 'create' | 'update') => {
    const state: FormState = await fieldSchemasToFormState({
      collectionSlug: 'case-content',
      fields,
      data: { text: 'Synthetic switched link', linkType: 'custom', newTab: false, ...data },
      fieldSchemaMap: undefined,
      operation,
      permissions: {},
      preferences: {},
      renderAllFields: false,
      req: await fixture.request(),
      schemaPath: '',
    });
    const values = reduceFieldsToValues(state, true);
    delete values.text;
    return values;
  };
  const contentFor = (fields: Record<string, unknown>) => ({
    root: {
      type: 'root',
      version: 1,
      format: '',
      indent: 0,
      direction: null,
      children: [
        {
          type: 'paragraph',
          version: 1,
          format: '',
          indent: 0,
          direction: null,
          children: [
            {
              type: 'link',
              version: 3,
              format: '',
              indent: 0,
              direction: null,
              fields,
              children: [
                {
                  type: 'text',
                  version: 1,
                  text: 'Synthetic switched link',
                  detail: 0,
                  mode: 'normal',
                  format: 0,
                  style: '',
                },
              ],
            },
          ],
        },
      ],
    },
  });
  const oldURL = 'https://example.invalid/stale-external-url';
  const external = await serialize({ destination: 'external', url: oldURL }, 'create');
  const created = await fixture.payload.create({
    collection: 'case-content',
    data: {
      case: shared.id,
      locale: 'pt',
      sections: [{ blocks: [{ blockType: 'text', content: contentFor(external) }] }],
    } as never,
    draft: true,
    req: await fixture.request(),
    overrideAccess: false,
  });
  expect(JSON.stringify(created.sections)).toContain(oldURL);
  const page = await serialize({ ...external, destination: 'page', page: 'about' }, 'update');
  await fixture.payload.update({
    collection: 'case-content',
    id: created.id,
    data: { sections: [{ blocks: [{ blockType: 'text', content: contentFor(page) }] }] } as never,
    draft: true,
    req: await observedRequest('case-content', String(created.id), await fixture.request()),
    overrideAccess: false,
  });
  const reloaded = await fixture.payload.findByID({
    collection: 'case-content',
    id: created.id,
    depth: 0,
    draft: true,
    req: await fixture.request(),
    overrideAccess: false,
  });
  expect(reloaded.sections?.[0].blocks?.[0]).toMatchObject({
    blockType: 'text',
    content: {
      root: {
        children: [
          {
            children: [
              { fields: { linkType: 'custom', destination: 'page', page: 'about', newTab: false } },
            ],
          },
        ],
      },
    },
  });
  expect(JSON.stringify(reloaded.sections)).not.toContain(oldURL);
  expect(JSON.stringify(reloaded.sections)).toContain('"url":""');
  await expect(
    fixture.payload.update({
      collection: 'case-content',
      id: created.id,
      data: {
        sections: [
          {
            blocks: [
              {
                blockType: 'text',
                content: contentFor({
                  ...page,
                  destination: 'external',
                  url: 'javascript:alert(1)',
                }),
              },
            ],
          },
        ],
      } as never,
      draft: true,
      req: await observedRequest('case-content', String(created.id), await fixture.request()),
      overrideAccess: false,
    }),
  ).rejects.toMatchObject({ status: 400 });
});

it('rejeita URL absoluta da própria origem no destino externo com caminho de campo específico', async () => {
  const shared = await fixture.payload.create({
    collection: 'cases',
    data: { internalTitle: 'Synthetic same-origin link' },
    req: await fixture.request(),
    overrideAccess: false,
  });
  const url = new URL('/pt/about', fixture.payload.config.serverURL).href;
  const text = {
    type: 'text',
    version: 1,
    text: 'Synthetic free internal URL',
    detail: 0,
    mode: 'normal',
    format: 0,
    style: '',
  };
  const link = {
    type: 'link',
    version: 3,
    format: '',
    indent: 0,
    direction: null,
    fields: { linkType: 'custom', destination: 'external', newTab: false, url },
    children: [text],
  };
  const content = {
    root: {
      type: 'root',
      version: 1,
      format: '',
      indent: 0,
      direction: null,
      children: [
        { type: 'paragraph', version: 1, format: '', indent: 0, direction: null, children: [link] },
      ],
    },
  };
  await expect(
    fixture.payload.create({
      collection: 'case-content',
      data: {
        case: shared.id,
        locale: 'pt',
        sections: [{ blocks: [{ blockType: 'text', content }] }],
      } as never,
      draft: true,
      req: await fixture.request(),
      overrideAccess: true,
    }),
  ).rejects.toMatchObject({
    status: 400,
    data: {
      errors: [
        expect.objectContaining({
          path: 'sections.0.blocks.0.content.root.children.0.children.0.fields.url',
        }),
      ],
    },
  });
});
