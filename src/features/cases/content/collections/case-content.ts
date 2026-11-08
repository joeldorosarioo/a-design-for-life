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
      'Edite e publique cada idioma separadamente. As duas versões usam o mesmo cadastro em Projetos.',
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

      label: 'Projeto',

      type: 'relationship',

      relationTo: 'cases',

      admin: {
        description:
          'Selecione o mesmo projeto nas duas versões. A escolha fica fixa depois de salvar.',
      },

      required: true,
    },

    {
      name: 'locale',

      label: 'Idioma',

      type: 'select',

      required: true,

      admin: {
        description:
          'Escolha o idioma antes de salvar. Para traduzir, crie outro conteúdo para o mesmo projeto.',
      },

      options: [
        { label: 'Português', value: 'pt' },

        { label: 'Inglês', value: 'en' },
      ],
    },

    {
      name: 'eyebrow',
      label: 'Linha acima do título',
      type: 'text',
      admin: {
        description:
          'Use uma categoria curta, como Design de produto. Ela também aparece no cartão quando a linha do cartão fica vazia.',
      },
    },
    {
      name: 'title',
      label: 'Título do projeto',
      type: 'text',
      admin: {
        description:
          'Se parte do título receber destaque visual, coloque essa parte no próximo campo.',
      },
    },
    ...casePresentationFields(),
    {
      name: 'cardTitle',
      label: 'Título no cartão',
      type: 'text',
      admin: {
        description:
          'Use uma versão curta para a página inicial e a lista de projetos. Em branco, o cartão usa o título completo.',
      },
    },
    {
      name: 'cardEyebrow',
      label: 'Linha acima do título no cartão',
      type: 'text',
      admin: {
        description: 'Em branco, o cartão usa a linha acima do título da página do projeto.',
      },
    },

    {
      name: 'summary',
      label: 'Resumo no cartão',
      type: 'textarea',
      admin: {
        description:
          'Resuma o desafio e a proposta em poucas frases. O resumo é obrigatório para publicar.',
      },
    },

    {
      name: 'introduction',
      label: 'Introdução',
      type: 'textarea',
      admin: {
        description:
          'Apresente o projeto antes das seções. Use mais detalhes do que no resumo do cartão, se necessário.',
      },
    },

    {
      name: 'slug',
      label: 'Final do endereço',
      type: 'text',
      admin: {
        description:
          'Use um final como redesenho-do-aplicativo, com letras minúsculas sem acentos, números e hífens. Escolha um valor disponível neste idioma para publicar.',
        components: { afterInput: ['/features/cases/components/slug-suggestion#SlugSuggestion'] },
      },
    },

    imageUseField('cover', 'Imagem de capa'),
    {
      name: 'coverPresentation',
      label: 'Fundo da capa',
      type: 'select',
      options: [
        { label: 'Fundo cereja', value: 'contained-cherry' },
        { label: 'Fundo rosa suave', value: 'contained-soft' },
      ],
      admin: {
        description:
          'A imagem aparece inteira sobre o fundo. Se deixar em branco, o site usa o fundo cereja.',
      },
    },

    {
      name: 'role',
      label: 'Papel no projeto',
      type: 'text',
      admin: {
        description: 'Preencha para publicar. Use uma função como Designer de produto.',
      },
    },

    {
      name: 'scope',
      label: 'Responsabilidades',
      type: 'textarea',
      admin: {
        description:
          'Liste as atividades, como pesquisa com usuários, prototipação e testes de usabilidade.',
      },
    },

    {
      name: 'contextNote',
      label: 'Contexto complementar',
      type: 'textarea',
      admin: {
        description:
          'Use para incluir período, equipe ou outras informações na abertura do projeto.',
      },
    },

    {
      name: 'sections',

      label: 'Seções',
      labels: { singular: 'Seção', plural: 'Seções' },
      admin: {
        description:
          'Coloque as seções na ordem de leitura. Para publicar, adicione pelo menos um bloco de conteúdo ao projeto.',
      },

      type: 'array',

      fields: [
        {
          name: 'readingKey',
          label: 'Código da seção na tradução',
          type: 'text',
          admin: {
            description:
              'Copie o código da seção original ao criar a tradução. O painel gera o código ao salvar, e ele permanece fixo.',
          },
        },

        {
          name: 'heading',
          label: 'Título da seção',
          type: 'textarea',
          admin: {
            description: 'Aparece no sumário. Em branco, o sumário usa a linha acima do título.',
          },
        },
        ...sectionPresentationFields(),

        {
          name: 'blocks',
          label: 'Blocos de conteúdo',
          type: 'blocks',
          blocks: caseBlocks,
          admin: {
            description: 'Adicione os textos e as imagens na ordem de leitura.',
          },
        },
      ],
    },

    {
      name: 'seo',

      label: 'Busca e compartilhamento',
      admin: {
        description: 'Preencha os textos no idioma desta versão do projeto.',
      },

      type: 'group',

      fields: [
        {
          name: 'title',
          label: 'Título nos buscadores',
          type: 'text',
          admin: {
            description:
              'Pode aparecer na aba do navegador e nos resultados de busca. Em branco, o site usa o título do projeto.',
          },
        },

        {
          name: 'description',
          label: 'Descrição nos buscadores',
          type: 'textarea',
          admin: {
            description:
              'Descreva o projeto em uma ou duas frases para quem o encontrar em uma busca ou receber o link.',
          },
        },

        imageUseField('image', 'Imagem de compartilhamento'),
      ],
    },
  ],
});
