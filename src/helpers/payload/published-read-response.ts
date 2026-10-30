import 'server-only';
import { createLocalReq, type CollectionSlug, type PayloadRequest, type Where } from 'payload';
import type { Result } from './editorial-result.schema';

// The caller supplies a DTO from one confirmed generation. SQL may establish
// absence only; an intent can be pending or confirmed and never grants a body.
export async function publishedReadResponse<T>(
  result: Result<T>,
  subject: { collection: CollectionSlug; where: Where },
  req: PayloadRequest,
): Promise<Response> {
  let status = result.ok ? 200 : 404;
  if (!result.ok && result.error.code === 'unavailable') {
    status = 503;
    try {
      const fresh = await createLocalReq({}, req.payload);
      const intents = await req.payload.db.count({
        collection: subject.collection,
        where: { and: [subject.where, { latestPublicationIntent: { exists: true } }] },
        req: fresh,
      });
      // Structural owners cannot be deleted after publication. No intent on a
      // healthy origin therefore proves absent/never-public, even without FS.
      if (intents.totalDocs === 0) status = 404;
    } catch {
      // An unavailable origin cannot prove absence.
    }
  }
  return Response.json(result, { status, headers: { 'Cache-Control': 'no-store' } });
}
