import { protectEditorialCollection } from '@/helpers/payload/editorial-revision';
import 'server-only';
import type { CollectionConfig } from 'payload';
import { protectCaseDeletion } from '../hooks/protect-case-deletion';

export const Cases: CollectionConfig = protectEditorialCollection({
  slug: 'cases',
  labels: { singular: 'Case', plural: 'Cases' },
  admin: {
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
    { name: 'internalTitle', label: 'Identificação interna', type: 'text', required: true },
    { name: 'sortOrder', label: 'Ordem', type: 'number', defaultValue: 0 },
    { name: 'featured', label: 'Destaque na Home', type: 'checkbox', defaultValue: false },
  ],
});
