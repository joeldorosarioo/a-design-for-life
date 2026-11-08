import 'server-only';
import { logger } from '@/helpers/logger';
import { createLocalReq, type PayloadRequest } from 'payload';
import { runtimePayload } from '@/helpers/payload/runtime';
import { publicGenerationHeader } from '@/helpers/payload/public-generation-header';
import { resolveMediaDelivery } from './resolve-media-access';

const privateHeaders = {
  'Cache-Control': 'private, no-store',
  'X-Content-Type-Options': 'nosniff',
  'X-Robots-Tag': 'noindex, nofollow',
  'Referrer-Policy': 'no-referrer',
};

function unavailableMediaResponse() {
  logger.error({
    operation: 'media.delivery',
    result: 'unavailable',
    context: { statusCode: 503, errorCode: 'unavailable' },
  });
  return new Response(null, { status: 503, headers: privateHeaders });
}

export async function mediaResponse(
  input: { mediaId: string; variant: string; preview: boolean },
  req?: PayloadRequest,
  head = false,
) {
  const { access: result, generation } = await resolveMediaDelivery(input, req);
  const headers = new Headers(privateHeaders);
  if (generation) headers.set(publicGenerationHeader, generation);
  if (!result.ok) return new Response(null, { status: result.status, headers });
  headers.set('Cache-Control', input.preview ? 'private, no-store' : 'no-store');
  headers.set('Content-Type', result.value.type);
  headers.set('Content-Length', String(result.value.bytes.byteLength));
  headers.set(
    'Content-Disposition',
    result.value.type === 'application/pdf' ? 'inline; filename="resume.pdf"' : 'inline',
  );
  return new Response(head ? null : Uint8Array.from(result.value.bytes), { status: 200, headers });
}

export async function serveMedia(
  input: { mediaId: string; variant: string; preview: boolean },
  request: Request,
) {
  try {
    if (!input.preview) return await mediaResponse(input, undefined, request.method === 'HEAD');
    const payload = await runtimePayload();
    let user: PayloadRequest['user'] = null;
    if (input.preview) {
      const origin = request.headers.get('origin');
      if (
        (origin && origin !== payload.config.serverURL) ||
        request.headers.get('sec-fetch-site') === 'cross-site'
      )
        return new Response(null, { status: 401, headers: privateHeaders });
      user = (await payload.auth({ headers: request.headers })).user;
    }
    const req = await createLocalReq(
      { user: user ?? undefined, req: { headers: request.headers } },
      payload,
    );
    return await mediaResponse(input, req, request.method === 'HEAD');
  } catch {
    return unavailableMediaResponse();
  }
}

export async function nativeMediaFile(req: PayloadRequest, filename: unknown) {
  if (typeof filename !== 'string' || !req.user)
    return new Response(null, { status: 403, headers: privateHeaders });
  try {
    const doc = await req.payload.db.findOne({
      collection: 'media',
      req,
      where: { filename: { equals: filename } },
    });
    if (!doc) return new Response(null, { status: 404, headers: privateHeaders });
    return await mediaResponse(
      { mediaId: String(doc.id), variant: 'original', preview: true },
      req,
      req.method === 'HEAD',
    );
  } catch {
    return unavailableMediaResponse();
  }
}
