import { z } from 'zod';
export const uploadTypeSchema = z.enum([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/avif',
  'application/pdf',
]);
export type UploadType = z.infer<typeof uploadTypeSchema>;
export const uploadInputSchema = z.object({
  bytes: z.custom<Uint8Array>((value) => value instanceof Uint8Array),
  name: z.string(),
  declaredType: z.string(),
});
export type UploadInput = z.infer<typeof uploadInputSchema>;
// Candidates have passed only cheap type/byte screening, never the decoder/parser.
export const uploadCandidateSchema = uploadInputSchema.extend({
  type: uploadTypeSchema,
  byteLength: z.number().int().nonnegative(),
});
export type UploadCandidate = z.infer<typeof uploadCandidateSchema>;
export const uploadFailureSchema = z.object({
  code: z.enum(['invalid-input', 'busy', 'unavailable']),
  message: z.string(),
});
export type UploadFailure = z.infer<typeof uploadFailureSchema>;
export type UploadResult<T> = { ok: true; value: T } | { ok: false; error: UploadFailure };
