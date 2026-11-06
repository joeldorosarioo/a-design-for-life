import 'server-only';
import type { Block } from 'payload';
import { imageUseField } from '@/features/media-library/server';

const readingKey = {
  name: 'readingKey',
  label: 'Correspondência do bloco entre idiomas',
  type: 'text' as const,
  admin: {
    description:
      'Identificador gerado ao salvar para manter a posição de leitura na troca de idioma. Para um bloco equivalente na tradução, copie o identificador do bloco original. Não altere o identificador de um bloco já salvo.',
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
        label: 'Texto curto acima do título do bloco',
        type: 'text',
        admin: {
          description:
            'Pequena identificação exibida antes do título deste texto. Exemplo: Pesquisa ou Cenário inicial.',
        },
      },
      {
        name: 'heading',
        label: 'Título do bloco de texto',
        type: 'text',
        admin: {
          description:
            'Título deste trecho dentro da seção. Use para introduzir o assunto do texto abaixo.',
        },
      },
      {
        name: 'note',
        label: 'Observação do bloco de texto',
        type: 'textarea',
        admin: {
          description:
            'Informação complementar apresentada junto deste bloco, como uma ressalva ou explicação curta.',
        },
      },
      {
        name: 'content',
        label: 'Texto do bloco',
        type: 'richText',
        admin: {
          description:
            'Escreva o conteúdo deste trecho. Use os controles do editor para parágrafos, listas, destaques e links. O texto não pode ficar vazio ao publicar.',
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
    labels: { singular: 'Duas imagens lado a lado', plural: 'Pares de imagens' },
    fields: [
      readingKey,
      {
        name: 'presentation',
        label: 'Como apresentar as duas imagens',
        type: 'select',
        defaultValue: 'pair',
        admin: {
          description:
            'Escolha entre duas imagens relacionadas ou uma comparação de antes e depois. Na comparação, a primeira imagem representa o antes e a segunda representa o depois.',
        },
        options: [
          { label: 'Duas imagens relacionadas', value: 'pair' },
          { label: 'Antes e depois', value: 'comparison' },
        ],
      },
      imageUseField('first', 'Primeira imagem'),
      imageUseField('second', 'Segunda imagem'),
      {
        name: 'firstLabel',
        label: 'Texto de identificação da primeira imagem',
        type: 'text',
        admin: {
          description:
            'Texto curto mostrado junto à primeira imagem. Exemplo: Antes ou Versão inicial.',
        },
      },
      {
        name: 'secondLabel',
        label: 'Texto de identificação da segunda imagem',
        type: 'text',
        admin: {
          description:
            'Texto curto mostrado junto à segunda imagem. Exemplo: Depois ou Proposta final.',
        },
      },
    ],
  },
];
