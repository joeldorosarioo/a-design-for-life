import 'server-only';
import { createLocalReq, type PayloadRequest } from 'payload';
import type { Media } from '@/payload-types';
import { randomUUID } from 'node:crypto';
import {
  mediaAccessInputSchema,
  type MediaAccessInput,
  type MediaAccessResult,
} from '../contracts/media-access.schema';
import { mediaManifestSchema, type MediaManifest } from '../contracts/media-manifest.schema';
import { mediaRuntime } from './media-runtime';
import { confirmedMedia } from './public-media';
import { readPublicRoot } from '@/helpers/payload/public-root';
import { runtimePublication } from '@/helpers/payload/publication-runtime';
import { runtimePayload } from '@/helpers/payload/runtime';
export async function resolveMediaAccess(
  input: MediaAccessInput,
  req?: PayloadRequest,
): Promise<MediaAccessResult> {
  if (input.preview && (!req?.user || req.user.collection !== 'users'))
    return { ok: false, status: 401 };
  if (!mediaAccessInputSchema.safeParse(input).success) return { ok: false, status: 404 };
  try {
    let manifest: MediaManifest | undefined;
    if (input.preview) {
      const current = (await req!.payload.db.findOne({
        collection: 'media',
        req: req!,
        where: { id: { equals: input.mediaId } },
      })) as Media | null;
      if (!current || current.deletedAt || current.state !== 'ready')
        return { ok: false, status: 404 };
      manifest = mediaManifestSchema.parse(current.manifest);
    } else {
      const root = await readPublicRoot(runtimePublication().directory);
      manifest = confirmedMedia(root).find((media) => media.id === input.mediaId)?.manifest;
      if (!manifest) {
        // A live origin proves that an ungranted ID is private/absent. Without
        // coverage and without the origin, no negative result is fabricated.
        const payload = req?.payload ?? (await runtimePayload());
        const fresh = await createLocalReq({}, payload);
        await payload.db.findOne({
          collection: 'media',
          req: fresh,
          where: { id: { equals: input.mediaId } },
        });
        return { ok: false, status: 404 };
      }
    }
    const rendition =
      input.variant === 'original'
        ? manifest.original
        : manifest.variants.find((variant) => variant.variant === input.variant);
    if (!rendition) return { ok: false, status: 404 };
    const bytes = await mediaRuntime().storage.read(rendition.object);
    return { ok: true, value: { bytes, type: rendition.type } };
  } catch {
    console.error('Media delivery unavailable', { correlationId: randomUUID() });
    return { ok: false, status: 503 };
  }
}
