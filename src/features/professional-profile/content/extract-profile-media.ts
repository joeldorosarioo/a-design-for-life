import { z } from 'zod';

const mediaIdSchema = z.uuid();

function record(value: unknown, path: string): Record<string, unknown> {
  if (value === null || value === undefined) return {};
  if (typeof value !== 'object' || Array.isArray(value))
    throw new TypeError(`Invalid media container at ${path}: expected an object.`);
  return value as Record<string, unknown>;
}

export function extractProfileMedia(
  document: unknown,
): Array<{ mediaId: string; kind: 'image' | 'pdf' }> {
  const references: Array<{ mediaId: string; kind: 'image' | 'pdf' }> = [];
  const seen = new Set<string>();
  function relation(value: unknown, kind: 'image' | 'pdf', path: string) {
    if (value === null || value === undefined || value === '') return;
    const candidate =
      typeof value === 'object' && !Array.isArray(value)
        ? (value as Record<string, unknown>).id
        : value;
    const parsed = mediaIdSchema.safeParse(candidate);
    if (!parsed.success)
      throw new TypeError(
        `Invalid media reference at ${path}: expected a UUID or populated media with a UUID id.`,
      );
    const canonicalId = parsed.data.toLowerCase();
    const key = `${canonicalId}:${kind}`;
    if (seen.has(key)) return;
    seen.add(key);
    references.push({ mediaId: canonicalId, kind });
  }
  function image(value: unknown, path: string) {
    relation(record(value, path).media, 'image', `${path}.media`);
  }
  const data = record(document, 'document');
  image(record(data.home, 'home').portrait, 'home.portrait');
  const about = record(data.about, 'about');
  image(about.portrait, 'about.portrait');
  image(about.deskPhotograph, 'about.deskPhotograph');
  image(about.architecturePhotograph, 'about.architecturePhotograph');
  image(record(data.seo, 'seo').image, 'seo.image');
  relation(data.resume, 'pdf', 'resume');
  return references;
}
