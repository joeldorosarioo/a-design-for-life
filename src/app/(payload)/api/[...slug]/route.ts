// Maintained application facade around native Payload REST transports.
import config from '@payload-config';
import {
  isEditorialAuthTransport,
  limitEditorialAuthTransport,
} from '@/helpers/payload/auth-transport';
import '@payloadcms/next/css';
import {
  REST_DELETE,
  REST_GET,
  REST_OPTIONS,
  REST_PATCH,
  REST_POST,
  REST_PUT,
} from '@payloadcms/next/routes';

export const GET = REST_GET(config);
const nativePost = REST_POST(config);
export const POST: ReturnType<typeof REST_POST> = async (request, args) => {
  const { slug } = await args.params;
  if (slug?.[0] === 'payload-locked-documents')
    return Response.json(
      { errors: [{ code: 'locked', message: 'Use the document editing lease.' }] },
      { status: 409 },
    );
  const limited = limitEditorialAuthTransport(slug);
  if (limited) return limited;
  if (isEditorialAuthTransport(slug)) {
    const origin = request.headers.get('origin');
    if (
      (origin && origin !== (await config).serverURL) ||
      request.headers.get('sec-fetch-site') === 'cross-site'
    ) {
      return Response.json(
        { errors: [{ message: 'Authentication request unavailable.' }] },
        {
          status: 403,
          headers: { 'Cache-Control': 'no-store, max-age=0', 'X-Robots-Tag': 'noindex, nofollow' },
        },
      );
    }
  }
  const response = await nativePost(request, args);
  if (!isEditorialAuthTransport(slug)) return response;
  const headers = new Headers(response.headers);
  headers.set('Cache-Control', 'no-store, max-age=0');
  headers.set('X-Robots-Tag', 'noindex, nofollow');
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
};
const nativeDelete = REST_DELETE(config);
export const DELETE: ReturnType<typeof REST_DELETE> = async (request, args) => {
  const { slug } = await args.params;
  if (slug?.[0] === 'payload-locked-documents')
    return Response.json(
      { errors: [{ code: 'locked', message: 'Use the document lease release action.' }] },
      { status: 409 },
    );
  return nativeDelete(request, args);
};
const nativePatch = REST_PATCH(config);
export const PATCH: ReturnType<typeof REST_PATCH> = async (request, args) => {
  const { slug } = await args.params;
  if (slug?.[0] === 'payload-locked-documents')
    return Response.json(
      { errors: [{ code: 'locked', message: 'An active editing lease cannot be taken over.' }] },
      { status: 409 },
    );
  return nativePatch(request, args);
};
const nativePut = REST_PUT(config);
export const PUT: ReturnType<typeof REST_PUT> = async (request, args) => {
  const { slug } = await args.params;
  if (slug?.[0] === 'payload-locked-documents')
    return Response.json(
      { errors: [{ code: 'locked', message: 'Use the document editing lease.' }] },
      { status: 409 },
    );
  return nativePut(request, args);
};
export const OPTIONS = REST_OPTIONS(config);
