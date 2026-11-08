import 'server-only';
import type { CollectionConfig } from 'payload';
import { nativeMediaFile } from '../../server/media-response';
import { guardMediaOperation, writeMediaReceipt, mediaEditorView } from '../hooks/native-intake';
export const Media: CollectionConfig = {
  slug: 'media',
  labels: { singular: 'Mídia', plural: 'Mídias' },
  admin: {
    useAsTitle: 'filename',
    description: 'Arquivos são imutáveis. Para trocar uma imagem ou PDF, envie uma nova mídia.',
  },
  trash: true,
  disableDuplicate: true,
  disableBulkEdit: true,
  disableBulkDelete: true,
  access: {
    create: ({ req }) => Boolean(req.user),
    read: ({ req }) => {
      req.responseHeaders ??= new Headers();
      req.responseHeaders.set('Cache-Control', 'private, no-store');
      return Boolean(req.user);
    },
    update: ({ req }) => Boolean(req.user),
    delete: ({ req }) => Boolean(req.user),
  },
  hooks: {
    beforeOperation: [guardMediaOperation],
    beforeChange: [writeMediaReceipt],
    afterRead: [mediaEditorView],
  },
  upload: {
    disableLocalStorage: true,
    crop: false,
    focalPoint: false,
    pasteURL: false,
    hideRemoveFile: true,
    mimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'application/pdf'],
    handlers: [async (req, { params }) => nativeMediaFile(req, params.filename)],
  },
  fields: [
    { name: 'label', label: 'Identificação interna', type: 'text' },
    ...(['manifest', 'usages'] as const).map((name) => ({
      name,
      type: 'json' as const,
      admin: { hidden: true },
      access: { read: () => false },
    })),
    { name: 'guardRevision', type: 'text', admin: { hidden: true }, access: { read: () => false } },
    {
      name: 'state',
      type: 'select',
      options: ['ready', 'deleted'],
      admin: { hidden: true },
      access: { read: () => false },
    },
  ],
};
