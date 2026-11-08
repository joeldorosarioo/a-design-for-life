import 'server-only';
import type { CollectionConfig } from 'payload';

/** Execution metadata only; publication-updates and current.json own visibility. */
export const PublicationRetries: CollectionConfig = {
  slug: 'publication-retries',
  // This CAS ledger is not an editable document and must not alter historical
  // payload-locked-documents relation columns during old migration replay.
  lockDocuments: false,
  admin: { hidden: true },
  access: { create: () => false, read: () => false, update: () => false, delete: () => false },
  fields: [
    { name: 'operationId', type: 'text', required: true, unique: true },
    { name: 'retryUserId', type: 'text' },
    {
      name: 'startedAttemptsVersion',
      type: 'number',
      required: true,
      defaultValue: 0,
      min: 0,
      max: Number.MAX_SAFE_INTEGER,
    },
    { name: 'automaticAttempts', type: 'number', required: true, defaultValue: 0, min: 0, max: 3 },
    { name: 'nextAttemptAt', type: 'date', index: true },
  ],
};
