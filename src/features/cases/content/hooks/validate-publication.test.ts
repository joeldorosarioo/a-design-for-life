import { expect, it } from 'vitest';
import type { PayloadRequest, SanitizedCollectionConfig } from 'payload';
import { validateCasePublication } from './validate-publication';
const content = {
  root: {
    type: 'root',
    version: 1,
    direction: null,
    format: '',
    indent: 0,
    children: [
      {
        type: 'paragraph',
        version: 1,
        direction: null,
        format: '',
        indent: 0,
        children: [
          {
            type: 'text',
            version: 1,
            text: 'Synthetic narrative',
            format: 0,
            detail: 0,
            mode: 'normal',
            style: '',
          },
        ],
      },
    ],
  },
};
const textBlock = { blockType: 'text', content };
function validate(
  blocks: unknown[],
  status = 'published',
  presentation: string | null = 'comparison',
) {
  const data = {
    _status: status,
    title: 'Synthetic title',
    summary: 'Synthetic summary',
    role: 'Synthetic role',
    slug: 'synthetic-title',
    cover: {
      media: 'c809e606-0071-4ff0-a074-08530d91bd83',
      alt: 'Synthetic cover',
      decorative: false,
    },
    sections: [{ presentation, blocks }],
  };
  return validateCasePublication({
    data,
    operation: 'create',
    context: {},
    req: {} as PayloadRequest,
    collection: { slug: 'case-content' } as SanitizedCollectionConfig,
  });
}

it.each([
  ['um cartão', [textBlock]],
  ['três cartões', [textBlock, textBlock, textBlock]],
  [
    'imagem e texto',
    [
      {
        blockType: 'image',
        image: { media: 'c809e606-0071-4ff0-a074-08530d91bd83', alt: 'Image' },
      },
      textBlock,
    ],
  ],
])('rejeita comparação publicada com %s', (_, blocks) => {
  expect(() => validate(blocks)).toThrow(/sections.0.blocks/);
});
it('permite exatamente dois textos na comparação e aceita comparação incompleta como draft', () => {
  expect(() => validate([textBlock, textBlock])).not.toThrow();
  expect(() => validate([], 'draft')).not.toThrow();
  expect(() => validate([textBlock], 'draft')).not.toThrow();
});
