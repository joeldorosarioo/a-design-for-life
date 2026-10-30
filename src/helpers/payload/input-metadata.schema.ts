import { z } from 'zod';
export const inputMetadata = {
  id: z.string().optional(),
  editorialRevision: z.string().nullish(),
  leaseToken: z.string().nullish(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
  _status: z.enum(['draft', 'published']).optional(),
};
