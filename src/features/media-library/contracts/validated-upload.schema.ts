import { z } from 'zod';
import { uploadTypeSchema } from './upload.schema';
export const validatedUploadSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('image'),
    type: uploadTypeSchema.exclude(['application/pdf']),
    bytes: z.custom<Uint8Array>((value) => value instanceof Uint8Array),
    byteLength: z.number().int().positive(),
    width: z.number().int().positive(),
    height: z.number().int().positive(),
    animation: z
      .object({
        pages: z.number().int().min(2),
        delay: z.array(z.number().int().nonnegative()),
        loop: z.number().int().nonnegative(),
      })
      .refine((animation) => animation.delay.length === animation.pages, {
        message: 'Each animation frame requires its own delay.',
      })
      .optional(),
  }),
  z.object({
    kind: z.literal('pdf'),
    type: z.literal('application/pdf'),
    bytes: z.custom<Uint8Array>((value) => value instanceof Uint8Array),
    byteLength: z.number().int().positive(),
    pages: z.number().int().positive(),
  }),
]);
export type ValidatedUpload = z.infer<typeof validatedUploadSchema>;
export type ValidatedImage = Extract<ValidatedUpload, { kind: 'image' }>;
export const processedVariantSchema = z.object({
  variant: z.string().regex(/^w\d+$/),
  bytes: z.custom<Uint8Array>((value) => value instanceof Uint8Array),
  type: z.literal('image/webp'),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
});
export type ProcessedVariant = z.infer<typeof processedVariantSchema>;
