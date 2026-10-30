import 'server-only';
import { APIError, type CollectionConfig } from 'payload';

// Schema dependency only. E1.6 supplies validated upload/storage/delivery.
export const Media: CollectionConfig = {
  slug: 'media',
  labels: { singular: 'Mídia', plural: 'Mídias' },
  admin: { hidden: true },
  access: { create: () => false, read: () => false, update: () => false, delete: () => false },
  hooks: {
    beforeOperation: [
      ({ operation }) => {
        if (operation === 'create' || operation === 'update' || operation === 'delete')
          throw new APIError(
            'Uploads ainda bloqueados: validação e privacidade pertencem a E1.6.',
            403,
          );
      },
    ],
  },
  upload: { disableLocalStorage: true, crop: false, focalPoint: false, pasteURL: false },
  fields: [],
};
