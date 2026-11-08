import { z } from 'zod';
import { localeSchema } from '@/helpers/i18n/locale.schema';
import { imageUseDTOSchema } from '@/features/media-library';
import { richTextSchema } from './rich-text.schema';
import { caseSectionPresentationSchema } from './case.schema';
const text = z.string().nullable();
const readingKey = z.uuid();
const block = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('text'),
    readingKey,
    eyebrow: text,
    heading: text,
    note: text,
    content: richTextSchema.nullable(),
  }),
  z.object({ type: z.literal('image'), readingKey, image: imageUseDTOSchema.nullable() }),
  z.object({
    type: z.literal('image-pair'),
    readingKey,
    presentation: z.enum(['pair', 'comparison']),
    first: imageUseDTOSchema.nullable(),
    second: imageUseDTOSchema.nullable(),
    firstLabel: text,
    secondLabel: text,
  }),
]);
export const caseDetailDTOSchema = z.object({
  caseId: z.uuid(),
  locale: localeSchema,
  eyebrow: text,
  title: text,
  titleParts: z.object({ normal: text, emphasis: text }),
  summary: text,
  introduction: text,
  path: z.string(),
  cover: imageUseDTOSchema.nullable(),
  role: text,
  scope: text,
  contextNote: text,
  sections: z.array(
    z.object({
      readingKey,
      presentation: caseSectionPresentationSchema,
      eyebrow: text,
      heading: text,
      description: text,
      note: text,
      blocks: z.array(block),
    }),
  ),
  contents: z.array(z.object({ readingKey, label: text, anchor: z.string() })),
  seo: z.object({ title: text, description: text, image: imageUseDTOSchema.nullable() }),
});
export const caseCardDTOSchema = caseDetailDTOSchema.pick({
  caseId: true,
  locale: true,
  title: true,
  summary: true,
  path: true,
  cover: true,
});
export type CaseDetailDTO = z.infer<typeof caseDetailDTOSchema>;
export type CaseCardDTO = z.infer<typeof caseCardDTOSchema>;
