import 'server-only';
import { APIError, type CollectionConfig } from 'payload';
import { immutableFields } from '@/helpers/payload/immutable-fields';
import { imageUseField } from '@/features/media-library/server';

export const ProfessionalProfiles: CollectionConfig = {
  slug: 'professional-profiles',
  dbName: 'profiles',
  labels: { singular: 'Perfil profissional', plural: 'Perfil profissional' },
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
      name: 'identity',
      label: 'Identificação',
      type: 'group',
      fields: [
        { name: 'name', label: 'Nome profissional', type: 'text' },
        { name: 'role', label: 'Apresentação profissional', type: 'text' },
      ],
    },
    {
      name: 'home',
      label: 'Apresentação da Home',
      type: 'group',
      fields: [
        { name: 'eyebrow', label: 'Identificação editorial', type: 'text' },
        { name: 'title', label: 'Título', type: 'text' },
        { name: 'titleEmphasis', label: 'Ênfase editorial do título', type: 'text' },
        { name: 'description', label: 'Descrição', type: 'textarea' },
        imageUseField('portrait', 'Retrato'),
        { name: 'projectsLabel', label: 'Rótulo da ação para projetos', type: 'text' },
      ],
    },
    {
      name: 'homeAbout',
      label: 'Sobre e trajetória na Home',
      type: 'group',
      fields: [
        { name: 'eyebrow', label: 'Identificação editorial', type: 'text' },
        { name: 'title', label: 'Título', type: 'text' },
        { name: 'description', label: 'Descrição', type: 'textarea' },
        {
          name: 'trajectory',
          label: 'Trajetória',
          type: 'array',
          fields: [
            { name: 'readingKey', label: 'Chave estável', type: 'text' },
            { name: 'period', label: 'Período', type: 'text' },
            { name: 'title', label: 'Título', type: 'text' },
            { name: 'description', label: 'Descrição', type: 'textarea' },
          ],
        },
        { name: 'aboutLabel', label: 'Rótulo da ação para Sobre', type: 'text' },
      ],
    },
    {
      name: 'approach',
      label: 'Abordagem',
      type: 'group',
      fields: [
        { name: 'eyebrow', label: 'Identificação editorial', type: 'text' },
        { name: 'title', label: 'Título', type: 'text' },
        { name: 'description', label: 'Descrição', type: 'textarea' },
        {
          name: 'methods',
          label: 'Cartões de método',
          type: 'array',
          fields: [
            { name: 'readingKey', label: 'Chave estável', type: 'text' },
            { name: 'title', label: 'Título', type: 'text' },
            { name: 'description', label: 'Descrição', type: 'textarea' },
          ],
        },
      ],
    },
    {
      name: 'about',
      label: 'Página Sobre',
      type: 'group',
      fields: [
        { name: 'eyebrow', label: 'Identificação editorial', type: 'text' },
        { name: 'title', label: 'Título de abertura', type: 'text' },
        { name: 'description', label: 'Descrição de abertura', type: 'textarea' },
        { name: 'introductionHeading', label: 'Título da introdução', type: 'text' },
        { name: 'introduction', label: 'Introdução', type: 'textarea' },
        imageUseField('portrait', 'Retrato da introdução'),
        { name: 'journeyHeading', label: 'Título do percurso', type: 'text' },
        { name: 'journey', label: 'Percurso', type: 'textarea' },
        imageUseField('deskPhotograph', 'Fotografia de mesa'),
        { name: 'editorialEmphasis', label: 'Pausa editorial', type: 'textarea' },
        { name: 'approachHeading', label: 'Título da abordagem', type: 'text' },
        { name: 'approach', label: 'Abordagem', type: 'textarea' },
        imageUseField('architecturePhotograph', 'Fotografia de arquitetura'),
        { name: 'inMotionHeading', label: 'Título de Em movimento', type: 'text' },
        { name: 'inMotion', label: 'Em movimento', type: 'textarea' },
        { name: 'closingHeading', label: 'Título do encerramento', type: 'text' },
        { name: 'closing', label: 'Encerramento', type: 'textarea' },
        { name: 'projectsLabel', label: 'Rótulo de acesso aos cases', type: 'text' },
      ],
    },
    {
      name: 'contacts',
      label: 'Contatos',
      type: 'group',
      fields: [
        { name: 'email', label: 'E-mail', type: 'email' },
        { name: 'linkedin', label: 'LinkedIn', type: 'text' },
      ],
    },
    { name: 'resume', label: 'Currículo PDF neste idioma', type: 'upload', relationTo: 'media' },
    {
      name: 'seo',
      label: 'Busca e compartilhamento',
      type: 'group',
      fields: [
        { name: 'homeTitle', label: 'Título de busca da Home', type: 'text' },
        { name: 'homeDescription', label: 'Descrição de busca da Home', type: 'textarea' },
        { name: 'aboutTitle', label: 'Título de busca de Sobre', type: 'text' },
        { name: 'aboutDescription', label: 'Descrição de busca de Sobre', type: 'textarea' },
        imageUseField('image', 'Imagem de compartilhamento'),
      ],
    },
  ],
};
