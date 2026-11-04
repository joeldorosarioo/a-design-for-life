import 'server-only';
import { z } from 'zod';
import type { PayloadRequest } from 'payload';
import { publicRootSchema, type PublicRoot } from '@/helpers/payload/public-root';
import type { StoredObject } from '@/helpers/storage/object-storage';
import type { Media } from '@/payload-types';
import { requireNativeBackupSnapshot } from '@/helpers/payload/backup-snapshot';
import { mediaManifestSchema } from '../contracts/media-manifest.schema';
import { confirmedMedia } from './public-media';
const recordSchema = z.object({ id: z.uuid(), manifest: mediaManifestSchema });
export function collectBackupMediaInventory(input: { media: unknown[]; root: PublicRoot | null }): {
  mediaIds: string[];
  objects: StoredObject[];
} {
  const records = recordSchema.array().parse(input.media);
  const root = input.root === null ? null : publicRootSchema.parse(input.root);
  const manifests = new Map<string, z.infer<typeof mediaManifestSchema>>();
  for (const item of records) {
    if (manifests.has(item.id)) throw new Error('Duplicate media identity in backup inventory');
    manifests.set(item.id, item.manifest);
  }
  for (const item of confirmedMedia(root)) {
    const current = manifests.get(item.id);
    if (current && JSON.stringify(current) !== JSON.stringify(item.manifest))
      throw new Error('Current and confirmed media manifest identities differ');
    manifests.set(item.id, item.manifest);
  }
  const objects = new Map<string, StoredObject>();
  for (const manifest of manifests.values()) {
    for (const item of [manifest.original, ...manifest.variants]) {
      const previous = objects.get(item.object.key);
      if (
        previous &&
        (previous.byteLength !== item.object.byteLength || previous.sha256 !== item.object.sha256)
      )
        throw new Error('Conflicting immutable object reference in backup inventory');
      objects.set(item.object.key, item.object);
    }
  }
  return {
    mediaIds: [...manifests.keys()].sort(),
    objects: [...objects.values()].sort((a, b) => a.key.localeCompare(b.key)),
  };
}
export async function captureBackupMediaInventory(input: {
  req: PayloadRequest;
  root: PublicRoot | null;
}) {
  requireNativeBackupSnapshot(input.req);
  const media: Media[] = [];
  let page = 1;
  while (true) {
    requireNativeBackupSnapshot(input.req);
    // Native adapter access includes technical manifests and trash without UI
    // afterRead projections or a second content persistence implementation.
    const result = await input.req.payload.db.find<Media>({
      collection: 'media',
      req: input.req,
      sort: 'id',
      limit: 100,
      page,
      pagination: true,
    });
    media.push(...result.docs);
    if (!result.hasNextPage) {
      if (media.length !== result.totalDocs)
        throw new Error('Native backup media inventory was truncated');
      return collectBackupMediaInventory({ media, root: input.root });
    }
    if (result.docs.length === 0) throw new Error('Native backup media inventory did not advance');
    page++;
  }
}
