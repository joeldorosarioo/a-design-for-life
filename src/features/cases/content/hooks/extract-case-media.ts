import { z } from 'zod';

const mediaIdSchema = z.uuid();

function record(value: unknown, path: string): Record<string, unknown> {
  if (value === null || value === undefined) return {};
  if (typeof value !== 'object' || Array.isArray(value))
    throw new TypeError(`Invalid media container at ${path}: expected an object.`);
  return value as Record<string, unknown>;
}

function rows(value: unknown, path: string): unknown[] {
  if (value === null || value === undefined || value === 0) return [];
  if (!Array.isArray(value))
    throw new TypeError(`Invalid media container at ${path}: expected an array.`);
  return value;
}

export function extractCaseMedia(document: unknown): Array<{ mediaId: string; kind: 'image' }> {
  const references: Array<{ mediaId: string; kind: 'image' }> = [];
  const seen = new Set<string>();
  function image(value: unknown, path: string) {
    const relation = record(value, path).media;
    if (relation === null || relation === undefined || relation === '') return;
    const candidate =
      typeof relation === 'object' && !Array.isArray(relation)
        ? (relation as Record<string, unknown>).id
        : relation;
    const parsed = mediaIdSchema.safeParse(candidate);
    if (!parsed.success)
      throw new TypeError(
        `Invalid media reference at ${path}.media: expected a UUID or populated media with a UUID id.`,
      );
    const canonicalId = parsed.data.toLowerCase();
    if (seen.has(canonicalId)) return;
    seen.add(canonicalId);
    references.push({ mediaId: canonicalId, kind: 'image' });
  }
  const data = record(document, 'document');
  image(data.cover, 'cover');
  image(record(data.seo, 'seo').image, 'seo.image');
  for (const [sectionIndex, section] of rows(data.sections, 'sections').entries()) {
    const sectionPath = `sections.${sectionIndex}`;
    const blocks = rows(record(section, sectionPath).blocks, `${sectionPath}.blocks`);
    for (const [blockIndex, value] of blocks.entries()) {
      const blockPath = `${sectionPath}.blocks.${blockIndex}`;
      const block = record(value, blockPath);
      if (block.blockType === 'image') image(block.image, `${blockPath}.image`);
      if (block.blockType === 'image-pair') {
        image(block.first, `${blockPath}.first`);
        image(block.second, `${blockPath}.second`);
      }
    }
  }
  return references;
}
