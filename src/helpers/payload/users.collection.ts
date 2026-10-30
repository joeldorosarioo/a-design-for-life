import 'server-only';
import { AuthenticationError, Forbidden, LockedAuth, type CollectionConfig } from 'payload';
import { EditorialEmailUnavailable } from './editorial-email';
import { reserveNativePasswordReset } from './password-reset-guard';

export function usersCollection(siteOrigin: string): CollectionConfig {
  return {
    slug: 'users',
    auth: {
      useSessions: true,
      tokenExpiration: 7200,
      removeTokenFromResponses: true,
      maxLoginAttempts: 5,
      lockTime: 600_000,
      forgotPassword: { expiration: 3_600_000, minRequestInterval: 15_000 },
      cookies: { sameSite: 'Lax', secure: new URL(siteOrigin).protocol === 'https:' },
    },
    admin: { useAsTitle: 'email' },
    access: {
      create: ({ req }) => req.user?.collection === 'users',
      read: ({ req }) => req.user?.collection === 'users',
      update: ({ req }) => req.user?.collection === 'users',
      delete: () => false,
    },
    hooks: {
      beforeOperation: [
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
      beforeChange: [
        ({ operation, req }) => {
          // Native first-register bypasses access. Only server code can set this context.
          if (
            operation === 'create' &&
            req.user?.collection !== 'users' &&
            req.context.trustedAccountProvisioning !== true
          )
            throw new Forbidden(req.t);
        },
      ],
    },
    fields: [],
  };
}
