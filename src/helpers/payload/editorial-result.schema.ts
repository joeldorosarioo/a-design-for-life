import { publicReceiptSchema } from './publication-receipt.schema';
import { z } from 'zod';
export const editorialFailureSchema = z.object({
  code: z.enum(['invalid-input', 'stale-revision', 'locked', 'forbidden', 'unavailable']),
  message: z.string(),
  fields: z.array(z.object({ path: z.string(), message: z.string() })).optional(),
});
export type EditorialFailure = z.infer<typeof editorialFailureSchema>;
export type Result<T> = { ok: true; value: T } | { ok: false; error: EditorialFailure };
export const editorialCommandSchema = z.object({ contentId: z.uuid(), expectedRevision: z.uuid() });
export const restoreCommandSchema = editorialCommandSchema.extend({ versionId: z.uuid() });
export const publicationReceiptSchema = publicReceiptSchema.extend({
  contentId: z.uuid(),
  locale: z.enum(['pt', 'en']),
  revision: z.uuid(),
});
export type PublicationReceipt = z.infer<typeof publicationReceiptSchema>;

export type EditorialCommand = z.infer<typeof editorialCommandSchema>;
export type RestoreCommand = z.infer<typeof restoreCommandSchema>;
