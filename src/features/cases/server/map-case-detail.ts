import 'server-only';
import type { CaseContent } from '@/payload-types';
import { mapImageUse } from '@/features/media-library/server';
import { caseDetailDTOSchema, type CaseDetailDTO } from '../contracts/case-dto.schema';
import { deriveCaseTitle } from '../helpers/derive-case-title';
export function mapCaseDetail(document: CaseContent): CaseDetailDTO | undefined {
  if (document._status !== 'published' || !document.slug) return;
  const titleParts = {
    normal: document.title ?? null,
    emphasis: document.titleEmphasis?.trim() || null,
  };
  const title = deriveCaseTitle(document.title, document.titleEmphasis);
  const sections = (document.sections ?? []).map((section) => ({
    readingKey: section.readingKey,
    presentation: section.presentation ?? 'narrative',
    eyebrow: section.eyebrow ?? null,
    heading: section.heading ?? null,
    description: section.description ?? null,
    note: section.note ?? null,
    blocks: (section.blocks ?? []).map((block) => {
      const readingKey = block.readingKey;
      switch (block.blockType) {
        case 'text':
          return {
            type: 'text',
            readingKey,
            eyebrow: block.eyebrow ?? null,
            heading: block.heading ?? null,
            note: block.note ?? null,
            content: block.content ?? null,
          };
        case 'image':
          return { type: 'image', readingKey, image: mapImageUse(block.image) ?? null };
        case 'image-pair':
          return {
            type: 'image-pair',
            readingKey,
            presentation: block.presentation ?? 'pair',
            first: mapImageUse(block.first) ?? null,
            second: mapImageUse(block.second) ?? null,
            firstLabel: block.firstLabel ?? null,
            secondLabel: block.secondLabel ?? null,
          };
      }
    }),
  }));
  return caseDetailDTOSchema.parse({
    caseId: typeof document.case === 'object' ? document.case.id : document.case,
    locale: document.locale,
    eyebrow: document.eyebrow ?? null,
    title,
    titleParts,
    summary: document.summary ?? null,
    introduction: document.introduction ?? null,
    path: `/${document.locale}/cases/${encodeURIComponent(document.slug)}`,
    cover: mapImageUse(document.cover) ?? null,
    role: document.role ?? null,
    scope: document.scope ?? null,
    contextNote: document.contextNote ?? null,
    sections,
    contents: sections.map((section) => ({
      readingKey: section.readingKey,
      label: section.eyebrow?.trim() ? section.eyebrow : section.heading,
      anchor: `section-${section.readingKey}`,
    })),
    seo: {
      title: document.seo?.title ?? title,
      description: document.seo?.description ?? null,
      image: mapImageUse(document.seo?.image) ?? null,
    },
  });
}
