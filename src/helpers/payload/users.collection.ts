import 'server-only';
import { AuthenticationError, LockedAuth, type CollectionConfig } from 'payload';
import { EditorialEmailUnavailable } from './editorial-email';
import { reserveNativePasswordReset } from './password-reset-guard';
import { editorialFirstAccess, type EditorialFirstAccessOptions } from './editorial-first-access';

export function usersCollection(
  siteOrigin: string,
  options?: EditorialFirstAccessOptions,
): CollectionConfig {
  const firstAccess = editorialFirstAccess(siteOrigin, options);
  return {
    slug: 'users',
    labels: { singular: 'Usuário', plural: 'Usuários' },
    auth: {
      useSessions: true,
      tokenExpiration: 7200,
      removeTokenFromResponses: true,
      maxLoginAttempts: 5,
      lockTime: 600_000,
      forgotPassword: { expiration: 3_600_000, minRequestInterval: 15_000 },
      cookies: { sameSite: 'Lax', secure: new URL(siteOrigin).protocol === 'https:' },
    },
    admin: {
      useAsTitle: 'email',
      description:
        'Contas de acesso ao painel. O nome e a foto identificam quem edita o conteúdo; são separados do perfil profissional público da Eliana.',
    },
    access: {
      create: ({ req }) => req.user?.collection === 'users',
      read: ({ req }) => req.user?.collection === 'users',
      update: ({ req }) => req.user?.collection === 'users',
      delete: () => false,
    },
    hooks: {
      beforeOperation: [
        firstAccess.beforeOperation,
        reserveNativePasswordReset,
        ({ operation, req }) => {
          if (
            operation === 'login' ||
            operation === 'forgotPassword' ||
            operation === 'resetPassword'
          ) {
            req.context.editorialAuthOperation = operation;
            req.responseHeaders ??= new Headers();
            req.responseHeaders.set('Cache-Control', 'no-store, max-age=0');
          }
        },
      ],
      afterError: [
        ({ error, req }) => {
          if (
            req.context.editorialAuthOperation === 'login' &&
            (error instanceof AuthenticationError || error instanceof LockedAuth)
          ) {
            return {
              status: 401,
              response: { errors: [{ message: 'The email or password provided is incorrect.' }] },
            };
          }
          if (
            req.context.editorialAuthOperation === 'forgotPassword' &&
            error instanceof EditorialEmailUnavailable
          ) {
            return { status: 200, response: { message: req.t('general:success') } };
          }
        },
      ],
      beforeChange: [firstAccess.beforeChange],
      afterChange: [firstAccess.afterChange],
    },
    fields: [
      {
        name: 'name',
        label: 'Nome de exibição',
        type: 'text',
        admin: {
          description:
            'Como você quer ser identificado no painel. Este é o nome da sua conta e não altera o nome público da Eliana no portfólio.',
        },
      },
      {
        name: 'avatar',
        label: 'Foto de perfil da conta',
        type: 'upload',
        relationTo: 'media',
        filterOptions: {
          mimeType: { in: ['image/jpeg', 'image/png', 'image/webp', 'image/avif'] },
        },
        admin: {
          description:
            'Selecione ou envie uma imagem JPEG, PNG, WebP ou AVIF de até 10 MB. A foto aparece na sua conta do painel e não altera o retrato público da Eliana. Sem foto, o painel usa suas iniciais.',
        },
      },
    ],
  };
}
