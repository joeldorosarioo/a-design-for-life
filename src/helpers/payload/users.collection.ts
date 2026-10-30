import 'server-only';
import { Forbidden, type CollectionConfig } from 'payload';

// Initial auth collection needed by the native admin; E1.7 completes account flows.
export const Users: CollectionConfig = {
  slug: 'users',
  auth: true,
  admin: { useAsTitle: 'email' },
  access: {
    create: () => false,
    read: ({ req }) => Boolean(req.user),
    update: ({ req }) => Boolean(req.user),
    delete: () => false,
  },
  hooks: {
    beforeChange: [
      ({ operation, req }) => {
        // Native first-register bypasses access checks. HTTP callers cannot set req.context.
        if (
          operation === 'create' &&
          !req.user &&
          req.context.trustedAccountProvisioning !== true
        ) {
          throw new Forbidden(req.t);
        }
      },
    ],
  },
  fields: [],
};
