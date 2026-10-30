import 'server-only';
import type { PayloadRequest } from 'payload';
import type { Media } from '@/payload-types';
import type { PublicRoot } from '@/helpers/payload/public-root';
import { runtimePayload } from '@/helpers/payload/runtime';
import { mediaUsageSchema } from '../contracts/media-usage.schema';

/** Metadata can classify missing coverage; only the caller's captured root grants bytes. */
export async function classifyMissingPublicMedia(
  mediaId: string,
  root: PublicRoot | null,
  req?: PayloadRequest,
): Promise<404 | 503> {
  const payload = req?.payload ?? (await runtimePayload());
  const { createLocalReq } = await import('payload');
  const fresh = await createLocalReq({}, payload);
  const current = (await payload.db.findOne({
    collection: 'media',
    req: fresh,
    where: { id: { equals: mediaId } },
  })) as Media | null;
  const missingPublicCoverage = mediaUsageSchema
    .array()
    .parse(current?.usages ?? [])
    .some((usage) => {
      if (usage.state !== 'confirmed') return false;
      const covered = root?.subjects[`${usage.collection}/${usage.documentId}`]?.value;
      // Covered media: [] is a confirmed revocation even when an old SQL ACK remains.
      return (
        !covered || typeof covered !== 'object' || Array.isArray(covered) || !('media' in covered)
      );
    });
  return missingPublicCoverage ? 503 : 404;
}
