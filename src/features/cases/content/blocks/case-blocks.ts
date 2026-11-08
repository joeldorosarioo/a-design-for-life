import 'server-only';
import type { Block } from 'payload';
import { imageUseField } from '@/features/media-library/server';

const readingKey = {
  name: 'readingKey',
  label: 'Código do bloco na tradução',
  type: 'text' as const,
  admin: {
    description:
      'Copie o código do bloco original ao criar a tradução. O painel gera o código ao salvar, e ele permanece fixo.',
  },
};
export const caseBlocks: Block[] = [
  {
    slug: 'text',
    labels: { singular: 'Texto formatado', plural: 'Textos formatados' },
    fields: [
      readingKey,
      {
        name: 'eyebrow',
        label: 'Linha acima do título',
        type: 'text',
        admin: {
          description: 'Use uma indicação curta, como Pesquisa ou Cenário inicial.',
        },
      },
      {
        name: 'heading',
        label: 'Título do bloco',
        type: 'text',
      },
      {
        name: 'note',
        label: 'Observação',
        type: 'textarea',
        admin: {
          description: 'Use para uma ressalva ou uma explicação breve.',
        },
      },
      {
        name: 'content',
        label: 'Texto',
        type: 'richText',
        admin: {
          description: 'Preencha este campo para publicar o bloco.',
        },
      },
    ],
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
        label: 'Apresentação das imagens',
        type: 'select',
        defaultValue: 'pair',
        admin: {
          description:
            'Em Antes e depois, coloque a imagem anterior primeiro e o resultado em seguida.',
        },
        options: [
          { label: 'Imagens relacionadas', value: 'pair' },
          { label: 'Antes e depois', value: 'comparison' },
        ],
      },
      imageUseField('first', 'Primeira imagem'),
      imageUseField('second', 'Segunda imagem'),
      {
        name: 'firstLabel',
        label: 'Identificação da primeira imagem',
        type: 'text',
        admin: {
          description: 'Use um texto curto, como Antes ou Versão inicial.',
        },
      },
      {
        name: 'secondLabel',
        label: 'Identificação da segunda imagem',
        type: 'text',
        admin: {
          description: 'Use um texto curto, como Depois ou Proposta final.',
        },
      },
    ],
  },
];
