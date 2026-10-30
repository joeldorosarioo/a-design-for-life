import 'server-only';
import { randomUUID } from 'node:crypto';
import { ValidationError, type CollectionBeforeChangeHook } from 'payload';
import type { CaseContent } from '@/payload-types';
export const stableReadingKeys: CollectionBeforeChangeHook<CaseContent> = ({
  data,
  originalDoc,
  req,
  collection,
}) => {
  const previousKeys = new Map<string, string>();
  for (const section of originalDoc?.sections ?? []) {
    if (section.id && section.readingKey) previousKeys.set(section.id, section.readingKey);
    for (const block of section.blocks ?? [])
      if (block.id && block.readingKey) previousKeys.set(block.id, block.readingKey);
  }
  const used = new Set<string>();
  const assign = (row: { id?: string | null; readingKey?: string | null }, path: string) => {
    const previous = row.id ? previousKeys.get(row.id) : undefined;
    if (previous && row.readingKey && previous !== row.readingKey)
      throw new ValidationError({
        collection: collection.slug,
        req,
        errors: [{ path, message: 'Chave de leitura não pode ser alterada.' }],
      });
    row.readingKey ||= previous || randomUUID();
    if (used.has(row.readingKey))
      throw new ValidationError({
        collection: collection.slug,
        req,
        errors: [{ path, message: 'Chave de leitura repetida neste documento.' }],
      });
    used.add(row.readingKey);
  };
  for (const [sectionIndex, section] of (data.sections ?? []).entries()) {
    assign(section, `sections.${sectionIndex}.readingKey`);
    for (const [blockIndex, block] of (section.blocks ?? []).entries())
      assign(block, `sections.${sectionIndex}.blocks.${blockIndex}.readingKey`);
  }
  return data;
};
