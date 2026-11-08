import 'server-only';
import type { CollectionConfig } from 'payload';
export const PublicationUpdates: CollectionConfig = {
  slug: 'publication-updates',
  admin: { hidden: true },
  access: { create: () => false, read: () => false, update: () => false, delete: () => false },
  fields: [
    { name: 'operationId', type: 'text', required: true, unique: true },
    {
      name: 'subjectCollection',
      type: 'select',
      required: true,
      options: ['cases', 'case-content', 'professional-profiles', 'site-navigation'],
    },
    { name: 'subjectId', type: 'text', required: true, index: true },
    { name: 'targetRevision', type: 'text', required: true },
    { name: 'dependencies', type: 'json', required: true },
    { name: 'target', type: 'json', required: true },
    {
      name: 'state',
      type: 'select',
      required: true,
      defaultValue: 'update-pending',
      options: ['update-pending', 'public', 'superseded'],
    },
    { name: 'attempts', type: 'number', required: true, defaultValue: 0 },
    { name: 'diagnostic', type: 'text' },
  ],
};
