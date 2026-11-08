import 'server-only';
import { randomUUID } from 'node:crypto';
import { createLocalReq, type PayloadRequest } from 'payload';
import { runtimePayload } from '@/helpers/payload/runtime';
import { resolveMediaAccess } from './resolve-media-access';

const privateHeaders = {
  'Cache-Control': 'private, no-store',
  'X-Content-Type-Options': 'nosniff',
  'X-Robots-Tag': 'noindex, nofollow',
  'Referrer-Policy': 'no-referrer',
};

function unavailableMediaResponse() {
  console.error('Media delivery unavailable', { correlationId: randomUUID() });
  return new Response(null, { status: 503, headers: privateHeaders });
}

export async function mediaResponse(
  input: { mediaId: string; variant: string; preview: boolean },
  req: PayloadRequest,
  head = false,
) {
  const result = await resolveMediaAccess(input, req);
  if (!result.ok) return new Response(null, { status: result.status, headers: privateHeaders });
  return new Response(head ? null : Uint8Array.from(result.value.bytes), {
    status: 200,
    headers: {
      ...privateHeaders,
      'Cache-Control': input.preview ? 'private, no-store' : 'no-store',
      'Content-Type': result.value.type,
      'Content-Length': String(result.value.bytes.byteLength),
      'Content-Disposition':
        result.value.type === 'application/pdf' ? 'inline; filename="resume.pdf"' : 'inline',
    },
  });
}

export async function serveMedia(
  input: { mediaId: string; variant: string; preview: boolean },
  request: Request,
) {
  try {
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
