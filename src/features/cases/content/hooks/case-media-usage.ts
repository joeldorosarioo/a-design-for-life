import 'server-only';
import type { CollectionAfterChangeHook, CollectionBeforeDeleteHook } from 'payload';
import { APIError } from 'payload';
import { isDraftOperation } from '@/helpers/payload/editorial-revision';
import { trackMediaUsage } from '@/features/media-library/server';
import { extractCaseMedia } from './extract-case-media';
export const synchronizeCaseMedia: CollectionAfterChangeHook = async ({ doc, data, req }) => {
  const revision = String(data.contentRevision ?? doc.editorialRevision);
  const owner = {
    collection: 'case-content' as const,
    documentId: String(doc.id),
    locale: doc.locale as 'pt' | 'en',
    revision,
  };
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
    await trackMediaUsage(
      [
        { ...owner, state: 'confirmed', references: extractCaseMedia(published) },
        { ...owner, state: 'draft', references: [] },
      ],
      req,
    );
  } else {
    await trackMediaUsage(
      [
        { ...owner, state: 'draft', references: extractCaseMedia(doc) },
        ...(!isDraftOperation(req) && !published
          ? [{ ...owner, state: 'confirmed' as const, references: [] }]
          : []),
      ],
      req,
    );
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
  await trackMediaUsage(
    [
      {
        collection: 'case-content',
        documentId: String(doc.id),
        locale: doc.locale as 'pt' | 'en',
        revision: String(doc.editorialRevision),
        state: 'draft',
        references: [],
      },
    ],
    req,
  );
};
