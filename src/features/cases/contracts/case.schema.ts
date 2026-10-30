import { draftSlugSchema } from './slug.schema';
import { nativeArray } from '@/helpers/payload/native-array.schema';
import { z } from 'zod';
import { localeSchema } from '@/helpers/i18n/locale.schema';
import { inputMetadata } from '@/helpers/payload/input-metadata.schema';
import { imageUseInputSchema } from '@/features/media-library';
import { richTextSchema } from './rich-text.schema';
const text = z.string().nullish();
const row = { id: z.string().nullish(), readingKey: z.uuid().nullish() };
const block = { ...row, blockName: text };
export const caseBlockInputSchema = z.discriminatedUnion('blockType', [
  z.strictObject({ ...block, blockType: z.literal('text'), content: richTextSchema.nullish() }),
  z.strictObject({ ...block, blockType: z.literal('image'), image: imageUseInputSchema.nullish() }),
  z.strictObject({
    ...block,
    blockType: z.literal('image-pair'),
    presentation: z.enum(['pair', 'comparison']).nullish(),
    first: imageUseInputSchema.nullish(),
    second: imageUseInputSchema.nullish(),
    firstLabel: text,
    secondLabel: text,
  }),
]);
export const caseSectionInputSchema = z.strictObject({
  ...row,
  heading: text,
  blocks: nativeArray(caseBlockInputSchema).nullish(),
});
export const caseInputSchema = z.strictObject({
  ...inputMetadata,
  case: z.uuid().optional(),
  locale: localeSchema.optional(),
  eyebrow: text,
  title: text,
  summary: text,
  introduction: text,
  slug: draftSlugSchema,
  cover: imageUseInputSchema.nullish(),
  role: text,
  scope: text,
  contextNote: text,
  sections: nativeArray(caseSectionInputSchema).nullish(),
  seo: z
    .strictObject({ title: text, description: text, image: imageUseInputSchema.nullish() })
    .nullish(),
});
export type CaseInput = z.infer<typeof caseInputSchema>;
