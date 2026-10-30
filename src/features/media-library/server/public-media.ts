import 'server-only';
import { z } from 'zod';
import type { PayloadRequest } from 'payload';
import type { Media } from '@/payload-types';
import type { PublicRoot } from '@/helpers/payload/public-root';
import { mediaManifestSchema } from '../contracts/media-manifest.schema';
export const publicMediaSnapshotSchema = z.object({ id: z.uuid(), manifest: mediaManifestSchema });
export async function capturePublicMedia(
  references: { mediaId: string; kind: 'image' | 'pdf' }[],
  req: PayloadRequest,
) {
  const result: z.infer<typeof publicMediaSnapshotSchema>[] = [];
  for (const id of [...new Set(references.map((reference) => reference.mediaId))].sort()) {
    const media = (await req.payload.db.findOne({
      collection: 'media',
      where: { id: { equals: id } },
      req,
    })) as Media | null;
    if (!media || media.deletedAt || media.state !== 'ready')
      throw new Error('Publication media unavailable.');
    result.push(publicMediaSnapshotSchema.parse({ id, manifest: media.manifest }));
  }
  return result;
}
export function confirmedMedia(root: PublicRoot | null) {
  return Object.values(root?.subjects ?? {}).flatMap((subject) => {
    const value = subject.value;
    if (!value || typeof value !== 'object' || Array.isArray(value) || !('media' in value))
      return [];
    return publicMediaSnapshotSchema.array().parse(value.media);
  });
}
