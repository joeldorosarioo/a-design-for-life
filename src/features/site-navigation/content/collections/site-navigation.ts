import 'server-only';
import { APIError, type CollectionConfig } from 'payload';
import { immutableFields } from '@/helpers/payload/immutable-fields';

export const SiteNavigation: CollectionConfig = {
  slug: 'site-navigation',
  labels: { singular: 'Navegação', plural: 'Navegação' },
  admin: { useAsTitle: 'locale', defaultColumns: ['locale', '_status'] },
  versions: { drafts: true },
  hooks: {
    beforeChange: [immutableFields({ locale: 'Idioma não pode ser alterado.' })],
    beforeDelete: [
      () => {
        throw new APIError('Documento estrutural não pode ser excluído.', 403);
      },
    ],
  },
  access: {
    create: ({ req }) => Boolean(req.user),
    read: ({ req }) => (req.user ? true : { _status: { equals: 'published' } }),
    readVersions: ({ req }) => Boolean(req.user),
    update: ({ req }) => Boolean(req.user),
    delete: () => false,
  },
  fields: [
    {
      name: 'locale',
      unique: true,
      label: 'Idioma',
      type: 'select',
      required: true,
      options: ['pt', 'en'],
    },
    {
      name: 'header',
      label: 'Header',
      type: 'group',
      fields: [
        { name: 'brandLabel', label: 'Marca/retorno à Home', type: 'text' },
        { name: 'projectsLabel', label: 'Projetos', type: 'text' },
        { name: 'aboutLabel', label: 'Sobre', type: 'text' },
        { name: 'resumeLabel', label: 'Currículo', type: 'text' },
        { name: 'contactLabel', label: 'Contato', type: 'text' },
      ],
    },
    {
      name: 'footer',
      label: 'Footer',
      type: 'group',
      fields: [
        { name: 'eyebrow', label: 'Identificação editorial', type: 'text' },
        { name: 'title', label: 'Título', type: 'text' },
        { name: 'description', label: 'Descrição', type: 'textarea' },
        { name: 'emailLabel', label: 'Rótulo de e-mail', type: 'text' },
        { name: 'linkedinLabel', label: 'Rótulo de LinkedIn', type: 'text' },
        { name: 'resumeLabel', label: 'Rótulo de currículo', type: 'text' },
        { name: 'copyright', label: 'Encerramento editorial', type: 'text' },
      ],
    },
  ],
};
