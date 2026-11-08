import {
  casePresentationFields,
  sectionPresentationFields,
} from '../fields/case-presentation-fields';
import { synchronizeCaseMedia, retainDeletedCaseMedia } from '../hooks/case-media-usage';
import { synchronizeCaseRoutes, protectContentRouteDeletion } from '../hooks/case-routes';
import { protectEditorialCollection } from '@/helpers/payload/editorial-revision';
import { validateCasePublication } from '../hooks/validate-publication';
import 'server-only';

import { immutableFields } from '@/helpers/payload/immutable-fields';

import { caseInputSchema } from '../../contracts/case.schema';
import { requiredIdentity, validatedWrite } from '@/helpers/payload/validate-input';

import { caseIdentitySchema } from '../../contracts/case-identity.schema';

import type { CollectionConfig } from 'payload';

import { imageUseField } from '@/features/media-library/server';

import { stableReadingKeys } from '../hooks/stable-reading-keys';
import { rejectSameOriginExternalLinks } from '../hooks/reject-same-origin-external-links';
import { caseBlocks } from '../blocks/case-blocks';
import { publishedCaseAggregateEndpoint } from '../../server/published-case-aggregate';

export const CaseContent: CollectionConfig = protectEditorialCollection({
  slug: 'case-content',

  labels: { singular: 'Conteúdo do projeto', plural: 'Conteúdo dos projetos' },

  admin: {
    description:
      'Escreva a versão de um projeto em português ou inglês. Cada idioma tem seu próprio rascunho e sua própria publicação; os campos de ajuda permanecem em português.',
    components: {
      edit: { UnpublishButton: '/helpers/payload/editorial-actions#EditorialUnpublishAction' },
    },
    useAsTitle: 'title',
    defaultColumns: ['title', 'case', 'locale', '_status'],
  },

  versions: { drafts: true },
  endpoints: [publishedCaseAggregateEndpoint],

  indexes: [{ fields: ['case', 'locale'], unique: true }],

  hooks: {
    afterChange: [synchronizeCaseRoutes, synchronizeCaseMedia],
    beforeDelete: [protectContentRouteDeletion, retainDeletedCaseMedia],
    beforeOperation: [validatedWrite(caseInputSchema)],
    beforeChange: [
      validateCasePublication,
      rejectSameOriginExternalLinks,
      stableReadingKeys,
      requiredIdentity(caseIdentitySchema),
      immutableFields({
        case: 'Identidade do case não pode ser alterada.',
        locale: 'Idioma não pode ser alterado.',
      }),
    ],
  },

  access: {
    create: ({ req }) => Boolean(req.user),

    read: ({ req }) => (req.user ? true : { _status: { equals: 'published' } }),

    readVersions: ({ req }) => Boolean(req.user),

    update: ({ req }) => Boolean(req.user),

    delete: ({ req }) => Boolean(req.user),
  },

  fields: [
    {
      name: 'case',

      label: 'Projeto correspondente',

      type: 'relationship',

      relationTo: 'cases',

      admin: {
        description:
          'Selecione o projeto cadastrado em Projetos. As versões em português e inglês devem apontar para o mesmo projeto. Esta escolha não pode ser alterada depois de salvar.',
      },

      required: true,
    },

    {
      name: 'locale',

      label: 'Idioma deste conteúdo',

      type: 'select',

      required: true,

      admin: {
        description:
          'Escolha o idioma dos textos que serão exibidos no site. Esta escolha não pode ser alterada depois de salvar. Para o outro idioma, crie outro conteúdo para o mesmo projeto.',
      },

      options: [
        { label: 'Português', value: 'pt' },

        { label: 'Inglês', value: 'en' },
      ],
    },

    {
      name: 'eyebrow',
      label: 'Texto curto acima do título',
      type: 'text',
      admin: {
        description:
          'Identifica o tipo de projeto na abertura. Exemplo: Design de produto. Também aparece no cartão do projeto quando não houver um texto específico para ele.',
      },
    },
    {
      name: 'title',
      label: 'Título do projeto no site',
      type: 'text',
      admin: {
        description:
          'Título principal exibido na página do projeto. Se houver uma continuação em destaque, preencha-a no campo seguinte.',
      },
    },
    ...casePresentationFields(),
    {
      name: 'cardTitle',
      label: 'Título no cartão do projeto (opcional)',
      type: 'text',
      admin: {
        description:
          'Título mais curto para os cartões da página inicial e da lista de projetos. Se ficar vazio, será usado o título completo do projeto.',
      },
    },
    {
      name: 'cardEyebrow',
      label: 'Texto acima do título no cartão (opcional)',
      type: 'text',
      admin: {
        description:
          'Texto curto mostrado acima do título nos cartões. Se ficar vazio, será usado o texto da abertura do projeto.',
      },
    },

    {
      name: 'summary',
      label: 'Resumo do projeto',
      type: 'textarea',
      admin: {
        description:
          'Apresentação curta exibida no cartão do projeto. Resuma o desafio e a proposta; este texto é obrigatório para publicar.',
      },
    },

    {
      name: 'introduction',
      label: 'Introdução da página do projeto',
      type: 'textarea',
      admin: {
        description:
          'Texto de abertura apresentado na página do projeto, antes das seções do estudo. Pode ser mais detalhado que o resumo do cartão.',
      },
    },

    {
      name: 'slug',
      label: 'Endereço do projeto na URL',
      type: 'text',
      admin: {
        description:
          'Última parte do endereço desta tradução. Exemplo: redesenho-do-aplicativo. Use letras minúsculas, números e hífens; o endereço deve estar livre neste idioma. Obrigatório para publicar.',
        components: { afterInput: ['/features/cases/components/slug-suggestion#SlugSuggestion'] },
      },
    },

    imageUseField('cover', 'Imagem de capa do projeto'),
    {
      name: 'coverPresentation',
      label: 'Cor de fundo da capa (opcional)',
      type: 'select',
      options: [
        { label: 'Fundo cereja', value: 'contained-cherry' },
        { label: 'Fundo rosa suave', value: 'contained-soft' },
      ],
      admin: {
        description:
          'Escolha a composição da imagem na abertura do projeto. A imagem fica inteira sobre a cor selecionada; se não escolher, será usado o fundo cereja.',
      },
    },

    {
      name: 'role',
      label: 'Sua função no projeto',
      type: 'text',
      admin: {
        description:
          'Função exercida por Eliana neste trabalho. Exemplo: Designer de produto. Este campo é obrigatório para publicar.',
      },
    },

    {
      name: 'scope',
      label: 'Atividades realizadas no projeto',
      type: 'textarea',
      admin: {
        description:
          'Descreva as responsabilidades e entregas de Eliana. Exemplo: Pesquisa com usuários, prototipação e testes de usabilidade.',
      },
    },

    {
      name: 'contextNote',
      label: 'Informações adicionais sobre o projeto',
      type: 'textarea',
      admin: {
        description:
          'Contexto complementar exibido na abertura, como período, equipe ou condições do estudo. Preencha apenas informações que pertençam a este projeto.',
      },
    },

    {
      name: 'sections',

      label: 'Seções do estudo',
      labels: { singular: 'Seção', plural: 'Seções' },
      admin: {
        description:
          'Organize a narrativa do projeto na ordem de leitura. Cada seção pode reunir textos e imagens; o sumário é criado a partir destes títulos. Para publicar, adicione pelo menos um bloco de conteúdo.',
      },

      type: 'array',

      fields: [
        {
          name: 'readingKey',
          label: 'Correspondência da seção entre idiomas',
          type: 'text',
          admin: {
            description:
              'Identificador gerado ao salvar para manter a posição de leitura na troca de idioma. Ao criar a seção equivalente na tradução, copie o identificador da seção original. Não altere o identificador de uma seção já salva.',
          },
        },

        {
          name: 'heading',
          label: 'Título da seção',
          type: 'textarea',
          admin: {
            description:
              'Título principal desta parte do estudo. Também será usado no sumário; se ficar vazio, será usado o texto curto da seção.',
          },
        },
        ...sectionPresentationFields(),

        {
          name: 'blocks',
          label: 'Textos e imagens da seção',
          type: 'blocks',
          blocks: caseBlocks,
          admin: {
            description:
              'Adicione e ordene os conteúdos desta seção: texto formatado, uma imagem ou duas imagens. Na apresentação Antes e depois, use exatamente dois blocos de texto, nessa ordem.',
          },
        },
      ],
    },

    {
      name: 'seo',

      label: 'Aparência nos buscadores e compartilhamentos',
      admin: {
        description:
          'Textos e imagem usados ao encontrar ou compartilhar a página deste projeto. Preencha no idioma deste conteúdo.',
      },

      type: 'group',

      fields: [
        {
          name: 'title',
          label: 'Título nos buscadores',
          type: 'text',
          admin: {
            description:
              'Título específico para a aba do navegador e os resultados de busca. Use este campo se quiser apresentar um texto diferente do título do projeto.',
          },
        },

        {
          name: 'description',
          label: 'Descrição nos buscadores',
          type: 'textarea',
          admin: {
            description:
              'Resumo da página para resultados de busca e compartilhamentos. Explique em uma ou duas frases o assunto deste projeto.',
          },
        },

        imageUseField('image', 'Imagem de compartilhamento'),
      ],
    },
  ],
});
