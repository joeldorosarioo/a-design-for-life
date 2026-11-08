import 'server-only';
import type { CollectionConfig } from 'payload';

export const CaseRoutes: CollectionConfig = {
  slug: 'case-routes',
  labels: { singular: 'Endereço de case', plural: 'Endereços de cases' },
  admin: { hidden: true },
  indexes: [{ fields: ['locale', 'slug'], unique: true }],
  access: { create: () => false, read: () => false, update: () => false, delete: () => false },
  fields: [
    { name: 'locale', type: 'select', required: true, options: ['pt', 'en'] },
    { name: 'slug', type: 'text', required: true },
    { name: 'case', type: 'relationship', relationTo: 'cases', required: true },
    { name: 'content', type: 'relationship', relationTo: 'case-content', required: true },
    { name: 'everPublished', type: 'checkbox', defaultValue: false, required: true },
    {
      name: 'state',
      type: 'select',
      defaultValue: 'draft',
      options: ['draft', 'current', 'historical'],
      required: true,
    },
  ],
};
