import 'server-only';
import type { PayloadRequest, Where } from 'payload';
import { publicationAdapters } from './publication';
import {
  enqueuePublicationUpdate,
  type PublicationSubject,
} from '@/helpers/payload/publication-updates';
import { requirePublicationTransaction } from '@/helpers/payload/publication-coordinator';
/** Called once by the additive migration, before ordinary editorial writes resume. */
export async function captureLegacyPublications(req: PayloadRequest): Promise<number> {
  await requirePublicationTransaction(req);
  const collections = Object.keys(publicationAdapters) as PublicationSubject['collection'][];
  const eligible: PublicationSubject['collection'][] = [];
  const predicates = new Map<PublicationSubject['collection'], Where>();
  for (const collection of collections) {
    const adapter = publicationAdapters[collection];
    const eligibleWhere = adapter.legacyWhere
      ? await adapter.legacyWhere(req)
      : adapter.shared
        ? {}
        : { _status: { equals: 'published' } };
    const where: Where = { and: [{ latestPublicationIntent: { exists: false } }, eligibleWhere] };
    predicates.set(collection, where);
    const found = await req.payload.db.find({ collection, where, limit: 1, req });
    if (found.docs.length) eligible.push(collection);
  }
  // A new database has no eligible publication and needs no invented editor.
  if (!eligible.length) return 0;
  const previous = req.user;
  if (!req.user) {
    const editor = (
      await req.payload.find({ collection: 'users', limit: 1, depth: 0, overrideAccess: true, req })
    ).docs[0];
    if (!editor)
      throw new Error(
        'Legacy publication capture requires an existing editorial account. Provision the authorized editor before retrying this migration.',
      );
    req.user = { ...editor, collection: 'users' };
  }
  let count = 0;
  try {
    for (const collection of eligible) {
      // Native canonical selection deliberately ignores the newest private version.
      const documents = await req.payload.find({
        collection,
        where: predicates.get(collection),
        draft: false,
        pagination: false,
        limit: 0,
        depth: 0,
        overrideAccess: true,
        req,
      });
      for (const document of documents.docs) {
        const head = (await req.payload.db.findOne({
          collection,
          where: { id: { equals: document.id } },
          req,
        })) as { latestPublicationIntent?: string | null } | null;
        if (!head || head.latestPublicationIntent) continue;
        const canonical = document as unknown as Record<string, unknown>;
        const adapter = publicationAdapters[collection];
        const prepared = adapter.prepareLegacy
          ? await adapter.prepareLegacy(canonical, req)
          : await adapter.prepare(canonical, true, req);
        await enqueuePublicationUpdate(
          {
            subject: { collection, id: String(document.id) },
            targetRevision: String(canonical.editorialRevision),
            target: prepared.value,
            dependencies: [...prepared.dependencies, 'legacy-bootstrap'],
          },
          req,
        );
        count++;
      }
    }
    return count;
  } finally {
    req.user = previous;
  }
}
