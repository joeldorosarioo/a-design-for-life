import 'server-only';
import type { PayloadRequest } from 'payload';
import type { Media } from '@/payload-types';
import { logger } from '@/helpers/logger';
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
import { classifyMissingPublicMedia } from './classify-missing-public-media';
export async function resolveMediaAccess(
  input: MediaAccessInput,
  req?: PayloadRequest,
): Promise<MediaAccessResult> {
  return (await resolveMediaDelivery(input, req)).access;
}

export async function resolveMediaDelivery(
  input: MediaAccessInput,
  req?: PayloadRequest,
): Promise<{ access: MediaAccessResult; generation?: string }> {
  if (input.preview && (!req?.user || req.user.collection !== 'users'))
    return { access: { ok: false, status: 401 } };
  if (!mediaAccessInputSchema.safeParse(input).success)
    return { access: { ok: false, status: 404 } };
  try {
    let manifest: MediaManifest | undefined;
    let generation: string | undefined;
    if (input.preview) {
      const current = (await req!.payload.db.findOne({
        collection: 'media',
        req: req!,
        where: { id: { equals: input.mediaId } },
      })) as Media | null;
      if (!current || current.deletedAt || current.state !== 'ready')
        return { access: { ok: false, status: 404 } };
      manifest = mediaManifestSchema.parse(current.manifest);
    } else {
      const root = await readPublicRoot(runtimePublication().directory);
      generation = root?.generation;
      manifest = confirmedMedia(root).find((media) => media.id === input.mediaId)?.manifest;
      if (!manifest) {
        const status = await classifyMissingPublicMedia(input.mediaId, root, req);
        return {
          access: { ok: false, status },
          generation: status === 404 ? generation : undefined,
        };
      }
    }
    const rendition =
      input.variant === 'original'
        ? manifest.original
        : manifest.variants.find((variant) => variant.variant === input.variant);
    if (!rendition) return { access: { ok: false, status: 404 }, generation };
    const bytes = await mediaRuntime().storage.read(rendition.object);
    return { access: { ok: true, value: { bytes, type: rendition.type } }, generation };
  } catch {
    logger.error({
      operation: 'media.delivery',
      result: 'unavailable',
      context: { statusCode: 503, errorCode: 'unavailable' },
    });
    return { access: { ok: false, status: 503 } };
  }
}
