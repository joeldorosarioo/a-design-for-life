import { z } from 'zod';
export const pdfInspectionSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.enum(['valid', 'warnings']), pages: z.number().int().positive() }),
  z.object({ kind: z.enum(['invalid', 'password-required', 'cancelled', 'unavailable']) }),
]);
export type PdfInspection = z.infer<typeof pdfInspectionSchema>;
