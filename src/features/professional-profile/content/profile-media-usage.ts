import 'server-only';
import type { CollectionAfterChangeHook } from 'payload';
import { trackMediaUsage } from '@/features/media-library/server';
import { extractProfileMedia } from './extract-profile-media';
export const synchronizeProfileMedia: CollectionAfterChangeHook = async ({ doc, data, req }) => {
  const references = extractProfileMedia(doc);
  // Native structural bootstrap has no editor and no media; it grants no usage.
  if (!req.user && references.length === 0) return doc;
  const revision = String(data.contentRevision ?? doc.editorialRevision);
  const owner = {
    collection: 'professional-profiles' as const,
    documentId: String(doc.id),
    locale: doc.locale as 'pt' | 'en',
    revision,
  };
  const published = (
    await req.payload.find({
      collection: 'professional-profiles',
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
        { ...owner, state: 'pending', references: extractProfileMedia(published) },
        { ...owner, state: 'draft', references: [] },
      ],
      req,
    );
  } else {
    await trackMediaUsage([{ ...owner, state: 'draft', references }], req);
  }
  return doc;
};
