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

export const CaseContent: CollectionConfig = protectEditorialCollection({
  slug: 'case-content',

  labels: { singular: 'Conteúdo de case', plural: 'Conteúdos de cases' },

  admin: {
    components: {
      edit: { UnpublishButton: '/helpers/payload/editorial-actions#EditorialUnpublishAction' },
    },
    useAsTitle: 'title',
    defaultColumns: ['title', 'case', 'locale', '_status'],
  },

  versions: { drafts: true },

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

      label: 'Identidade do case',

      type: 'relationship',

      relationTo: 'cases',

      required: true,
    },

    {
      name: 'locale',

      label: 'Idioma',

      type: 'select',

      required: true,

      options: [
        { label: 'Português', value: 'pt' },

        { label: 'English', value: 'en' },
      ],
    },

    { name: 'eyebrow', label: 'Identificação editorial do estudo', type: 'text' },
    { name: 'title', label: 'Título público', type: 'text' },
    ...casePresentationFields(),

    { name: 'summary', label: 'Resumo', type: 'textarea' },

    { name: 'introduction', label: 'Introdução da abertura', type: 'textarea' },

    {
      name: 'slug',
      label: 'Slug',
      type: 'text',
      admin: {
        components: { afterInput: ['/features/cases/components/slug-suggestion#SlugSuggestion'] },
      },
    },

    imageUseField('cover', 'Capa'),

    { name: 'role', label: 'Papel profissional', type: 'text' },

    { name: 'scope', label: 'Escopo', type: 'textarea' },

    { name: 'contextNote', label: 'Nota de contexto', type: 'textarea' },

    {
      name: 'sections',

      label: 'Seções',

      type: 'array',

      fields: [
        { name: 'readingKey', label: 'Chave estável da seção', type: 'text' },

        { name: 'heading', label: 'Título da seção', type: 'text' },
        ...sectionPresentationFields(),

        { name: 'blocks', label: 'Blocos', type: 'blocks', blocks: caseBlocks },
      ],
    },

    {
      name: 'seo',

      label: 'Busca e compartilhamento',

      type: 'group',

      fields: [
        { name: 'title', label: 'Título de busca', type: 'text' },

        { name: 'description', label: 'Descrição de busca', type: 'textarea' },

        imageUseField('image', 'Imagem de compartilhamento'),
      ],
    },
  ],
});
