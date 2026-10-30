import 'server-only';
import { randomUUID } from 'node:crypto';
import { APIError, Forbidden, type PayloadRequest } from 'payload';
import type { Media } from '@/payload-types';
import {
  mediaUsageCommandSchema,
  mediaUsageSchema,
  type MediaUsageChange,
  type MediaUsageCommand,
} from '../contracts/media-usage.schema';
import { mediaManifestSchema } from '../contracts/media-manifest.schema';
import { changeMediaUsage } from './change-media-usage';

export async function trackMediaUsage(input: MediaUsageCommand, req: PayloadRequest) {
  if (!req.user || req.user.collection !== 'users') throw new Forbidden(req.t);
  if (!req.transactionID)
    throw new APIError('Media usages require the editorial transaction.', 400);
  const command = mediaUsageCommandSchema.parse(input);
  // Query only Media's explicit technical reference schema, never arbitrary editorial JSON.
  const all = await req.payload.db.find({ collection: 'media', req, pagination: false, limit: 0 });
  const references = new Map<string, Set<'image' | 'pdf'>>();
  for (const reference of command.references) {
    const kinds = references.get(reference.mediaId) ?? new Set<'image' | 'pdf'>();
    kinds.add(reference.kind);
    references.set(reference.mediaId, kinds);
  }
  const ids = new Set(references.keys());
  for (const media of all.docs as Media[]) {
    const uses = mediaUsageSchema.array().parse(media.usages ?? []);
    if (
      uses.some(
        (use) =>
          use.collection === command.collection &&
          use.documentId === command.documentId &&
          use.locale === command.locale &&
          use.state === command.state,
      )
    )
      ids.add(media.id);
  }
  for (const id of [...ids].sort()) {
    let saved = false;
    for (let attempt = 0; attempt < 4 && !saved; attempt++) {
      const current = (await req.payload.db.findOne({
        collection: 'media',
        req,
        where: { id: { equals: id } },
      })) as Media | null;
      const referenced = references.has(id);
      if (!current || (referenced && (current.deletedAt || current.state !== 'ready')))
        throw new APIError(
          'A referenced media asset is unavailable. Restore it or choose another file.',
          400,
        );
      const manifest = mediaManifestSchema.parse(current.manifest);
      const expected = references.get(id);
      if (expected && [...expected].some((kind) => manifest.kind !== kind))
        throw new APIError('Choose the correct image or PDF for this field.', 400);
      const uses = mediaUsageSchema.array().parse(current.usages ?? []);
      const change: MediaUsageChange = {
        collection: command.collection,
        documentId: command.documentId,
        locale: command.locale,
        revision: command.revision,
        state: command.state,
        referenced,
      };
      const updated = await req.payload.db.updateOne({
        collection: 'media',
        req,
        options: { atomic: true },
        where: {
          and: [
            { id: { equals: id } },
            { guardRevision: { equals: current.guardRevision } },
            { state: { equals: current.state } },
            ...(referenced ? [{ deletedAt: { exists: false } }] : []),
          ],
        },
        data: { usages: changeMediaUsage(uses, change), guardRevision: randomUUID() },
      });
      saved = Boolean(updated);
    }
    if (!saved) throw new APIError('Media changed during publication. Try again.', 409);
  }
}
