import 'server-only';
import type { PayloadRequest } from 'payload';
import type { Media } from '@/payload-types';
import { randomUUID } from 'node:crypto';
import {
  mediaAccessInputSchema,
  type MediaAccessInput,
  type MediaAccessResult,
} from '../contracts/media-access.schema';
import { mediaManifestSchema } from '../contracts/media-manifest.schema';
import { mediaUsageSchema } from '../contracts/media-usage.schema';
import { mediaRuntime } from './media-runtime';
export async function resolveMediaAccess(
  input: MediaAccessInput,
  req: PayloadRequest,
): Promise<MediaAccessResult> {
  if (input.preview && (!req.user || req.user.collection !== 'users'))
    return { ok: false, status: 401 };
  const parsed = mediaAccessInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, status: 404 };
  try {
    const current = (await req.payload.db.findOne({
      collection: 'media',
      req,
      where: { id: { equals: input.mediaId } },
    })) as Media | null;
    if (!current || current.deletedAt || current.state !== 'ready')
      return { ok: false, status: 404 };
    const usages = mediaUsageSchema.array().parse(current.usages ?? []);
    if (!input.preview && !usages.some((use) => use.state === 'confirmed'))
      return { ok: false, status: 404 };
    const manifest = mediaManifestSchema.parse(current.manifest);
    const rendition =
      input.variant === 'original'
        ? manifest.original
        : manifest.variants.find((variant) => variant.variant === input.variant);
    if (!rendition) return { ok: false, status: 404 };
    // Authorization precedes every byte read, including derivatives and conditional/HEAD consumers.
    const bytes = await mediaRuntime().storage.read(rendition.object);
    return { ok: true, value: { bytes, type: rendition.type } };
  } catch {
    console.error('Media delivery unavailable', { correlationId: randomUUID() });
    return { ok: false, status: 503 };
  }
}
