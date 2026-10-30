// Maintained application facade around native Payload REST transports.
import config from '@payload-config';
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
  return nativePost(request, args);
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
