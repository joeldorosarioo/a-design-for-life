import { protectEditorialCollection } from '@/helpers/payload/editorial-revision';
import 'server-only';
import type { CollectionConfig } from 'payload';
import { protectCaseDeletion } from '../hooks/protect-case-deletion';

export const Cases: CollectionConfig = protectEditorialCollection({
  slug: 'cases',
  labels: { singular: 'Projeto', plural: 'Projetos' },
  admin: {
    description:
      'Cadastre o projeto uma vez. Em Conteúdo dos projetos, crie uma versão em português e outra em inglês.',
    useAsTitle: 'internalTitle',
    defaultColumns: ['internalTitle', 'sortOrder', 'featured'],
  },
  hooks: { beforeDelete: [protectCaseDeletion] },
  access: {
    create: ({ req }) => Boolean(req.user),
    read: ({ req }) => Boolean(req.user),
    update: ({ req }) => Boolean(req.user),
    delete: ({ req }) => Boolean(req.user),
  },
  fields: [
    {
      name: 'internalTitle',
      label: 'Nome interno',
      type: 'text',
      required: true,
      admin: {
        description:
          'Use um nome que facilite encontrar o projeto no painel. O título público fica em Conteúdo dos projetos.',
      },
    },
    {
      name: 'sortOrder',
      label: 'Ordem de exibição',
      type: 'number',
      defaultValue: 0,
      admin: {
        description: 'Números menores aparecem primeiro nos dois idiomas.',
      },
    },
    {
      name: 'featured',
      label: 'Mostrar na página inicial',
      type: 'checkbox',
      defaultValue: false,
      admin: {
        description: 'O destaque aparece apenas nos idiomas em que o projeto estiver publicado.',
      },
    },
  ],
});
