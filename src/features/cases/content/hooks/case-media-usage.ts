import 'server-only';
import type {
  CollectionAfterChangeHook,
  CollectionBeforeDeleteHook,
  PayloadRequest,
} from 'payload';
import { APIError } from 'payload';
import { isDraftOperation } from '@/helpers/payload/editorial-revision';
import { trackMediaUsage } from '@/features/media-library/server';
import { extractCaseMedia } from './extract-case-media';
async function change(
  doc: Record<string, unknown>,
  revision: string,
  state: 'draft' | 'confirmed',
  references: ReturnType<typeof extractCaseMedia>,
  req: PayloadRequest,
) {
  await trackMediaUsage(
    {
      collection: 'case-content',
      documentId: String(doc.id),
      locale: doc.locale as 'pt' | 'en',
      revision,
      state,
      references,
    },
    req,
  );
}
export const synchronizeCaseMedia: CollectionAfterChangeHook = async ({ doc, data, req }) => {
  const revision = String(data.contentRevision ?? doc.editorialRevision);
  const published = (
    await req.payload.find({
      collection: 'case-content',
      where: {
        and: [
          { id: { equals: doc.id } },
          { locale: { equals: doc.locale } },
          { _status: { equals: 'published' } },
        ],
      },
      draft: false,
      depth: 0,
      limit: 1,
      req,
      overrideAccess: false,
    })
  ).docs[0];
  if (published?.editorialRevision === revision) {
    await change(doc, revision, 'confirmed', extractCaseMedia(published), req);
    await change(doc, revision, 'draft', [], req);
  } else {
    await change(doc, revision, 'draft', extractCaseMedia(doc), req);
    if (!isDraftOperation(req) && !published) await change(doc, revision, 'confirmed', [], req);
  }
  return doc;
};
export const retainDeletedCaseMedia: CollectionBeforeDeleteHook = async ({ id, req }) => {
  const doc = (await req.payload.db.findOne({
    collection: 'case-content',
    where: { id: { equals: id } },
    req,
  })) as Record<string, unknown> | null;
  if (!doc) throw new APIError('Content unavailable.', 404);
  await change(doc, String(doc.editorialRevision), 'draft', [], req);
};
