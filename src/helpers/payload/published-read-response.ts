import 'server-only';
import { createLocalReq, type CollectionSlug, type PayloadRequest, type Where } from 'payload';
import type { Result } from './editorial-result.schema';
import { publicGenerationHeader } from './public-generation-header';
import { readPublicRoot, type PublicRoot } from './public-root';
import { runtimePublication } from './publication-runtime';

export async function capturePublishedReadRoot(): Promise<PublicRoot | null> {
  try {
    return await readPublicRoot(runtimePublication().directory);
  } catch {
    return null;
  }
}

// SQL may establish absence only; an intent never grants a public body.
export async function publishedReadStatus<T>(
  result: Result<T>,
  subject: { collection: CollectionSlug; where: Where },
  payload: PayloadRequest['payload'],
): Promise<200 | 404 | 503> {
  if (result.ok) return 200;
  if (result.error.code !== 'unavailable') return 404;
  try {
    const fresh = await createLocalReq({}, payload);
    const intents = await payload.db.count({
      collection: subject.collection,
      where: { and: [subject.where, { latestPublicationIntent: { exists: true } }] },
      req: fresh,
    });
    // Structural owners cannot be deleted after publication. Zero intents on a
    // healthy origin proves absent/never-public, including with no FS coverage.
    if (intents.totalDocs === 0) return 404;
  } catch {
    // An unavailable origin cannot prove absence.
  }
  return 503;
}

export async function publishedReadResponse<T>(
  result: Result<T>,
  subject: { collection: CollectionSlug; where: Where },
  req: PayloadRequest,
  root?: PublicRoot | null,
): Promise<Response> {
  const status = await publishedReadStatus(result, subject, req.payload);
  const headers = new Headers({ 'Cache-Control': 'no-store' });
  if (status === 200 && root) headers.set(publicGenerationHeader, root.generation);
  return Response.json(result, { status, headers });
}
