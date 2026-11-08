import { getPublishedProfile } from '../../server/get-published-profile';
import { localeSchema } from '@/helpers/i18n/locale.schema';
import { isDraftOperation, protectEditorialCollection } from '@/helpers/payload/editorial-revision';
import { validateProfilePublication } from '../validate-publication';
import 'server-only';
import { APIError, type CollectionConfig } from 'payload';
import { profileInputSchema } from '../../contracts/profile.schema';
import { requiredIdentity, validatedWrite } from '@/helpers/payload/validate-input';
import { structuralIdentitySchema } from '../../contracts/identity.schema';
import { immutableFields } from '@/helpers/payload/immutable-fields';
import { imageUseField } from '@/features/media-library/server';
export const ProfessionalProfiles: CollectionConfig = protectEditorialCollection({
  slug: 'professional-profiles',
  dbName: 'profiles',
  labels: { singular: 'Perfil profissional', plural: 'Perfil profissional' },
  admin: {
    components: {
      edit: { UnpublishButton: '/helpers/payload/editorial-actions#NoUnpublishAction' },
    },
    useAsTitle: 'locale',
    defaultColumns: ['locale', '_status'],
  },
  custom: { editorialBootstrap: true },
  versions: { drafts: true },
  endpoints: [
    {
      path: '/published/:locale',
      method: 'get',
      handler: async (req) => {
        const parsed = localeSchema.safeParse(req.routeParams?.locale);
        if (!parsed.success)
          return Response.json(
            {
              ok: false,
              error: { code: 'unavailable', message: 'Published content unavailable.' },
            },
            { status: 404 },
          );
        const result = await getPublishedProfile(parsed.data);
        return Response.json(result, { status: result.ok ? 200 : 404 });
      },
    },
  ],
  hooks: {
    beforeOperation: [validatedWrite(profileInputSchema)],
    beforeChange: [
      async ({ data, originalDoc, req, collection }) => {
        if (
          data._status === 'draft' &&
          !isDraftOperation(req) &&
          !req.context.isRestoringVersion &&
          originalDoc?.id
        ) {
          const current = await req.payload.db.findOne({
            collection: collection.slug,
            req,
            where: { id: { equals: originalDoc.id } },
          });
          if ((current as { _status?: string } | null)?._status === 'published')
            throw new APIError(
              'Publicado: este documento estrutural não pode ser retirado de publicação.',
              400,
            );
        }
        return data;
      },
      validateProfilePublication,
      requiredIdentity(structuralIdentitySchema),
      immutableFields({ locale: 'Idioma não pode ser alterado.' }),
    ],
    beforeDelete: [
      () => {
        throw new APIError('Documento estrutural não pode ser excluído.', 403);
      },
    ],
  },
  access: {
    create: ({ req }) => Boolean(req.user) || req.context.trustedStructuralProvisioning === true,
    read: ({ req }) =>
      req.user || req.context.trustedStructuralProvisioning === true
        ? true
        : { _status: { equals: 'published' } },
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
      name: 'homeProjects',
      label: 'Projetos na Home',
      type: 'group',
      fields: [
        { name: 'eyebrow', label: 'Identificação editorial', type: 'text' },
        { name: 'title', label: 'Título', type: 'text' },
        { name: 'description', label: 'Descrição', type: 'textarea' },
      ],
    },
    {
      name: 'listing',
      label: 'Listagem de cases',
      type: 'group',
      fields: [
        { name: 'eyebrow', label: 'Identificação editorial', type: 'text' },
        { name: 'title', label: 'Título', type: 'text' },
        { name: 'description', label: 'Descrição', type: 'textarea' },
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
        { name: 'listingTitle', label: 'Título de busca da listagem', type: 'text' },
        { name: 'listingDescription', label: 'Descrição de busca da listagem', type: 'textarea' },
        { name: 'aboutTitle', label: 'Título de busca de Sobre', type: 'text' },
        { name: 'aboutDescription', label: 'Descrição de busca de Sobre', type: 'textarea' },
        imageUseField('image', 'Imagem de compartilhamento'),
      ],
    },
  ],
});
