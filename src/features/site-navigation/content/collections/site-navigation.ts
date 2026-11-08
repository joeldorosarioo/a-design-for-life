import { getPublishedNavigation } from '../../server/get-published-navigation';
import { localeSchema } from '@/helpers/i18n/locale.schema';
import { isDraftOperation, protectEditorialCollection } from '@/helpers/payload/editorial-revision';
import { validateNavigationPublication } from '../validate-publication';
import 'server-only';
import { APIError, type CollectionConfig } from 'payload';
import { navigationInputSchema } from '../../contracts/navigation.schema';
import { requiredIdentity, validatedWrite } from '@/helpers/payload/validate-input';
import { structuralIdentitySchema } from '../../contracts/identity.schema';
import { immutableFields } from '@/helpers/payload/immutable-fields';
export const SiteNavigation: CollectionConfig = protectEditorialCollection({
  slug: 'site-navigation',
  labels: { singular: 'Navegação', plural: 'Navegação' },
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
        const result = await getPublishedNavigation(parsed.data);
        return Response.json(result, { status: result.ok ? 200 : 404 });
      },
    },
  ],
  hooks: {
    beforeOperation: [validatedWrite(navigationInputSchema)],
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
      validateNavigationPublication,
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
    {
      name: 'controls',
      label: 'Rótulos dos controles fixos',
      type: 'group',
      fields: [
        { name: 'homeLabel', type: 'text' },
        { name: 'casesLabel', type: 'text' },
        { name: 'contentsLabel', type: 'text' },
        { name: 'previousSectionLabel', type: 'text' },
        { name: 'nextSectionLabel', type: 'text' },
        { name: 'openMenuLabel', type: 'text' },
        { name: 'closeMenuLabel', type: 'text' },
        { name: 'languageLabel', type: 'text' },
        { name: 'newTabLabel', type: 'text' },
        { name: 'roleLabel', type: 'text' },
        { name: 'scopeLabel', type: 'text' },
      ],
    },
    {
      name: 'messages',
      label: 'Estados funcionais públicos',
      type: 'group',
      fields: [
        { name: 'translationUnavailable', type: 'text' },
        { name: 'emptyCasesTitle', type: 'text' },
        { name: 'emptyCasesDescription', type: 'text' },
        { name: 'caseUnavailableTitle', type: 'text' },
        { name: 'caseUnavailableDescription', type: 'text' },
        { name: 'temporaryFailureTitle', type: 'text' },
        { name: 'temporaryFailureDescription', type: 'text' },
        { name: 'retryLabel', type: 'text' },
        { name: 'notFoundTitle', type: 'text' },
        { name: 'notFoundDescription', type: 'text' },
      ],
    },
  ],
});
