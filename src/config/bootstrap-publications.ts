import 'server-only';
import { createLocalReq, type PayloadRequest } from 'payload';
import type { PublicationUpdate } from '@/payload-types';
import { retryPublicationUpdate } from '@/helpers/payload/publication-updates';
export async function bootstrapLegacyPublications(req: PayloadRequest): Promise<number> {
  if (req.transactionID)
    throw new Error('Bootstrap requires committed migration data and an independent request.');
  const found = await req.payload.db.find({
    collection: 'publication-updates',
    where: { state: { equals: 'update-pending' } },
    pagination: false,
    limit: 0,
    req,
  });
  const pending = (found.docs as PublicationUpdate[]).filter(
    (operation) =>
      Array.isArray(operation.dependencies) && operation.dependencies.includes('legacy-bootstrap'),
  );
  if (!pending.length) return 0;
  let editor = req.user;
  if (!editor) {
    const user = (
      await req.payload.find({ collection: 'users', limit: 1, depth: 0, overrideAccess: true, req })
    ).docs[0];
    if (user) editor = { ...user, collection: 'users' };
  }
  if (!editor)
    throw new Error('Legacy bootstrap requires an existing authorized editorial account.');
  const fresh = await createLocalReq({ user: editor }, req.payload);
  const order = { cases: 0, 'professional-profiles': 1, 'case-content': 2, 'site-navigation': 3 };
  pending.sort(
    (a, b) =>
      order[a.subjectCollection] - order[b.subjectCollection] ||
      a.operationId.localeCompare(b.operationId),
  );
  for (const operation of pending) {
    const result = await retryPublicationUpdate(operation.operationId, fresh);
    if (!result.ok || result.value.state !== 'public')
      throw new Error(
        `Legacy publication remains pending: ${operation.operationId}. Retry bootstrap before admitting editorial writes.`,
      );
  }
  return pending.length;
}
