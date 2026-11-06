import { protectEditorialCollection } from '@/helpers/payload/editorial-revision';
import 'server-only';
import type { CollectionConfig } from 'payload';
import { protectCaseDeletion } from '../hooks/protect-case-deletion';

export const Cases: CollectionConfig = protectEditorialCollection({
  slug: 'cases',
  labels: { singular: 'Projeto', plural: 'Projetos' },
  admin: {
    description:
      'Cadastre cada projeto uma vez. Aqui você define a identificação, a ordem e o destaque; os textos em português e inglês ficam em Conteúdo dos projetos.',
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
      label: 'Nome do projeto no painel',
      type: 'text',
      required: true,
      admin: {
        description:
          'Nome para encontrar este projeto no CMS. Exemplo: Redesenho do aplicativo. O título exibido no site é preenchido em Conteúdo dos projetos.',
      },
    },
    {
      name: 'sortOrder',
      label: 'Ordem de exibição',
      type: 'number',
      defaultValue: 0,
      admin: {
        description:
          'Projetos com números menores aparecem primeiro. Esta ordem é compartilhada pelas versões em português e inglês.',
      },
    },
    {
      name: 'featured',
      label: 'Destacar na página inicial',
      type: 'checkbox',
      defaultValue: false,
      admin: {
        description:
          'Inclui este projeto entre os destaques da página inicial quando houver conteúdo publicado no idioma visitado.',
      },
    },
  ],
});
