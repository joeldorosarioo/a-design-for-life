import 'server-only';
import type { CollectionConfig } from 'payload';
import { imageUseField } from '@/features/media-library/server';
import { caseBlocks } from '../blocks/case-blocks';

export const CaseContent: CollectionConfig = {
  slug: 'case-content',
  labels: { singular: 'Conteúdo de case', plural: 'Conteúdos de cases' },
  admin: { useAsTitle: 'title', defaultColumns: ['title', 'case', 'locale', '_status'] },
  versions: { drafts: true },
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
    { name: 'title', label: 'Título público', type: 'text' },
    { name: 'summary', label: 'Resumo', type: 'textarea' },
    { name: 'introduction', label: 'Introdução da abertura', type: 'textarea' },
    { name: 'slug', label: 'Slug', type: 'text' },
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
};
