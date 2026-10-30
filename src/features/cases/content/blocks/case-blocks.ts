import 'server-only';
import type { Block } from 'payload';
import { imageUseField } from '@/features/media-library/server';

const readingKey = {
  name: 'readingKey',
  label: 'Chave de correspondência',
  type: 'text' as const,
  admin: {
    description: 'Identidade estável do trecho; compartilhar entre traduções equivalentes.',
  },
};
export const caseBlocks: Block[] = [
  {
    slug: 'text',
    labels: { singular: 'Texto formatado', plural: 'Textos formatados' },
    fields: [readingKey, { name: 'content', label: 'Conteúdo', type: 'richText' }],
  },
  {
    slug: 'image',
    labels: { singular: 'Imagem', plural: 'Imagens' },
    fields: [readingKey, imageUseField('image', 'Imagem')],
  },
  {
    slug: 'image-pair',
    labels: { singular: 'Par de imagens', plural: 'Pares de imagens' },
    fields: [
      readingKey,
      {
        name: 'presentation',
        label: 'Apresentação',
        type: 'select',
        defaultValue: 'pair',
        options: [
          { label: 'Par editorial', value: 'pair' },
          { label: 'Antes e depois', value: 'comparison' },
        ],
      },
      imageUseField('first', 'Primeira imagem'),
      imageUseField('second', 'Segunda imagem'),
      { name: 'firstLabel', label: 'Rótulo da primeira imagem', type: 'text' },
      { name: 'secondLabel', label: 'Rótulo da segunda imagem', type: 'text' },
    ],
  },
];
