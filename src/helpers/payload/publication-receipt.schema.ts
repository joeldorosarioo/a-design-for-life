import { z } from 'zod';
export const publicReceiptSchema = z.object({
  operationId: z.uuid(),
  targetRevision: z.uuid(),
  state: z.enum(['public', 'update-pending', 'superseded']),
});
export type PublicReceipt = z.infer<typeof publicReceiptSchema>;
