import { z } from 'zod';
import { uploadTypeSchema } from './upload.schema';
export const storedMediaObjectSchema = z.object({
  key: z.string().regex(/^[a-f0-9]{64}$/),
  byteLength: z.number().int().positive(),
  sha256: z.string().regex(/^[a-f0-9]{64}$/),
});
const rendition = z.object({
  variant: z.string().regex(/^(original|w\d+)$/),
  object: storedMediaObjectSchema,
  type: uploadTypeSchema,
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
});
export const mediaManifestSchema = z.object({
  revision: z.uuid(),
  kind: z.enum(['image', 'pdf']),
  original: rendition,
  variants: z.array(rendition),
});
export type MediaManifest = z.infer<typeof mediaManifestSchema>;
